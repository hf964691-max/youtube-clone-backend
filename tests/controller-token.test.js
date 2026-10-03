import test from "node:test";
import assert from "node:assert/strict";

import { User } from "../src/models/user.model.js";
import { generateAccessAndRefreshTokens } from "../src/controllers/user.controller.js";

test("generateAccessAndRefreshTokens returns a refresh token under the correct property", async () => {
  const originalFindById = User.findById;
  const mockUser = {
    _id: "user-123",
    generateAccessToken: () => "access-token",
    generateRefreshToken: () => "refresh-token",
    save: async () => {},
    refreshToken: "",
  };

  User.findById = async () => mockUser;

  try {
    const result = await generateAccessAndRefreshTokens("user-123");

    assert.deepEqual(result, {
      accessToken: "access-token",
      refreshToken: "refresh-token",
    });
    assert.equal(mockUser.refreshToken, "refresh-token");
  } finally {
    User.findById = originalFindById;
  }
});
