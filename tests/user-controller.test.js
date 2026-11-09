import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { v2 as cloudinary } from "cloudinary";

import { User } from "../src/models/user.model.js";
import {
  updateUserAvatar,
  updateUserCoverImage,
} from "../src/controllers/user.controller.js";

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

const createUploadedFile = () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "user-controller-"));
  const localPath = path.join(directory, "image.jpg");
  fs.writeFileSync(localPath, "image");
  return { directory, localPath };
};

for (const { name, handler, field, oldUrl, newUrl, expectedPublicId } of [
  {
    name: "avatar",
    handler: updateUserAvatar,
    field: "avatar",
    oldUrl:
      "https://res.cloudinary.com/test-cloud/image/upload/v1700000000/users/old-avatar.jpg",
    newUrl:
      "https://res.cloudinary.com/test-cloud/image/upload/v1700000001/users/new-avatar.jpg",
    expectedPublicId: "users/old-avatar",
  },
  {
    name: "cover image",
    handler: updateUserCoverImage,
    field: "coverImage",
    oldUrl:
      "https://res.cloudinary.com/test-cloud/image/upload/c_fill,w_200/v1700000000/users/old-cover.png",
    newUrl:
      "https://res.cloudinary.com/test-cloud/image/upload/v1700000001/users/new-cover.png",
    expectedPublicId: "users/old-cover",
  },
]) {
  test(`updateUser${name === "avatar" ? "Avatar" : "CoverImage"} stores the new image and deletes the old one`, async () => {
    const originalUpload = cloudinary.uploader.upload;
    const originalDestroy = cloudinary.uploader.destroy;
    const originalFindByIdAndUpdate = User.findByIdAndUpdate;
    const { directory, localPath } = createUploadedFile();
    const userId = "507f1f77bcf86cd799439011";
    const updatedUser = { _id: userId, [field]: newUrl };
    const deleteCalls = [];
    let updateCall;

    try {
      cloudinary.uploader.upload = async () => ({ url: newUrl });
      cloudinary.uploader.destroy = async (...args) => {
        deleteCalls.push(args);
        return { result: "ok" };
      };
      User.findByIdAndUpdate = (id, update, options) => {
        updateCall = { id, update, options };
        return {
          select: async (selection) => {
            assert.equal(selection, "-password");
            return updatedUser;
          },
        };
      };

      const { res, error } = await invoke(handler, {
        file: { path: localPath },
        user: { _id: userId, [field]: oldUrl },
      });

      assert.equal(error, undefined);
      assert.equal(res.statusCode, 200);
      assert.equal(res.payload.data, updatedUser);
      assert.deepEqual(updateCall, {
        id: userId,
        update: { $set: { [field]: newUrl } },
        options: { new: true },
      });
      assert.deepEqual(deleteCalls, [
        [expectedPublicId, { resource_type: "image" }],
      ]);
      assert.equal(fs.existsSync(localPath), false);
    } finally {
      cloudinary.uploader.upload = originalUpload;
      cloudinary.uploader.destroy = originalDestroy;
      User.findByIdAndUpdate = originalFindByIdAndUpdate;
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
}

test("updateUserAvatar leaves the current image intact if upload fails", async () => {
  const originalUpload = cloudinary.uploader.upload;
  const originalDestroy = cloudinary.uploader.destroy;
  const originalFindByIdAndUpdate = User.findByIdAndUpdate;
  const { directory, localPath } = createUploadedFile();
  let destroyCalled = false;
  let updateCalled = false;

  try {
    cloudinary.uploader.upload = async () => {
      throw new Error("upload failed");
    };
    cloudinary.uploader.destroy = async () => {
      destroyCalled = true;
      return { result: "ok" };
    };
    User.findByIdAndUpdate = () => {
      updateCalled = true;
    };

    const { res, error } = await invoke(updateUserAvatar, {
      file: { path: localPath },
      user: {
        _id: "507f1f77bcf86cd799439011",
        avatar:
          "https://res.cloudinary.com/test-cloud/image/upload/v1700000000/users/old-avatar.jpg",
      },
    });

    assert.equal(error.statusCode, 400);
    assert.equal(res.payload, undefined);
    assert.equal(destroyCalled, false);
    assert.equal(updateCalled, false);
    assert.equal(fs.existsSync(localPath), false);
  } finally {
    cloudinary.uploader.upload = originalUpload;
    cloudinary.uploader.destroy = originalDestroy;
    User.findByIdAndUpdate = originalFindByIdAndUpdate;
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
