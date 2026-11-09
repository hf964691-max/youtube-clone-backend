import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { v2 as cloudinary } from "cloudinary";

import { Video } from "../src/models/video.model.js";
import {
  deleteVideo,
  getAllVideos,
  getVideoById,
  publishVideo,
  togglePublishStatus,
  updateVideo,
} from "../src/controllers/video.controller.js";

const videoId = "507f1f77bcf86cd799439011";
const ownerId = "507f1f77bcf86cd799439012";
const videoUrl =
  "https://res.cloudinary.com/test-cloud/video/upload/v1700000000/videos/video.mp4";
const thumbnailUrl =
  "https://res.cloudinary.com/test-cloud/image/upload/v1700000000/videos/thumbnail.jpg";
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

const createUploadedFile = (name) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "video-controller-"));
  const localPath = path.join(directory, name);
  fs.writeFileSync(localPath, "file");
  return { directory, localPath };
};

const ownedVideo = (overrides = {}) => ({
  _id: videoId,
  videoFile: videoUrl,
  thumbnail: thumbnailUrl,
  title: "Original title",
  description: "Original description",
  duration: 123,
  views: 0,
  isPublished: true,
  owner: { toString: () => ownerId },
  async save() {
    return this;
  },
  async deleteOne() {
    return this;
  },
  ...overrides,
});

test("getAllVideos filters, sorts, and paginates published videos", async () => {
  const originalAggregate = Video.aggregate;
  const originalAggregatePaginate = Video.aggregatePaginate;
  const result = { docs: [{ _id: videoId }], totalDocs: 1 };
  let pipeline;
  let options;

  try {
    Video.aggregate = (stages) => {
      pipeline = stages;
      return { pipeline: stages };
    };
    Video.aggregatePaginate = async (aggregate, paginationOptions) => {
      assert.deepEqual(aggregate.pipeline, pipeline);
      options = paginationOptions;
      return result;
    };

    const { res, error } = await invoke(getAllVideos, {
      query: {},
      params: {},
      user: { _id: ownerId },
    });

    assert.equal(error, undefined);
    assert.equal(res.payload.data, result);
    assert.equal(options.page, 1);
    assert.equal(options.limit, 10);
    assert.deepEqual(pipeline[0].$match, { isPublished: true });

    await invoke(getAllVideos, {
      query: {
        page: "3",
        limit: "500",
        query: "cats.*",
        sortBy: "views",
        sortType: "asc",
        userId: ownerId,
      },
      params: {},
      user: { _id: ownerId },
    });

    assert.equal(options.page, 3);
    assert.equal(options.limit, 100);
    assert.deepEqual(pipeline[0].$match, {
      isPublished: true,
      $or: [
        { title: { $regex: "cats\\.\\*", $options: "i" } },
        { description: { $regex: "cats\\.\\*", $options: "i" } },
      ],
      owner: ownerId,
    });
    assert.deepEqual(pipeline[1].$sort, { views: 1, _id: 1 });
  } finally {
    Video.aggregate = originalAggregate;
    Video.aggregatePaginate = originalAggregatePaginate;
  }
});

test("getAllVideos rejects an invalid user filter", async () => {
  const { res, error } = await invoke(getAllVideos, {
    query: { userId: "invalid" },
    params: {},
  });

  assert.equal(res.payload, undefined);
  assert.equal(error.statusCode, 400);
});

test("publishVideo uploads files and creates a video owned by the user", async () => {
  const originalUpload = cloudinary.uploader.upload;
  const originalCreate = Video.create;
  const videoFile = createUploadedFile("video.mp4");
  const thumbnailFile = createUploadedFile("thumbnail.jpg");
  const uploads = [];
  let payload;

  try {
    cloudinary.uploader.upload = async (filePath, options) => {
      uploads.push({ filePath, options });
      return filePath === videoFile.localPath
        ? { url: videoUrl, duration: 42 }
        : { url: thumbnailUrl };
    };
    Video.create = async (input) => {
      payload = input;
      return { _id: videoId, ...input };
    };

    const { res, error } = await invoke(publishVideo, {
      body: { title: "  Video title ", description: " Description " },
      files: {
        videoFile: [{ path: videoFile.localPath }],
        thumbnail: [{ path: thumbnailFile.localPath }],
      },
      user: { _id: ownerId },
    });

    assert.equal(error, undefined);
    assert.equal(res.statusCode, 201);
    assert.deepEqual(payload, {
      videoFile: videoUrl,
      thumbnail: thumbnailUrl,
      title: "Video title",
      description: "Description",
      duration: 42,
      owner: ownerId,
    });
    assert.equal(uploads.length, 2);
    assert.equal(uploads[0].options.resource_type, "auto");
    assert.equal(fs.existsSync(videoFile.localPath), false);
    assert.equal(fs.existsSync(thumbnailFile.localPath), false);
  } finally {
    cloudinary.uploader.upload = originalUpload;
    Video.create = originalCreate;
    fs.rmSync(videoFile.directory, { recursive: true, force: true });
    fs.rmSync(thumbnailFile.directory, { recursive: true, force: true });
  }
});

test("publishVideo rejects missing files and cleans up an upload if thumbnail upload fails", async () => {
  const originalUpload = cloudinary.uploader.upload;
  const originalDestroy = cloudinary.uploader.destroy;
  const videoFile = createUploadedFile("video.mp4");
  const thumbnailFile = createUploadedFile("thumbnail.jpg");
  const deletedAssets = [];

  try {
    const missingFile = await invoke(publishVideo, {
      body: { title: "Title", description: "Description" },
      files: {},
      user: { _id: ownerId },
    });
    assert.equal(missingFile.error.statusCode, 400);

    cloudinary.uploader.upload = async (filePath) =>
      filePath === videoFile.localPath ? { url: videoUrl, duration: 42 } : null;
    cloudinary.uploader.destroy = async (...args) => {
      deletedAssets.push(args);
      return { result: "ok" };
    };

    const failedThumbnailUpload = await invoke(publishVideo, {
      body: { title: "Title", description: "Description" },
      files: {
        videoFile: [{ path: videoFile.localPath }],
        thumbnail: [{ path: thumbnailFile.localPath }],
      },
      user: { _id: ownerId },
    });

    assert.equal(failedThumbnailUpload.error.statusCode, 400);
    assert.deepEqual(deletedAssets, [
      ["videos/video", { resource_type: "video" }],
    ]);
  } finally {
    cloudinary.uploader.upload = originalUpload;
    cloudinary.uploader.destroy = originalDestroy;
    fs.rmSync(videoFile.directory, { recursive: true, force: true });
    fs.rmSync(thumbnailFile.directory, { recursive: true, force: true });
  }
});

test("getVideoById increments views and populates the owner", async () => {
  const originalFindByIdAndUpdate = Video.findByIdAndUpdate;
  const video = { _id: videoId, views: 1 };
  let call;

  try {
    Video.findByIdAndUpdate = (id, update, options) => {
      call = { id, update, options };
      return {
        populate(path, fields) {
          assert.equal(path, "owner");
          assert.equal(fields, "fullName username avatar");
          return Promise.resolve(video);
        },
      };
    };

    const { res, error } = await invoke(getVideoById, {
      params: { videoId },
    });

    assert.equal(error, undefined);
    assert.deepEqual(call, {
      id: videoId,
      update: { $inc: { views: 1 } },
      options: { new: true },
    });
    assert.equal(res.payload.data, video);
  } finally {
    Video.findByIdAndUpdate = originalFindByIdAndUpdate;
  }
});

test("updateVideo updates owned video fields and replaces its thumbnail", async () => {
  const originalFindById = Video.findById;
  const originalUpload = cloudinary.uploader.upload;
  const originalDestroy = cloudinary.uploader.destroy;
  const newThumbnailUrl =
    "https://res.cloudinary.com/test-cloud/image/upload/v1700000001/videos/new-thumbnail.jpg";
  const imageFile = createUploadedFile("new-thumbnail.jpg");
  const video = ownedVideo();
  let deletedAssets = [];

  try {
    Video.findById = async () => video;
    cloudinary.uploader.upload = async () => ({ url: newThumbnailUrl });
    cloudinary.uploader.destroy = async (...args) => {
      deletedAssets.push(args);
      return { result: "ok" };
    };

    const { res, error } = await invoke(updateVideo, {
      params: { videoId },
      body: { title: " New title " },
      file: { path: imageFile.localPath },
      user: { _id: ownerId },
    });

    assert.equal(error, undefined);
    assert.equal(video.title, "New title");
    assert.equal(video.thumbnail, newThumbnailUrl);
    assert.equal(res.payload.data, video);
    assert.deepEqual(deletedAssets, [
      ["videos/thumbnail", { resource_type: "image" }],
    ]);
    assert.equal(fs.existsSync(imageFile.localPath), false);
  } finally {
    Video.findById = originalFindById;
    cloudinary.uploader.upload = originalUpload;
    cloudinary.uploader.destroy = originalDestroy;
    fs.rmSync(imageFile.directory, { recursive: true, force: true });
  }
});

test("updateVideo rejects empty updates and non-owner changes", async () => {
  const originalFindById = Video.findById;

  try {
    Video.findById = async () => ownedVideo();
    const noFields = await invoke(updateVideo, {
      params: { videoId },
      body: {},
      user: { _id: ownerId },
    });
    assert.equal(noFields.error.statusCode, 400);

    Video.findById = async () =>
      ownedVideo({ owner: { toString: () => "507f1f77bcf86cd799439099" } });
    const forbidden = await invoke(updateVideo, {
      params: { videoId },
      body: { title: "New title" },
      user: { _id: ownerId },
    });
    assert.equal(forbidden.error.statusCode, 403);
  } finally {
    Video.findById = originalFindById;
  }
});

test("deleteVideo deletes cloud assets and the owned video", async () => {
  const originalFindById = Video.findById;
  const originalDestroy = cloudinary.uploader.destroy;
  const video = ownedVideo();
  const deletedAssets = [];
  let deletedVideo = false;
  video.deleteOne = async () => {
    deletedVideo = true;
  };

  try {
    Video.findById = async () => video;
    cloudinary.uploader.destroy = async (...args) => {
      deletedAssets.push(args);
      return { result: "ok" };
    };

    const { res, error } = await invoke(deleteVideo, {
      params: { videoId },
      user: { _id: ownerId },
    });

    assert.equal(error, undefined);
    assert.equal(deletedVideo, true);
    assert.deepEqual(deletedAssets, [
      ["videos/video", { resource_type: "video" }],
      ["videos/thumbnail", { resource_type: "image" }],
    ]);
    assert.deepEqual(res.payload.data, {});
  } finally {
    Video.findById = originalFindById;
    cloudinary.uploader.destroy = originalDestroy;
  }
});

test("togglePublishStatus flips status for the video owner", async () => {
  const originalFindById = Video.findById;
  const video = ownedVideo({ isPublished: true });
  let saved = false;
  video.save = async function () {
    saved = true;
    return this;
  };

  try {
    Video.findById = async () => video;
    const { res, error } = await invoke(togglePublishStatus, {
      params: { videoId },
      user: { _id: ownerId },
    });

    assert.equal(error, undefined);
    assert.equal(saved, true);
    assert.equal(video.isPublished, false);
    assert.equal(res.payload.data, video);
  } finally {
    Video.findById = originalFindById;
  }
});
