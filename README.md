
## Getting Started

### Prerequisites
- Node.js 18+
- MongoDB running locally, or a free MongoDB Atlas cluster
- Optional: a Cloudinary account for avatar and image uploads

### 1. Install dependencies

```bash
npm run install:all
# or manually:
cd backend && npm install
cd ../frontend && npm install
```

### 2. Configure environment variables

```bash
cd backend && cp .env.example .env
cd ../frontend && cp .env.example .env
```
Fill in `MONGO_URI`, `JWT_SECRET`, and optionally Cloudinary credentials and `INVITE_CODE` — see [Environment Variables](#environment-variables).

### 3. Run in development

Open two terminals:

```bash
# Terminal 1 — backend (http://localhost:5000)
cd backend && npm run dev

# Terminal 2 — frontend (http://localhost:5173)
cd frontend && npm run dev
```

Visit `http://localhost:5173`, register an account (or message the built-in bot contact right away), and open a second account in an incognito window to test real-time chat between two real users.

### 4. Production build

```bash
cd frontend && npm run build   # outputs frontend/dist
cd ../backend && NODE_ENV=production npm start
```
With `NODE_ENV=production`, the Express server also serves the built React app from the same origin, so the whole app deploys as a single service.

## Deploying to Render

The backend serves the built frontend from the same origin in production, so the simplest deployment is one Render Web Service for the whole app — no separate frontend hosting, and no cross-origin cookie issues.

### 1. Push the project to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/chat-app.git
git push -u origin main
```

### 2. Get a MongoDB connection string

Use a free MongoDB Atlas cluster: create one, add a database user, allow access from anywhere (`0.0.0.0/0`) under Network Access, then copy the connection string.

### 3. Create the Render service

Go to render.com, New → Web Service, connect the repo, and set:

| Setting        | Value                    |
|-----------------|---------------------------|
| Build Command     | `npm run render-build`  |
| Start Command       | `npm start`            |
| Node version           | 18+                   |

### 4. Add environment variables

| Key                    | Value                                                   |
|--------------------------|-------------------------------------------------------------|
| `NODE_ENV`                 | `production`                                            |
| `MONGO_URI`                  | your Atlas connection string                         |
| `JWT_SECRET`                   | any long random string                                |
| `JWT_EXPIRES_IN`                 | `7d`                                                |
| `CLIENT_URL`                       | your Render URL, e.g. `https://chat-app.onrender.com` |
| `INVITE_CODE`                        | optional — set this to require a code at registration; leave unset for open signup |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | optional, only needed for image uploads |

### 5. Deploy

Click Create Web Service. Render runs the build, then the start command, and gives you a live URL. Every push to your connected branch triggers an automatic redeploy.

**Notes:**
- Free-tier Render services spin down after inactivity — the first request after idling can take 30 to 50 seconds to wake back up.
- Free-tier MongoDB Atlas clusters (M0) cap out at 512 MB of storage.
- If you ever split the frontend into its own separate static host rather than serving it from the backend, change the cookie's `sameSite` setting to `"none"` (keeping `secure: true`) in `backend/utils/generateToken.js`, since the two would then be on different domains.

## Environment Variables

**backend/.env**

| Variable                | Description                                              |
|--------------------------|------------------------------------------------------------|
| `PORT`                    | Port for the Express server (default `5000`)              |
| `MONGO_URI`                | MongoDB connection string                                |
| `JWT_SECRET`                | Secret used to sign JWTs — use a long random string      |
| `JWT_EXPIRES_IN`             | Token lifetime (default `7d`)                            |
| `CLIENT_URL`                  | Frontend origin, used for CORS and cookie settings        |
| `INVITE_CODE`                   | Optional — if set, registration requires this code       |
| `CLOUDINARY_CLOUD_NAME`           | Optional, for image uploads                          |
| `CLOUDINARY_API_KEY`                | Optional                                          |
| `CLOUDINARY_API_SECRET`               | Optional                                        |

**frontend/.env**

| Variable        | Description                        |
|-------------------|---------------------------------------|
| `VITE_API_URL`      | Base URL of the backend (default `http://localhost:5000`) |

## API Reference

All endpoints are prefixed with `/api`. Authenticated routes require the `jwt` httpOnly cookie, set automatically on login or registration.

### Auth
| Method | Endpoint         | Description                     |
|--------|-------------------|----------------------------------|
| POST   | `/auth/register`   | Create an account (requires invite code if `INVITE_CODE` is set); returns user and sets cookie |
| POST   | `/auth/login`        | Log in with email or username plus password |
| POST   | `/auth/logout`         | Clear the auth cookie          |
| GET    | `/auth/me`              | Get the current logged-in user |

### Bot (public, no auth required)
| Method | Endpoint      | Description                                |
|--------|-----------------|-----------------------------------------------|
| POST   | `/bot/chat`       | Send a message to the guest demo bot; nothing is persisted |

### Users
| Method | Endpoint          | Description                       |
|--------|--------------------|-------------------------------------|
| GET    | `/users`             | List all users except yourself   |
| GET    | `/users/search?query=`| Search users by name, username, or email |
| PUT    | `/users/profile`        | Update your name, bio, and avatar |
| PUT    | `/users/status`           | Update your custom status (online, away, busy) |
| GET    | `/users/blocked`            | List users you've blocked      |
| POST   | `/users/block/:id`            | Block a user                 |
| DELETE | `/users/block/:id`              | Unblock a user              |

### Conversations
| Method | Endpoint             | Description                          |
|--------|-----------------------|-----------------------------------------|
| POST   | `/conversations`        | Find or create a one-on-one conversation |
| GET    | `/conversations`          | List your conversations, sorted by latest activity |
| POST   | `/conversations/group`      | Create a group |

### Messages
| Method | Endpoint                     | Description                                |
|--------|--------------------------------|-----------------------------------------------|
| POST   | `/messages`                      | Send a message |
| GET    | `/messages/:conversationId`         | Paginated message history |
| GET    | `/messages/unread-counts`              | Per-conversation unread counts, used to persist badges across refreshes |
| PUT    | `/messages/read`                       | Mark messages as read |
| PUT    | `/messages/:messageId`                    | Edit a message you sent |
| DELETE | `/messages/:messageId`                       | Delete a message you sent (soft delete) |
| POST   | `/messages/:messageId/react`                    | Add or remove your reaction on a message |

## Socket.IO Events

| Event               | Direction        | Purpose |
|----------------------|--------------------|-----------|
| `getOnlineUsers`       | server to client    | Presence |
| `joinConversation` / `leaveConversation` | client to server | Join or leave a room to receive that chat's events |
| `sendMessage`               | client to server    | Broadcast a new message |
| `newMessage`                   | server to client    | Deliver a message in real time |
| `typing` / `stopTyping`          | client to server    | Typing indicator |
| `userTyping` / `userStopTyping`    | server to client    | Render "typing..." |
| `messagesRead`                        | server to client    | Update ticks to "read" |
| `messageEdited`                          | server to client    | Sync an edited message |
| `messageDeleted`                            | server to client    | Sync a deleted message |
| `messageReacted`                              | server to client    | Sync a reaction change |

## Data Models

**User** — full name, username, email, hashed password, avatar, bio, online status, custom status (online/away/busy), last seen, privacy settings, blocked users list

**Conversation** — group flag, group name, group avatar, participants, admins, last message

**Message** — conversation, sender, text, image, status (sent, delivered, read), read-by list, reactions, edited flag, deleted flag

## Security Notes

- Passwords are hashed with bcrypt before storage; the raw password is never persisted or returned.
- JWTs live in httpOnly, sameSite-strict cookies, not localStorage, so they aren't readable by client-side JavaScript.
- Every REST route (except register and login) and every socket connection is authenticated server-side; a user cannot fetch or act on a conversation they don't belong to, and blocked users are prevented from messaging each other.
- CORS is locked to `CLIENT_URL` with credentials enabled.
- Registration can be gated behind an invite code via the `INVITE_CODE` environment variable, useful for limiting public sign-ups after sharing the app link.

This is a portfolio and learning project — before using it in production at scale, add rate limiting, stricter input sanitization, and monitor free-tier database and hosting limits under real traffic.

## Roadmap

- Reply-to and forward message actions
- Pinned chats
- Message and conversation search

---

Built as a demonstration of real-time full-stack architecture with the MERN stack and Socket.IO.