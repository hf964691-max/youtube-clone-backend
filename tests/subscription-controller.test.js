import test from "node:test";
import assert from "node:assert/strict";

import { Subscription } from "../src/models/subscription.model.js";
import { User } from "../src/models/user.model.js";
import {
  getSubscribedChannels,
  getUserChannelSubscribers,
  toggleSubscription,
} from "../src/controllers/subscription.controller.js";

const channelId = "507f1f77bcf86cd799439011";
const subscriberId = "507f1f77bcf86cd799439012";

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

test("toggleSubscription creates a subscription for a valid channel", async () => {
  const originalExists = User.exists;
  const originalFindOne = Subscription.findOne;
  const originalCreate = Subscription.create;
  const createdSubscription = { _id: "subscription-1" };
  let filter;

  try {
    User.exists = async () => true;
    Subscription.findOne = async () => null;
    Subscription.create = async (payload) => {
      filter = payload;
      return createdSubscription;
    };

    const { res, error } = await invoke(toggleSubscription, {
      params: { channelId },
      user: { _id: subscriberId },
    });

    assert.equal(error, undefined);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(filter, { subscriber: subscriberId, channel: channelId });
    assert.deepEqual(res.payload.data, {
      isSubscribed: true,
      subscription: createdSubscription,
    });
  } finally {
    User.exists = originalExists;
    Subscription.findOne = originalFindOne;
    Subscription.create = originalCreate;
  }
});

test("toggleSubscription removes an existing subscription", async () => {
  const originalExists = User.exists;
  const originalFindOne = Subscription.findOne;
  let removed = false;

  try {
    User.exists = async () => true;
    Subscription.findOne = async () => ({
      async deleteOne() {
        removed = true;
      },
    });

    const { res, error } = await invoke(toggleSubscription, {
      params: { channelId },
      user: { _id: subscriberId },
    });

    assert.equal(error, undefined);
    assert.equal(removed, true);
    assert.deepEqual(res.payload.data, { isSubscribed: false });
  } finally {
    User.exists = originalExists;
    Subscription.findOne = originalFindOne;
  }
});

test("toggleSubscription rejects invalid, missing, and self-owned channels", async () => {
  const originalExists = User.exists;
  let existsCalls = 0;

  try {
    User.exists = async () => {
      existsCalls += 1;
      return false;
    };

    const invalid = await invoke(toggleSubscription, {
      params: { channelId: "invalid" },
      user: { _id: subscriberId },
    });
    assert.equal(invalid.error.statusCode, 400);
    assert.equal(existsCalls, 0);

    const missing = await invoke(toggleSubscription, {
      params: { channelId },
      user: { _id: subscriberId },
    });
    assert.equal(missing.error.statusCode, 404);

    const self = await invoke(toggleSubscription, {
      params: { channelId: subscriberId },
      user: { _id: subscriberId },
    });
    assert.equal(self.error.statusCode, 400);
    assert.equal(existsCalls, 1);
  } finally {
    User.exists = originalExists;
  }
});

test("getUserChannelSubscribers returns subscribers for a channel", async () => {
  const originalFind = Subscription.find;
  const subscriptions = [{ _id: "subscription-1" }];
  const calls = [];

  try {
    Subscription.find = (filter) => {
      calls.push(["find", filter]);
      return {
        populate(path, fields) {
          calls.push(["populate", path, fields]);
          return {
            sort(sort) {
              calls.push(["sort", sort]);
              return Promise.resolve(subscriptions);
            },
          };
        },
      };
    };

    const { res, error } = await invoke(getUserChannelSubscribers, {
      params: { channelId },
    });

    assert.equal(error, undefined);
    assert.deepEqual(res.payload.data, subscriptions);
    assert.deepEqual(calls, [
      ["find", { channel: channelId }],
      ["populate", "subscriber", "fullName username avatar"],
      ["sort", { createdAt: -1 }],
    ]);
  } finally {
    Subscription.find = originalFind;
  }
});

test("getSubscribedChannels returns channels followed by a subscriber", async () => {
  const originalFind = Subscription.find;
  const subscriptions = [{ _id: "subscription-1" }];
  const calls = [];

  try {
    Subscription.find = (filter) => {
      calls.push(["find", filter]);
      return {
        populate(path, fields) {
          calls.push(["populate", path, fields]);
          return {
            sort(sort) {
              calls.push(["sort", sort]);
              return Promise.resolve(subscriptions);
            },
          };
        },
      };
    };

    const { res, error } = await invoke(getSubscribedChannels, {
      params: { subscriberId },
    });

    assert.equal(error, undefined);
    assert.deepEqual(res.payload.data, subscriptions);
    assert.deepEqual(calls, [
      ["find", { subscriber: subscriberId }],
      ["populate", "channel", "fullName username avatar"],
      ["sort", { createdAt: -1 }],
    ]);

    const invalid = await invoke(getSubscribedChannels, {
      params: { subscriberId: "invalid" },
    });
    assert.equal(invalid.error.statusCode, 400);
  } finally {
    Subscription.find = originalFind;
  }
});
