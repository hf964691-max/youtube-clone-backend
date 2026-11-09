import { isValidObjectId } from "mongoose";
import { Playlist } from "../models/playlist.model.js";
import { Video } from "../models/video.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getOwnedPlaylist = async (playlistId, userId) => {
  if (!isValidObjectId(playlistId)) {
    throw new ApiError(400, "Invalid playlist ID");
  }

  const playlist = await Playlist.findById(playlistId);

  if (!playlist) {
    throw new ApiError(404, "Playlist not found");
  }

  if (playlist.owner?.toString() !== userId.toString()) {
    throw new ApiError(403, "You are not allowed to modify this playlist");
  }

  return playlist;
};

const createPlaylist = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  if (typeof name !== "string" || !name.trim()) {
    throw new ApiError(400, "Playlist name is required");
  }

  if (typeof description !== "string" || !description.trim()) {
    throw new ApiError(400, "Playlist description is required");
  }

  const playlist = await Playlist.create({
    name: name.trim(),
    description: description.trim(),
    owner: req.user._id,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, playlist, "Playlist created successfully"));
});

const getUserPlaylists = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (!isValidObjectId(userId)) {
    throw new ApiError(400, "Invalid user ID");
  }

  const playlists = await Playlist.find({ owner: userId })
    .populate("videos")
    .sort({ createdAt: -1 });

  return res
    .status(200)
    .json(new ApiResponse(200, playlists, "Playlists fetched successfully"));
});

const getPlaylistById = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;

  if (!isValidObjectId(playlistId)) {
    throw new ApiError(400, "Invalid playlist ID");
  }

  const playlist = await Playlist.findById(playlistId)
    .populate("videos")
    .populate("owner", "fullName username avatar");

  if (!playlist) {
    throw new ApiError(404, "Playlist not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, playlist, "Playlist fetched successfully"));
});

const addVideoToPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;
  const playlist = await getOwnedPlaylist(playlistId, req.user._id);

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video ID");
  }

  const videoExists = await Video.exists({ _id: videoId });

  if (!videoExists) {
    throw new ApiError(404, "Video not found");
  }

  if (!playlist.videos.some((id) => id.toString() === videoId)) {
    playlist.videos.push(videoId);
    await playlist.save();
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, playlist, "Video added to playlist successfully")
    );
});

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;
  const playlist = await getOwnedPlaylist(playlistId, req.user._id);

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video ID");
  }

  playlist.videos = playlist.videos.filter((id) => id.toString() !== videoId);
  await playlist.save();

  return res
    .status(200)
    .json(
      new ApiResponse(200, playlist, "Video removed from playlist successfully")
    );
});

const deletePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  const playlist = await getOwnedPlaylist(playlistId, req.user._id);

  await playlist.deleteOne();

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Playlist deleted successfully"));
});

const updatePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  const { name, description } = req.body;
  const playlist = await getOwnedPlaylist(playlistId, req.user._id);

  if (name === undefined && description === undefined) {
    throw new ApiError(400, "At least one playlist field is required");
  }

  if (name !== undefined) {
    if (typeof name !== "string" || !name.trim()) {
      throw new ApiError(400, "Playlist name is required");
    }
    playlist.name = name.trim();
  }

  if (description !== undefined) {
    if (typeof description !== "string" || !description.trim()) {
      throw new ApiError(400, "Playlist description is required");
    }
    playlist.description = description.trim();
  }

  await playlist.save();

  return res
    .status(200)
    .json(new ApiResponse(200, playlist, "Playlist updated successfully"));
});

export {
  createPlaylist,
  getUserPlaylists,
  getPlaylistById,
  addVideoToPlaylist,
  removeVideoFromPlaylist,
  deletePlaylist,
  updatePlaylist,
};
