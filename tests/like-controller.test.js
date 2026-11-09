import test from "node:test";
import assert from "node:assert/strict";

import { Like } from "../src/models/like.model.js";
import {
  getLikedVideos,
  toggleCommentLike,
  toggleTweetLike,
  toggleVideoLike,
} from "../src/controllers/like.controller.js";

const createResponse = () => ({
  statusCode: undefined,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.payload = payload;
    return this;
  },
});

const invoke = async (handler, req) => {
  const res = createResponse();
  let error;
  handler(req, res, (caughtError) => {
    error = caughtError;
  });
  await new Promise((resolve) => setImmediate(resolve));
  return { res, error };
};

test("like toggle handlers create and remove the matching user's like", async () => {
  const originalFindOne = Like.findOne;
  const originalCreate = Like.create;

  try {
    for (const [handler, paramName, targetField] of [
      [toggleVideoLike, "videoId", "video"],
      [toggleCommentLike, "commentId", "comment"],
      [toggleTweetLike, "tweetId", "tweet"],
    ]) {
      let createdLike;
      Like.findOne = async () => null;
      Like.create = async (like) => {
        createdLike = like;
      };

      const { res: createdResponse, error: createError } = await invoke(
        handler,
        {
          params: { [paramName]: "507f1f77bcf86cd799439011" },
          user: { _id: "507f191e810c19729de860ea" },
        }
      );

      assert.equal(createError, undefined);
      assert.equal(createdResponse.statusCode, 200);
      assert.deepEqual(createdResponse.payload.data, { isLiked: true });
      assert.deepEqual(createdLike, {
        [targetField]: "507f1f77bcf86cd799439011",
        likedBy: "507f191e810c19729de860ea",
      });

      let removed = false;
      Like.findOne = async () => ({
        async deleteOne() {
          removed = true;
        },
      });

      const { res: removedResponse, error: removeError } = await invoke(
        handler,
        {
          params: { [paramName]: "507f1f77bcf86cd799439011" },
          user: { _id: "507f191e810c19729de860ea" },
        }
      );

      assert.equal(removeError, undefined);
      assert.equal(removed, true);
      assert.deepEqual(removedResponse.payload.data, { isLiked: false });
    }
  } finally {
    Like.findOne = originalFindOne;
    Like.create = originalCreate;
  }
});

test("like toggle rejects an invalid target ID", async () => {
  const { res, error } = await invoke(toggleVideoLike, {
    params: { videoId: "invalid" },
    user: { _id: "507f191e810c19729de860ea" },
  });

  assert.equal(res.payload, undefined);
  assert.equal(error.statusCode, 400);
});

test("getLikedVideos returns populated videos for the authenticated user", async () => {
  const originalFind = Like.find;
  const videos = [{ _id: "video-1", title: "Liked video" }];
  const calls = [];

  try {
    Like.find = (filter) => {
      calls.push(["find", filter]);
      return {
        populate(options) {
          calls.push(["populate", options]);
          return {
            sort(options) {
              calls.push(["sort", options]);
              return Promise.resolve(videos.map((video) => ({ video })));
            },
          };
        },
      };
    };

    const { res, error } = await invoke(getLikedVideos, {
      params: {},
      user: { _id: "507f191e810c19729de860ea" },
    });

    assert.equal(error, undefined);
    assert.deepEqual(res.payload.data, videos);
    assert.deepEqual(calls[0], [
      "find",
      {
        likedBy: "507f191e810c19729de860ea",
        video: { $exists: true, $ne: null },
      },
    ]);
  } finally {
    Like.find = originalFind;
  }
});
