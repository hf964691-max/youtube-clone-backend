import test from "node:test";
import assert from "node:assert/strict";

import { Playlist } from "../src/models/playlist.model.js";
import { Video } from "../src/models/video.model.js";
import {
  addVideoToPlaylist,
  createPlaylist,
  deletePlaylist,
  getPlaylistById,
  getUserPlaylists,
  removeVideoFromPlaylist,
  updatePlaylist,
} from "../src/controllers/playlist.controller.js";

const playlistId = "507f1f77bcf86cd799439011";
const videoId = "507f1f77bcf86cd799439012";
const userId = "507f1f77bcf86cd799439013";

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

const ownedPlaylist = (overrides = {}) => ({
  _id: playlistId,
  name: "Favorites",
  description: "My saved videos",
  videos: [],
  owner: { toString: () => userId },
  async save() {
    return this;
  },
  async deleteOne() {
    return this;
  },
  ...overrides,
});

test("createPlaylist validates and creates a playlist for the current user", async () => {
  const originalCreate = Playlist.create;

  try {
    let created;
    Playlist.create = async (payload) => {
      created = payload;
      return payload;
    };

    const { res, error } = await invoke(createPlaylist, {
      body: { name: "  Favorites  ", description: "  Saved videos  " },
      user: { _id: userId },
    });

    assert.equal(error, undefined);
    assert.equal(res.statusCode, 201);
    assert.deepEqual(created, {
      name: "Favorites",
      description: "Saved videos",
      owner: userId,
    });
    assert.deepEqual(res.payload.data, created);
  } finally {
    Playlist.create = originalCreate;
  }
});

test("createPlaylist rejects missing required fields", async () => {
  const { res, error } = await invoke(createPlaylist, {
    body: { name: "  ", description: "Description" },
    user: { _id: userId },
  });

  assert.equal(res.payload, undefined);
  assert.equal(error.statusCode, 400);
});

test("getUserPlaylists validates the user ID and returns their playlists", async () => {
  const originalFind = Playlist.find;
  const playlists = [{ _id: playlistId }];
  const calls = [];

  try {
    Playlist.find = (filter) => {
      calls.push(["find", filter]);
      return {
        populate(path) {
          calls.push(["populate", path]);
          return {
            sort(sort) {
              calls.push(["sort", sort]);
              return Promise.resolve(playlists);
            },
          };
        },
      };
    };

    const { res, error } = await invoke(getUserPlaylists, {
      params: { userId },
    });

    assert.equal(error, undefined);
    assert.deepEqual(res.payload.data, playlists);
    assert.deepEqual(calls, [
      ["find", { owner: userId }],
      ["populate", "videos"],
      ["sort", { createdAt: -1 }],
    ]);

    const invalid = await invoke(getUserPlaylists, {
      params: { userId: "invalid" },
    });
    assert.equal(invalid.error.statusCode, 400);
  } finally {
    Playlist.find = originalFind;
  }
});

test("getPlaylistById returns a playlist with videos and owner populated", async () => {
  const originalFindById = Playlist.findById;
  const playlist = { _id: playlistId };
  const calls = [];

  try {
    Playlist.findById = (id) => {
      calls.push(["findById", id]);
      return {
        populate(path, select) {
          calls.push(["populate", path, select]);
          return {
            populate(ownerPath, ownerSelect) {
              calls.push(["populate", ownerPath, ownerSelect]);
              return Promise.resolve(playlist);
            },
          };
        },
      };
    };

    const { res, error } = await invoke(getPlaylistById, {
      params: { playlistId },
    });

    assert.equal(error, undefined);
    assert.equal(res.payload.data, playlist);
    assert.deepEqual(calls, [
      ["findById", playlistId],
      ["populate", "videos", undefined],
      ["populate", "owner", "fullName username avatar"],
    ]);
  } finally {
    Playlist.findById = originalFindById;
  }
});

test("addVideoToPlaylist adds an existing video once for the playlist owner", async () => {
  const originalFindById = Playlist.findById;
  const originalVideoExists = Video.exists;
  const playlist = ownedPlaylist();
  let saves = 0;
  playlist.save = async function () {
    saves += 1;
    return this;
  };

  try {
    Playlist.findById = async () => playlist;
    Video.exists = async () => true;

    const req = {
      params: { playlistId, videoId },
      user: { _id: userId },
    };
    const { res, error } = await invoke(addVideoToPlaylist, req);

    assert.equal(error, undefined);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(playlist.videos, [videoId]);
    assert.equal(saves, 1);

    await invoke(addVideoToPlaylist, req);
    assert.deepEqual(playlist.videos, [videoId]);
    assert.equal(saves, 1);
  } finally {
    Playlist.findById = originalFindById;
    Video.exists = originalVideoExists;
  }
});

test("addVideoToPlaylist rejects missing videos and playlists owned by another user", async () => {
  const originalFindById = Playlist.findById;
  const originalVideoExists = Video.exists;

  try {
    Playlist.findById = async () => ownedPlaylist();
    Video.exists = async () => false;
    const missingVideo = await invoke(addVideoToPlaylist, {
      params: { playlistId, videoId },
      user: { _id: userId },
    });
    assert.equal(missingVideo.error.statusCode, 404);

    Playlist.findById = async () =>
      ownedPlaylist({ owner: { toString: () => "507f1f77bcf86cd799439099" } });
    const forbidden = await invoke(addVideoToPlaylist, {
      params: { playlistId, videoId },
      user: { _id: userId },
    });
    assert.equal(forbidden.error.statusCode, 403);
  } finally {
    Playlist.findById = originalFindById;
    Video.exists = originalVideoExists;
  }
});

test("removeVideoFromPlaylist removes the video and saves the playlist", async () => {
  const originalFindById = Playlist.findById;
  const playlist = ownedPlaylist({
    videos: [videoId, "507f1f77bcf86cd799439014"],
  });
  let saved = false;
  playlist.save = async function () {
    saved = true;
    return this;
  };

  try {
    Playlist.findById = async () => playlist;
    const { res, error } = await invoke(removeVideoFromPlaylist, {
      params: { playlistId, videoId },
      user: { _id: userId },
    });

    assert.equal(error, undefined);
    assert.equal(saved, true);
    assert.deepEqual(playlist.videos, ["507f1f77bcf86cd799439014"]);
    assert.equal(res.payload.data, playlist);
  } finally {
    Playlist.findById = originalFindById;
  }
});

test("deletePlaylist only deletes a playlist belonging to the current user", async () => {
  const originalFindById = Playlist.findById;
  const playlist = ownedPlaylist();
  let deleted = false;
  playlist.deleteOne = async () => {
    deleted = true;
  };

  try {
    Playlist.findById = async () => playlist;
    const { res, error } = await invoke(deletePlaylist, {
      params: { playlistId },
      user: { _id: userId },
    });

    assert.equal(error, undefined);
    assert.equal(deleted, true);
    assert.deepEqual(res.payload.data, {});
  } finally {
    Playlist.findById = originalFindById;
  }
});

test("updatePlaylist trims supplied fields and requires owner access", async () => {
  const originalFindById = Playlist.findById;
  const playlist = ownedPlaylist();
  let saved = false;
  playlist.save = async function () {
    saved = true;
    return this;
  };

  try {
    Playlist.findById = async () => playlist;
    const { res, error } = await invoke(updatePlaylist, {
      params: { playlistId },
      body: { name: "  New name  " },
      user: { _id: userId },
    });

    assert.equal(error, undefined);
    assert.equal(saved, true);
    assert.equal(playlist.name, "New name");
    assert.equal(playlist.description, "My saved videos");
    assert.equal(res.payload.data, playlist);

    Playlist.findById = async () =>
      ownedPlaylist({ owner: { toString: () => "507f1f77bcf86cd799439099" } });
    const forbidden = await invoke(updatePlaylist, {
      params: { playlistId },
      body: { name: "Other name" },
      user: { _id: userId },
    });
    assert.equal(forbidden.error.statusCode, 403);
  } finally {
    Playlist.findById = originalFindById;
  }
});
