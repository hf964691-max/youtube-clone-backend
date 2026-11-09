import { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import {
  uploadOnCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinary.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getOwnedVideo = async (videoId, userId) => {
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video ID");
  }

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  if (video.owner?.toString() !== userId.toString()) {
    throw new ApiError(403, "You are not allowed to modify this video");
  }

  return video;
};

const getAllVideos = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    query,
    sortBy = "createdAt",
    sortType = "desc",
    userId,
  } = req.query;

  const parsedPage = Number(page);
  const parsedLimit = Number(limit);
  const safePage =
    Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const safeLimit =
    Number.isInteger(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, 100)
      : 10;

  const match = { isPublished: true };

  if (typeof query === "string" && query.trim()) {
    const escapedQuery = query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    match.$or = [
      { title: { $regex: escapedQuery, $options: "i" } },
      { description: { $regex: escapedQuery, $options: "i" } },
    ];
  }

  if (userId !== undefined) {
    if (!isValidObjectId(userId)) {
      throw new ApiError(400, "Invalid user ID");
    }
    match.owner = userId;
  }

  const sortableFields = new Set(["createdAt", "title", "views", "duration"]);
  const sortField =
    typeof sortBy === "string" && sortableFields.has(sortBy)
      ? sortBy
      : "createdAt";
  const sortDirection =
    typeof sortType === "string" && sortType.toLowerCase() === "asc" ? 1 : -1;

  const aggregate = Video.aggregate([
    { $match: match },
    { $sort: { [sortField]: sortDirection, _id: 1 } },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
        pipeline: [
          {
            $project: {
              fullName: 1,
              username: 1,
              avatar: 1,
            },
          },
        ],
      },
    },
    { $unwind: { path: "$owner", preserveNullAndEmptyArrays: true } },
  ]);
  const videos = await Video.aggregatePaginate(aggregate, {
    page: safePage,
    limit: safeLimit,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, videos, "Videos fetched successfully"));
});

const publishVideo = asyncHandler(async (req, res) => {
  const { title, description } = req.body;

  if (typeof title !== "string" || !title.trim()) {
    throw new ApiError(400, "Video title is required");
  }

  if (typeof description !== "string" || !description.trim()) {
    throw new ApiError(400, "Video description is required");
  }

  const videoLocalPath = req.files?.videoFile?.[0]?.path;
  const thumbnailLocalPath = req.files?.thumbnail?.[0]?.path;

  if (!videoLocalPath) {
    throw new ApiError(400, "Video file is required");
  }

  if (!thumbnailLocalPath) {
    throw new ApiError(400, "Video thumbnail is required");
  }

  const videoUpload = await uploadOnCloudinary(videoLocalPath);

  if (!videoUpload?.url || !Number.isFinite(Number(videoUpload.duration))) {
    throw new ApiError(400, "Error while uploading video");
  }

  const thumbnailUpload = await uploadOnCloudinary(thumbnailLocalPath);

  if (!thumbnailUpload?.url) {
    await deleteFromCloudinary(videoUpload.url);
    throw new ApiError(400, "Error while uploading video thumbnail");
  }

  try {
    const video = await Video.create({
      videoFile: videoUpload.url,
      thumbnail: thumbnailUpload.url,
      title: title.trim(),
      description: description.trim(),
      duration: Number(videoUpload.duration),
      owner: req.user._id,
    });

    return res
      .status(201)
      .json(new ApiResponse(201, video, "Video published successfully"));
  } catch (error) {
    await Promise.all([
      deleteFromCloudinary(videoUpload.url),
      deleteFromCloudinary(thumbnailUpload.url),
    ]);
    throw error;
  }
});

const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video ID");
  }

  const video = await Video.findByIdAndUpdate(
    videoId,
    { $inc: { views: 1 } },
    { new: true }
  ).populate("owner", "fullName username avatar");

  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, video, "Video fetched successfully"));
});

const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { title, description } = req.body;
  const video = await getOwnedVideo(videoId, req.user._id);

  if (title === undefined && description === undefined && !req.file?.path) {
    throw new ApiError(400, "At least one video field is required");
  }

  if (title !== undefined) {
    if (typeof title !== "string" || !title.trim()) {
      throw new ApiError(400, "Video title is required");
    }
    video.title = title.trim();
  }

  if (description !== undefined) {
    if (typeof description !== "string" || !description.trim()) {
      throw new ApiError(400, "Video description is required");
    }
    video.description = description.trim();
  }

  let newThumbnailUrl;
  const oldThumbnailUrl = video.thumbnail;
  if (req.file?.path) {
    const thumbnailUpload = await uploadOnCloudinary(req.file.path);

    if (!thumbnailUpload?.url) {
      throw new ApiError(400, "Error while uploading video thumbnail");
    }

    newThumbnailUrl = thumbnailUpload.url;
    video.thumbnail = newThumbnailUrl;
  }

  await video.save();

  if (newThumbnailUrl && newThumbnailUrl !== oldThumbnailUrl) {
    await deleteFromCloudinary(oldThumbnailUrl);
  }

  return res
    .status(200)
    .json(new ApiResponse(200, video, "Video updated successfully"));
});

const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const video = await getOwnedVideo(videoId, req.user._id);

  await Promise.all([
    deleteFromCloudinary(video.videoFile),
    deleteFromCloudinary(video.thumbnail),
  ]);
  await video.deleteOne();

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Video deleted successfully"));
});

const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const video = await getOwnedVideo(videoId, req.user._id);

  video.isPublished = !video.isPublished;
  await video.save();

  return res
    .status(200)
    .json(
      new ApiResponse(200, video, "Video publish status updated successfully")
    );
});

export {
  getAllVideos,
  publishVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
};
