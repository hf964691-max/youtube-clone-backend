import { isValidObjectId } from "mongoose";
import { User } from "../models/user.model.js";
import { Subscription } from "../models/subscription.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const toggleSubscription = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  const subscriberId = req.user._id;

  if (!isValidObjectId(channelId)) {
    throw new ApiError(400, "Invalid channel ID");
  }

  if (channelId === subscriberId.toString()) {
    throw new ApiError(400, "You cannot subscribe to your own channel");
  }

  const channelExists = await User.exists({ _id: channelId });

  if (!channelExists) {
    throw new ApiError(404, "Channel not found");
  }

  const subscriptionFilter = { subscriber: subscriberId, channel: channelId };
  const existingSubscription = await Subscription.findOne(subscriptionFilter);

  if (existingSubscription) {
    await existingSubscription.deleteOne();
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { isSubscribed: false },
          "Channel unsubscribed successfully"
        )
      );
  }

  const subscription = await Subscription.create(subscriptionFilter);
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { isSubscribed: true, subscription },
        "Channel subscribed successfully"
      )
    );
});

const getUserChannelSubscribers = asyncHandler(async (req, res) => {
  const { channelId } = req.params;

  if (!isValidObjectId(channelId)) {
    throw new ApiError(400, "Invalid channel ID");
  }

  const subscriptions = await Subscription.find({ channel: channelId })
    .populate("subscriber", "fullName username avatar")
    .sort({ createdAt: -1 });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        subscriptions,
        "Channel subscribers fetched successfully"
      )
    );
});

const getSubscribedChannels = asyncHandler(async (req, res) => {
  const { subscriberId } = req.params;

  if (!isValidObjectId(subscriberId)) {
    throw new ApiError(400, "Invalid subscriber ID");
  }

  const subscriptions = await Subscription.find({ subscriber: subscriberId })
    .populate("channel", "fullName username avatar")
    .sort({ createdAt: -1 });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        subscriptions,
        "Subscribed channels fetched successfully"
      )
    );
});

export { toggleSubscription, getUserChannelSubscribers, getSubscribedChannels };
