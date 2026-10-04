import mongoose from "mongoose";
import { Video } from "../models/video.model.js";
import { Subscription } from "../models/subscription.model.js";
import { Like } from "../models/like.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getChannelStats = asyncHandler(async (req, res) => {
  const channelId = req.user?._id;

  if (!channelId) {
    throw new ApiError(401, "Unauthorized request");
  }

  const videos = await Video.find({ owner: channelId }).select("_id views");

  const totalVideos = videos.length;
  const totalViews = videos.reduce((sum, video) => sum + (video.views || 0), 0);
  const totalSubscribers = await Subscription.countDocuments({ channel: channelId });
  const totalLikes = await Like.countDocuments({
    video: { $in: videos.map((video) => video._id) },
  });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        {
          totalVideos,
          totalViews,
          totalSubscribers,
          totalLikes,
        },
        "Channel stats fetched successfully"
      )
    );
});

const getChannelVideos = asyncHandler(async (req, res) => {
  const channelId = req.user?._id;

  if (!channelId) {
    throw new ApiError(401, "Unauthorized request");
  }

  const videos = await Video.find({ owner: channelId })
    .populate("owner", "fullName username avatar")
    .sort({ createdAt: -1 });

  return res
    .status(200)
    .json(
      new ApiResponse(200, videos, "Channel videos fetched successfully")
    );
});

export { getChannelStats, getChannelVideos };
