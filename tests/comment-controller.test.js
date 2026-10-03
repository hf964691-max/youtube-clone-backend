import test from "node:test";
import assert from "node:assert/strict";

import { Comment } from "../src/models/comment.model.js";
import {
  addComment,
  getVideoComments,
  updateComment,
  deleteComment,
} from "../src/controllers/comment.controller.js";

test("addComment creates a comment for a video", async () => {
  const originalCreate = Comment.create;
  const originalFindById = Comment.findById;

  Comment.create = async (payload) => ({
    _id: "comment-1",
    ...payload,
  });
  Comment.findById = () => ({
    _id: "comment-1",
    content: "Nice video!",
    owner: { fullName: "Test User", username: "testuser", avatar: "avatar-url" },
    populate() {
      return this;
    },
  });

  const req = {
    body: { content: "Nice video!" },
    params: { videoId: "507f1f77bcf86cd799439011" },
    user: { _id: "507f1f77bcf86cd799439012" },
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

  addComment(req, res, () => {});
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(res.statusCode, 201);
  assert.equal(res.payload.data.content, "Nice video!");

  Comment.create = originalCreate;
  Comment.findById = originalFindById;
});

test("getVideoComments returns comments for a video with pagination", async () => {
  const originalFind = Comment.find;
  const originalCountDocuments = Comment.countDocuments;
  const mockQuery = {
    populate() {
      return this;
    },
    sort() {
      return this;
    },
    skip() {
      return this;
    },
    limit() {
      return this;
    },
    exec: async () => [{ _id: "comment-1", content: "Great" }],
  };

  Comment.find = () => mockQuery;
  Comment.countDocuments = async () => 1;

  const req = {
    params: { videoId: "507f1f77bcf86cd799439011" },
    query: { page: "1", limit: "10" },
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

  getVideoComments(req, res, () => {});
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.data.comments.length, 1);

  Comment.find = originalFind;
  Comment.countDocuments = originalCountDocuments;
});

test("updateComment requires ownership before editing", async () => {
  const originalFindById = Comment.findById;
  Comment.findById = async () => ({
    owner: { toString: () => "507f1f77bcf86cd799439012" },
    content: "old text",
    save: async function () {
      this.content = "new text";
      return this;
    },
  });

  const req = {
    params: { commentId: "507f1f77bcf86cd799439013" },
    body: { content: "new text" },
    user: { _id: "507f1f77bcf86cd799439012" },
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

  updateComment(req, res, () => {});
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.data.content, "new text");

  Comment.findById = originalFindById;
});

test("deleteComment removes a comment owned by the current user", async () => {
  const originalFindById = Comment.findById;
  Comment.findById = async () => ({
    owner: { toString: () => "507f1f77bcf86cd799439012" },
    deleteOne: async function () {
      return this;
    },
  });

  const req = {
    params: { commentId: "507f1f77bcf86cd799439013" },
    user: { _id: "507f1f77bcf86cd799439012" },
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

  deleteComment(req, res, () => {});
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(res.statusCode, 200);

  Comment.findById = originalFindById;
});
