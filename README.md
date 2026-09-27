# YouTube Clone Backend

A JavaScript backend foundation for a YouTube-style application. The project currently includes an Express server setup, MongoDB connection, and common request middleware. Feature routes and API endpoints have not been added yet.

## Tech Stack

- Node.js with ES modules
- Express 5
- MongoDB with Mongoose
- CORS, cookie-parser, and dotenv

## Prerequisites

- Node.js and npm
- A MongoDB instance and connection URI

## Getting Started

Install the project dependencies:

```bash
npm install
```

Create a `.env` file in the project root for local development:

```env
MONGODB_URI=mongodb://127.0.0.1:27017
PORT=8000
CORS_ORIGIN=http://localhost:3000
```

The application appends the database name `videotube` to `MONGODB_URI`. For example, the URI above connects to `mongodb://127.0.0.1:27017/videotube`.

Start the development server:

```bash
npm run dev
```

The development script preloads variables from the root `.env` file and restarts the server when source files change. The `npm start` script runs Node.js directly; provide its environment variables through your deployment environment. The current startup code also attempts to load `/env`, so `npm start` does not automatically load the project-root `.env` file.

## Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Run the server with Nodemon and preload `.env` variables. |
| `npm start` | Run the server directly with Node.js. |

## Current Application Setup

The Express application currently configures:

- CORS using `CORS_ORIGIN`, with credentials enabled
- JSON and URL-encoded request parsing, limited to 16 KB per body
- Static file serving from `public/`
- Cookie parsing
- MongoDB connection before the server begins listening

No API routes are currently registered, so application endpoints are not available yet.

## Project Structure

```text
src/
├── app.js                 # Express app and middleware configuration
├── constants.js           # Shared constants, including the database name
├── index.js               # Environment setup, database connection, and server startup
├── controllers/           # Request handlers (planned)
├── db/
│   └── index.js            # MongoDB connection
├── middlewares/           # Custom Express middleware (planned)
├── models/                # Mongoose models (planned)
├── routes/                # API routes (planned)
└── utils/
	├── ApiError.js         # Custom API error type
	├── ApiResponse.js      # Standard API response shape
	└── asyncHandler.js     # Async route-handler utility
```

## Configuration Reference

| Variable | Required | Description |
| --- | --- | --- |
| `MONGODB_URI` | Yes | MongoDB connection URI without the database name. |
| `PORT` | No | HTTP port; defaults to `8000`. |
| `CORS_ORIGIN` | Yes | Origin allowed to make credentialed cross-origin requests. |

## Project Status

This repository is an initial backend scaffold. User authentication, video management, channels, subscriptions, comments, and other application features still need to be implemented.