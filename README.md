# YouTube Clone Backend

A Node.js + Express + MongoDB backend for a YouTube-style application. This repository is a backend scaffold and starter project for building a video-sharing platform with authentication, user profiles, video management, subscriptions, likes, comments, playlists, tweets, and dashboard analytics.

## Tech Stack

- Node.js
- Express 5
- MongoDB + Mongoose
- JWT for authentication
- Cloudinary for media uploads
- Multer for file uploads
- Cookie-based auth support
- CORS and dotenv

## Current Project Status

This project is in active development. The backend already includes the foundation for a full YouTube-like product, including:

- User registration, login, logout, token refresh, and password changes
- JWT-based authentication middleware
- User profile and channel data handling
- Upload support for avatar and cover images
- Standardized API response/error utilities
- Route and controller scaffolding for videos, subscriptions, likes, comments, playlists, tweets, and dashboard stats

Several feature controllers are still in progress and contain TODOs, so the project is best treated as a backend starter or learning project rather than a production-ready application.

## Prerequisites

- Node.js 18+
- npm
- MongoDB instance running locally or remotely
- Cloudinary account (for media uploads)

## Environment Variables

Create a `.env` file in the project root:

```env
PORT=8000
MONGODB_URI=mongodb://127.0.0.1:27017
CORS_ORIGIN=http://localhost:3000
ACCESS_TOKEN_SECRET=your_access_token_secret
REFRESH_TOKEN_SECRET=your_refresh_token_secret
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

The app appends the database name `videotube` to `MONGODB_URI`, so the example above connects to `mongodb://127.0.0.1:27017/videotube`.

## Getting Started

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Start the server without nodemon:

```bash
npm start
```

## Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Starts the app with nodemon and loads `.env` values. |
| `npm start` | Starts the app directly with Node.js. |

## Project Structure

```text
src/
├── app.js                     # Express app and middleware setup
├── constants.js               # Shared constants
├── index.js                   # DB connection and server bootstrap
├── controllers/               # Route handlers
│   ├── dashboard.controller.js
│   ├── user.controller.js
│   ├── video.controller.js
│   ├── comment.controller.js
│   ├── like.controller.js
│   ├── playlist.controller.js
│   ├── subscription.controller.js
│   ├── tweet.controller.js
│   └── healthcheck.controller.js
├── db/
│   └── index.js               # MongoDB connection helper
├── middlewares/
│   ├── auth.middleware.js     # JWT verification middleware
│   └── multer.middleware.js   # File upload middleware
├── models/
│   ├── user.model.js
│   ├── video.model.js
│   ├── comment.model.js
│   ├── like.model.js
│   ├── playlist.model.js
│   ├── subscription.model.js
│   └── tweet.model.js
├── routes/
│   ├── user.routes.js
│   ├── dashboard.routes.js
│   ├── video.routes.js
│   ├── comment.routes.js
│   ├── like.routes.js
│   ├── playlist.routes.js
│   ├── subscription.routes.js
│   ├── tweet.routes.js
│   └── healthcheck.routes.js
├── utils/
│   ├── ApiError.js            # Standardized error responses
│   ├── ApiResponse.js         # Standardized success responses
│   ├── asyncHandler.js        # Async error wrapper
│   └── cloudinary.js          # Cloudinary upload utility
└── public/                    # Static files served by Express
```

## API Routes

The app currently mounts the user routes at `/api/v1/users`.

### User Routes

| Method | Route | Status |
| --- | --- | --- |
| `POST` | `/api/v1/users/register` | Implemented |
| `POST` | `/api/v1/users/login` | Implemented |
| `POST` | `/api/v1/users/logout` | Implemented |
| `POST` | `/api/v1/users/refresh-token` | Implemented |
| `POST` | `/api/v1/users/change-password` | Implemented |
| `GET` | `/api/v1/users/current-user` | Implemented |
| `PATCH` | `/api/v1/users/update-account` | Implemented |
| `PATCH` | `/api/v1/users/avatar` | Implemented |
| `PATCH` | `/api/v1/users/cover-image` | Implemented |
| `GET` | `/api/v1/users/c/:username` | Implemented |
| `GET` | `/api/v1/users/history` | Implemented |

### Planned Route Modules

These route files exist in the project and outline further feature work:

- `/api/v1/videos` for video upload, retrieval, publishing, and updates
- `/api/v1/comments` for comments on videos
- `/api/v1/likes` for like toggling and liked-video queries
- `/api/v1/playlists` for playlist management
- `/api/v1/subscriptions` for subscription actions
- `/api/v1/tweets` for tweet CRUD
- `/api/v1/dashboard` for channel stats and channel videos
- `/api/v1/healthcheck` for health verification

## Notes

- The project includes a reusable `asyncHandler` helper to wrap Express route functions.
- API responses are standardized via `ApiResponse` and `ApiError` utilities.
- Some route handlers are still scaffolds and are intended to be completed as part of the project build.
- The app currently does not mount every route defined in `src/routes`, so additional endpoints will need to be registered in `src/app.js` as the backend expands.

## Roadmap

Planned major milestones for this project include:

- Complete video CRUD and publish flow
- Channel analytics and dashboard endpoints
- Comment, tweet, subscription, and like logic
- Playlist creation and management
- Watch history and user activity tracking
- Frontend integration with a React or Next.js client

## License

This project is currently unlicensed and intended for learning and experimentation.