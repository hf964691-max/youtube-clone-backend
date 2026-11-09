import test from "node:test";
import assert from "node:assert/strict";

import { Tweet } from "../src/models/tweet.model.js";
import { User } from "../src/models/user.model.js";
import {
  createTweet,
  deleteTweet,
  getUserTweets,
  updateTweet,
} from "../src/controllers/tweet.controller.js";

const tweetId = "507f1f77bcf86cd799439011";
const userId = "507f1f77bcf86cd799439012";

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

const ownedTweet = (overrides = {}) => ({
  _id: tweetId,
  content: "Original tweet",
  owner: { toString: () => userId },
  async save() {
    return this;
  },
  async deleteOne() {
    return this;
  },
  ...overrides,
});

test("createTweet validates content and creates a tweet for the current user", async () => {
  const originalCreate = Tweet.create;
  const originalFindById = Tweet.findById;
  const createdTweet = { _id: tweetId, content: "A new tweet", owner: userId };
  const populatedTweet = { ...createdTweet, owner: { username: "testuser" } };
  let createdPayload;

  try {
    Tweet.create = async (payload) => {
      createdPayload = payload;
      return createdTweet;
    };
    Tweet.findById = (id) => ({
      populate(path, fields) {
        assert.equal(id, tweetId);
        assert.equal(path, "owner");
        assert.equal(fields, "fullName username avatar");
        return Promise.resolve(populatedTweet);
      },
    });

    const { res, error } = await invoke(createTweet, {
      body: { content: "  A new tweet  " },
      user: { _id: userId },
    });

    assert.equal(error, undefined);
    assert.equal(res.statusCode, 201);
    assert.deepEqual(createdPayload, { content: "A new tweet", owner: userId });
    assert.equal(res.payload.data, populatedTweet);
  } finally {
    Tweet.create = originalCreate;
    Tweet.findById = originalFindById;
  }
});

test("createTweet rejects empty content", async () => {
  const { res, error } = await invoke(createTweet, {
    body: { content: "   " },
    user: { _id: userId },
  });

  assert.equal(res.payload, undefined);
  assert.equal(error.statusCode, 400);
});

test("getUserTweets returns a user's newest tweets with owner details", async () => {
  const originalExists = User.exists;
  const originalFind = Tweet.find;
  const tweets = [{ _id: tweetId, content: "Latest tweet" }];
  const calls = [];

  try {
    User.exists = async (filter) => {
      assert.deepEqual(filter, { _id: userId });
      return true;
    };
    Tweet.find = (filter) => {
      calls.push(["find", filter]);
      return {
        populate(path, fields) {
          calls.push(["populate", path, fields]);
          return {
            sort(sort) {
              calls.push(["sort", sort]);
              return Promise.resolve(tweets);
            },
          };
        },
      };
    };

    const { res, error } = await invoke(getUserTweets, {
      params: { userId },
    });

    assert.equal(error, undefined);
    assert.deepEqual(res.payload.data, tweets);
    assert.deepEqual(calls, [
      ["find", { owner: userId }],
      ["populate", "owner", "fullName username avatar"],
      ["sort", { createdAt: -1 }],
    ]);
  } finally {
    User.exists = originalExists;
    Tweet.find = originalFind;
  }
});

test("getUserTweets rejects invalid and missing users", async () => {
  const originalExists = User.exists;

  try {
    User.exists = async () => null;
    const invalid = await invoke(getUserTweets, {
      params: { userId: "invalid" },
    });
    assert.equal(invalid.error.statusCode, 400);

    const missing = await invoke(getUserTweets, {
      params: { userId },
    });
    assert.equal(missing.error.statusCode, 404);
  } finally {
    User.exists = originalExists;
  }
});

test("updateTweet allows its owner to update tweet content", async () => {
  const originalFindById = Tweet.findById;
  const tweet = ownedTweet();
  let saved = false;
  tweet.save = async function () {
    saved = true;
    return this;
  };

  try {
    Tweet.findById = async () => tweet;

    const { res, error } = await invoke(updateTweet, {
      params: { tweetId },
      body: { content: "  Updated tweet  " },
      user: { _id: userId },
    });

    assert.equal(error, undefined);
    assert.equal(saved, true);
    assert.equal(tweet.content, "Updated tweet");
    assert.equal(res.payload.data, tweet);
  } finally {
    Tweet.findById = originalFindById;
  }
});

test("updateTweet rejects invalid IDs, empty content, missing tweets, and other owners", async () => {
  const originalFindById = Tweet.findById;

  try {
    Tweet.findById = async () => ownedTweet();

    const invalid = await invoke(updateTweet, {
      params: { tweetId: "invalid" },
      body: { content: "Content" },
      user: { _id: userId },
    });
    assert.equal(invalid.error.statusCode, 400);

    const empty = await invoke(updateTweet, {
      params: { tweetId },
      body: { content: " " },
      user: { _id: userId },
    });
    assert.equal(empty.error.statusCode, 400);

    Tweet.findById = async () => null;
    const missing = await invoke(updateTweet, {
      params: { tweetId },
      body: { content: "Content" },
      user: { _id: userId },
    });
    assert.equal(missing.error.statusCode, 404);

    Tweet.findById = async () =>
      ownedTweet({ owner: { toString: () => "507f1f77bcf86cd799439099" } });
    const forbidden = await invoke(updateTweet, {
      params: { tweetId },
      body: { content: "Content" },
      user: { _id: userId },
    });
    assert.equal(forbidden.error.statusCode, 403);
  } finally {
    Tweet.findById = originalFindById;
  }
});

test("deleteTweet removes a tweet owned by the current user", async () => {
  const originalFindById = Tweet.findById;
  let deleted = false;

  try {
    Tweet.findById = async () =>
      ownedTweet({
        async deleteOne() {
          deleted = true;
        },
      });

    const { res, error } = await invoke(deleteTweet, {
      params: { tweetId },
      user: { _id: userId },
    });

    assert.equal(error, undefined);
    assert.equal(deleted, true);
    assert.deepEqual(res.payload.data, {});
  } finally {
    Tweet.findById = originalFindById;
  }
});

test("deleteTweet rejects invalid IDs, missing tweets, and other owners", async () => {
  const originalFindById = Tweet.findById;

  try {
    Tweet.findById = async () => ownedTweet();

    const invalid = await invoke(deleteTweet, {
      params: { tweetId: "invalid" },
      user: { _id: userId },
    });
    assert.equal(invalid.error.statusCode, 400);

    Tweet.findById = async () => null;
    const missing = await invoke(deleteTweet, {
      params: { tweetId },
      user: { _id: userId },
    });
    assert.equal(missing.error.statusCode, 404);

    Tweet.findById = async () =>
      ownedTweet({ owner: { toString: () => "507f1f77bcf86cd799439099" } });
    const forbidden = await invoke(deleteTweet, {
      params: { tweetId },
      user: { _id: userId },
    });
    assert.equal(forbidden.error.statusCode, 403);
  } finally {
    Tweet.findById = originalFindById;
  }
});
