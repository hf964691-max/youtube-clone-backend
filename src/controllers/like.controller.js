import { isValidObjectId } from "mongoose";
import { Like } from "../models/like.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const toggleLike = async (req, res, targetId, targetField, targetName) => {
  if (!isValidObjectId(targetId)) {
    throw new ApiError(400, `Invalid ${targetName} ID`);
  }

  const likeFilter = {
    [targetField]: targetId,
    likedBy: req.user._id,
  };
  const existingLike = await Like.findOne(likeFilter);

  if (existingLike) {
    await existingLike.deleteOne();
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { isLiked: false },
          `${targetName} like removed successfully`
        )
      );
  }

  await Like.create(likeFilter);
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { isLiked: true },
        `${targetName} liked successfully`
      )
    );
};

const toggleVideoLike = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  return toggleLike(req, res, videoId, "video", "Video");
});

const toggleCommentLike = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  return toggleLike(req, res, commentId, "comment", "Comment");
});

const toggleTweetLike = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;
  return toggleLike(req, res, tweetId, "tweet", "Tweet");
});

const getLikedVideos = asyncHandler(async (req, res) => {
  const likes = await Like.find({
    likedBy: req.user._id,
    video: { $exists: true, $ne: null },
  })
    .populate({
      path: "video",
      populate: {
        path: "owner",
        select: "fullName username avatar",
      },
    })
    .sort({ createdAt: -1 });

  const videos = likes.map((like) => like.video).filter(Boolean);

  return res
    .status(200)
    .json(new ApiResponse(200, videos, "Liked videos fetched successfully"));
});

export {
  toggleCommentLike,
  toggleTweetLike,
  toggleVideoLike,
  getLikedVideos,
};