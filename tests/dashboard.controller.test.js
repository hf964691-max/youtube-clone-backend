import test from "node:test";
import assert from "node:assert/strict";

import { Video } from "../src/models/video.model.js";
import { Subscription } from "../src/models/subscription.model.js";
import { Like } from "../src/models/like.model.js";
import { getChannelStats, getChannelVideos } from "../src/controllers/dashboard.controller.js";

test("getChannelStats returns channel metrics for the authenticated user", async () => {
  const originalFind = Video.find;
  const originalCountDocuments = Subscription.countDocuments;
  const originalLikeCountDocuments = Like.countDocuments;

  Video.find = () => ({
    select: () => [
      { _id: "video-1", views: 120 },
      { _id: "video-2", views: 80 },
    ],
  });
  Subscription.countDocuments = async () => 4;
  Like.countDocuments = async () => 9;

  const req = {
    user: { _id: "user-123" },
  };

  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };

  getChannelStats(req, res, () => {});
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.payload.data, {
    totalVideos: 2,
    totalViews: 200,
    totalSubscribers: 4,
    totalLikes: 9,
  });

  Video.find = originalFind;
  Subscription.countDocuments = originalCountDocuments;
  Like.countDocuments = originalLikeCountDocuments;
});

test("getChannelVideos returns the authenticated user's uploaded videos", async () => {
  const originalFind = Video.find;

  const mockVideos = [
    { _id: "video-1", title: "First video", owner: { fullName: "Test User", username: "testuser", avatar: "avatar-url" } },
    { _id: "video-2", title: "Second video", owner: { fullName: "Test User", username: "testuser", avatar: "avatar-url" } },
  ];

  Video.find = () => ({
    populate() {
      return {
        sort() {
          return mockVideos;
        },
      };
    },
  });

  const req = {
    user: { _id: "user-123" },
  };

  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };

  getChannelVideos(req, res, () => {});
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.data.length, 2);
  assert.equal(res.payload.data[0].title, "First video");

  Video.find = originalFind;
});
