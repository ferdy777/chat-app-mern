# ChatApp — A Real-Time Chat App (MERN + Socket.IO)

A full-stack, real-time messaging application built with **MongoDB, Express, React, and Node.js**, using **Socket.IO** for live communication. It replicates core WhatsApp Web functionality: instant 1-on-1 and group messaging, online/offline presence, typing indicators, read receipts, and image sharing.

---

## Table of Contents

1. [Problem It Solves](#problem-it-solves)
2. [Features](#features)
3. [Tech Stack](#tech-stack)
4. [Architecture](#architecture)
5. [Project Structure](#project-structure)
6. [Getting Started](#getting-started)
7. [Environment Variables](#environment-variables)
8. [API Reference](#api-reference)
9. [Socket.IO Events](#socketio-events)
10. [Data Models](#data-models)
11. [Security Notes](#security-notes)
12. [Roadmap](#roadmap)

---

## Problem It Solves

Most chat tutorials stop at "send a message and see it appear." Real messaging apps need much more: knowing who's online right now, seeing when someone is typing, confirming a message was actually delivered and read, and doing all of this without refreshing the page or polling the server every few seconds.

This project solves that end-to-end:

- **No polling, no lag** — messages, typing status, and presence all travel over a persistent WebSocket connection (Socket.IO), so updates are instant instead of "refresh to see new messages."
- **Real authentication, not a demo login** — JWTs stored in httpOnly cookies protect both the REST API and the socket handshake, so the same session security applies everywhere.
- **State that actually reflects reality** — online/offline status, delivered/read ticks, and typing indicators are derived from live socket connections, not guessed from timestamps.
- **A foundation, not a toy** — the data model (Users, Conversations, Messages) supports both 1-on-1 and group chat from day one, so extending it doesn't mean rewriting the schema.

## Features

- 🔐 **Authentication** — Register/login with JWT stored in an httpOnly cookie (protected against XSS token theft)
- 💬 **Real-time messaging** — Instant delivery via Socket.IO, no page refresh or polling
- 👥 **1-on-1 and group conversations** — create groups with multiple members from the UI
- 🟢 **Online/offline presence** — Live indicator per user
- ⌨️ **Typing indicators**
- ✔️✔️ **Read receipts** (sent / delivered / read, WhatsApp-style ticks)
- 🖼️ **Image messages** — Uploaded via Cloudinary
- 👤 **Profile settings** — Edit your name, bio, and avatar
- 🔍 **User search** — Find people by name, username, or email to start a chat
- 📱 **Fully responsive UI** — on phones the chat list and open conversation swap full-screen with a back button, just like the WhatsApp mobile app
- 🌗 **Light & dark theme** — toggle from the sidebar (light / dark / follow system), built with shadcn/ui + Radix primitives and CSS-variable theming, persisted across sessions
- 🗃️ **Paginated message history**

## Tech Stack

| Layer          | Technology                                            |
|----------------|--------------------------------------------------------|
| Frontend       | React 18, Vite, Tailwind CSS, shadcn/ui (Radix primitives), React Router, Axios |
| UI components  | shadcn/ui — Button, Input, Dialog, DropdownMenu, Avatar, Switch, Textarea, Label, Separator, all built on Radix UI |
| Theming        | CSS-variable-based light/dark/system theme, toggle persisted to `localStorage` |
| Real-time      | Socket.IO (client + server)                            |
| Backend        | Node.js, Express                                        |
| Database       | MongoDB with Mongoose ODM                               |
| Auth           | JSON Web Tokens (httpOnly cookies) + bcrypt password hashing |
| Media storage  | Cloudinary (optional, for avatars & image messages)     |
| Notifications  | react-hot-toast                                          |

## Architecture

```
┌──────────────┐        HTTPS (REST /api/...)        ┌──────────────┐
│              │ ───────────────────────────────────▶ │              │
│   React SPA  │                                        │   Express    │
│  (Vite/Tail- │ ◀─────────────────────────────────── │   API server │
│   windCSS)   │                                        │              │
│              │        WebSocket (Socket.IO)          │              │
│              │ ◀────────────────────────────────────▶│   Socket.IO  │
└──────────────┘                                        └──────┬───────┘
                                                                 │
                                                          Mongoose ODM
                                                                 │
                                                          ┌──────▼───────┐
                                                          │   MongoDB    │
                                                          └──────────────┘
```

**Request flow for a message:**
1. Client calls `POST /api/messages` (REST) — the message is validated, persisted to MongoDB, and returned.
2. Client emits a `sendMessage` socket event with the saved message payload.
3. The Socket.IO server relays `newMessage` to every other participant's active socket (via a Socket.IO room keyed by conversation ID, plus a direct per-user socket map as a fallback).
4. Recipients' UIs append the message in real time — no refresh, no polling.

This "REST to persist, socket to broadcast" split keeps a single source of truth (MongoDB) while still giving instant delivery.

## Project Structure

```
chat-app/
├── backend/
│   ├── config/          # DB + Cloudinary configuration
│   ├── controllers/      # Route handler logic (auth, users, conversations, messages)
│   ├── middleware/        # JWT auth middleware
│   ├── models/            # Mongoose schemas: User, Conversation, Message
│   ├── routes/             # Express routers
│   ├── socket/             # Socket.IO server + presence/typing/read-receipt logic
│   ├── utils/               # JWT helper
│   ├── server.js             # App entry point
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/            # shadcn/ui primitives: button, input, dialog, dropdown-menu, avatar, switch, textarea, label, separator
│   │   │   ├── Sidebar.jsx, ChatWindow.jsx, MessageBubble.jsx, MessageInput.jsx
│   │   │   ├── NewChatModal.jsx, CreateGroupModal.jsx, ProfileModal.jsx
│   │   │   └── ThemeToggle.jsx
│   │   ├── context/         # AuthContext, SocketContext, ThemeContext
│   │   ├── pages/            # LoginPage, RegisterPage, ChatPage
│   │   ├── lib/                # cn() class-merge helper (shadcn convention)
│   │   ├── utils/              # Axios instance
│   │   ├── App.jsx, main.jsx
│   │   └── index.css            # Tailwind base + light/dark CSS variables
│   ├── components.json    # shadcn/ui config
│   ├── index.html
│   └── .env.example
├── package.json           # Convenience scripts for both apps
└── README.md
```

## Getting Started

### Running it in VS Code (step-by-step)

1. **Unzip the project** and open the resulting `chat-app` folder in VS Code (`File → Open Folder`).
2. **Open a terminal in VS Code**: `` Terminal → New Terminal `` (or `` Ctrl+` ``).
3. **Install dependencies for both apps** — run this once, from the project root (`chat-app/`):
   ```bash
   npm run install:all
   ```
   This installs the backend and frontend packages in one go.
4. **Set up your environment variables**:
   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```
   Open `backend/.env` and fill in at least `MONGO_URI` and `JWT_SECRET` (see [Environment Variables](#environment-variables) below). The `frontend/.env` defaults work as-is for local development.
5. **Start MongoDB** if you're running it locally (skip this if you're using MongoDB Atlas — just make sure your `MONGO_URI` points to it):
   ```bash
   mongod
   ```
6. **Run the backend and frontend at the same time** — you need **two terminals** open in VS Code (click the `+` icon in the terminal panel to split/add one):
   - **Terminal 1** (backend, from the project root):
     ```bash
     cd backend
     npm run dev
     ```
     You should see `Server running on port 5000` and `MongoDB connected...`.
   - **Terminal 2** (frontend, from the project root):
     ```bash
     cd frontend
     npm run dev
     ```
     You should see a local URL, typically `http://localhost:5173`.
7. **Open the app**: go to `http://localhost:5173` in your browser. Register two different accounts (use a normal window + an incognito window, or two different browsers) to test real-time chat between them.

That's it — both servers need to stay running in their own terminals while you use the app.

### Prerequisites
- Node.js 18+
- MongoDB running locally, or a free [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) cluster
- (Optional) A [Cloudinary](https://cloudinary.com/) account for avatar/image uploads

### 1. Clone & install

```bash
# From the project root
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
Fill in your `MONGO_URI`, `JWT_SECRET`, and (optionally) Cloudinary credentials — see [Environment Variables](#environment-variables).

### 3. Run in development

Open two terminals:

```bash
# Terminal 1 — backend (http://localhost:5000)
cd backend && npm run dev

# Terminal 2 — frontend (http://localhost:5173)
cd frontend && npm run dev
```

Visit `http://localhost:5173`, register two different accounts (e.g. in two browser windows/incognito), and start chatting — messages, typing indicators, and online status update instantly between them.

### 4. Production build

```bash
cd frontend && npm run build   # outputs frontend/dist
cd ../backend && NODE_ENV=production npm start
```
With `NODE_ENV=production`, the Express server also serves the built React app directly, so you can deploy the backend as a single service.

## Deploying to Render

The backend is already set up to serve the built frontend from the same origin in production (see `server.js`), so the simplest deployment is **one Render Web Service** for the whole app — no separate frontend hosting, and no cross-origin cookie issues since everything shares one domain.

### 1. Push the project to GitHub

From inside the `chat-app` folder:
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/chat-app.git
git push -u origin main
```
(Create the empty `chat-app` repo on GitHub first — github.com → New repository → don't initialize with a README, then use the URL it gives you above.)

### 2. Get a MongoDB connection string

Render doesn't host MongoDB itself, so use a free [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) cluster: create one, add a database user, allow access from anywhere (`0.0.0.0/0`) under Network Access, then copy the connection string — it looks like:
`mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/chat_app`

### 3. Create the Render service

Go to [render.com](https://render.com) → **New → Web Service** → connect your GitHub account and select the `chat-app` repo. This repo includes a `render.yaml`, so Render can also auto-detect it via **New → Blueprint** instead, which pre-fills most of the settings below.

Either way, set/confirm:

| Setting            | Value                          |
|----------------------|----------------------------------|
| Build Command          | `npm run render-build`      |
| Start Command            | `npm start`                |
| Node version               | 18+                       |

### 4. Add environment variables

In the Render dashboard, under **Environment**, add:

| Key                    | Value                                                   |
|--------------------------|-------------------------------------------------------------|
| `NODE_ENV`                 | `production`                                            |
| `MONGO_URI`                  | your Atlas connection string from step 2                |
| `JWT_SECRET`                   | any long random string                                |
| `JWT_EXPIRES_IN`                 | `7d`                                                |
| `CLIENT_URL`                       | your Render URL, e.g. `https://chat-app.onrender.com` (Render shows you this after the first deploy — you may need to save, copy the assigned URL, then paste it back in here and redeploy) |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | optional, only needed for image uploads |

### 5. Deploy

Click **Create Web Service**. Render will run the build command, then the start command, and give you a live URL like `https://chat-app.onrender.com`. Open it, register two accounts, and test real-time chat.

**Notes:**
- Free-tier Render services spin down after inactivity — the first request after idling can take ~30–50 seconds to wake back up.
- Every `git push` to your connected branch triggers an automatic redeploy.
- If you ever split the frontend into its own separate Render Static Site (rather than serving it from the backend), you'll need to change the cookie's `sameSite` setting to `"none"` (and keep `secure: true`) in `backend/utils/generateToken.js`, since the two would then be on different domains.

## Environment Variables

**backend/.env**

| Variable                | Description                                              |
|--------------------------|------------------------------------------------------------|
| `PORT`                    | Port for the Express server (default `5000`)              |
| `MONGO_URI`                | MongoDB connection string                                |
| `JWT_SECRET`                | Secret used to sign JWTs — use a long random string      |
| `JWT_EXPIRES_IN`             | Token lifetime (default `7d`)                            |
| `CLIENT_URL`                  | Frontend origin, used for CORS + cookie settings         |
| `CLOUDINARY_CLOUD_NAME`         | (Optional) for image uploads                         |
| `CLOUDINARY_API_KEY`             | (Optional)                                           |
| `CLOUDINARY_API_SECRET`           | (Optional)                                          |

**frontend/.env**

| Variable        | Description                        |
|-------------------|---------------------------------------|
| `VITE_API_URL`      | Base URL of the backend (default `http://localhost:5000`) |

## API Reference

All endpoints are prefixed with `/api`. Authenticated routes require the `jwt` httpOnly cookie (set automatically on login/register).

### Auth
| Method | Endpoint         | Description                     |
|--------|-------------------|----------------------------------|
| POST   | `/auth/register`   | Create an account, returns user + sets cookie |
| POST   | `/auth/login`        | Log in with email/username + password |
| POST   | `/auth/logout`         | Clear the auth cookie          |
| GET    | `/auth/me`              | Get the current logged-in user (protected) |

### Users
| Method | Endpoint          | Description                       |
|--------|--------------------|-------------------------------------|
| GET    | `/users`             | List all users except yourself   |
| GET    | `/users/search?query=`| Search users by name/username/email |
| PUT    | `/users/profile`        | Update your name/bio/avatar    |

### Conversations
| Method | Endpoint             | Description                          |
|--------|-----------------------|-----------------------------------------|
| POST   | `/conversations`        | Find or create a 1-on-1 conversation `{ receiverId }` |
| GET    | `/conversations`          | List your conversations, sorted by latest activity |
| POST   | `/conversations/group`      | Create a group `{ groupName, participantIds }` |

### Messages
| Method | Endpoint                     | Description                                |
|--------|--------------------------------|-----------------------------------------------|
| POST   | `/messages`                      | Send a message `{ conversationId, text, imageBase64? }` |
| GET    | `/messages/:conversationId`         | Paginated message history `?page=1&limit=30` |
| PUT    | `/messages/read`                       | Mark messages as read `{ messageIds }` |

## Socket.IO Events

The client connects with `withCredentials: true` so the same JWT cookie authenticates the socket handshake (verified server-side in `socket/socket.js`).

| Event               | Direction        | Payload                                             | Purpose |
|----------------------|--------------------|--------------------------------------------------------|-----------|
| `getOnlineUsers`       | server → client    | `string[]` of online user IDs                        | Presence |
| `joinConversation`       | client → server    | `conversationId`                                    | Join a room to receive that chat's events |
| `sendMessage`               | client → server    | saved message + `receiverIds`                      | Broadcast a new message |
| `newMessage`                   | server → client    | message object                                  | Deliver a message in real time |
| `typing` / `stopTyping`          | client → server    | `{ conversationId, receiverIds }`             | Typing indicator |
| `userTyping` / `userStopTyping`    | server → client    | `{ conversationId, userId }`               | Render "typing..." |
| `messageRead`                        | client → server    | `{ conversationId, messageIds, readerId, receiverIds }` | Read receipts |
| `messagesRead`                          | server → client    | `{ conversationId, messageIds, readerId }` | Update ticks to "read" |

## Data Models

**User** — `fullName, username, email, password (hashed), avatar, bio, isOnline, lastSeen`

**Conversation** — `isGroup, groupName, groupAvatar, participants[], admins[], lastMessage`

**Message** — `conversation, sender, text, image, status (sent/delivered/read), readBy[]`

## Theming

The UI is built on **shadcn/ui** (Radix UI primitives styled with Tailwind) using the standard shadcn CSS-variable pattern — every primitive in `frontend/src/components/ui/` reads colors like `bg-primary`, `bg-card`, `text-muted-foreground` from CSS variables rather than hardcoded hex values.

- **`frontend/src/index.css`** defines two variable sets: `:root` (light theme) and `.dark` (dark theme) — things like `--background`, `--foreground`, `--primary`, `--border`, plus a few WhatsApp-specific tokens (`--wa-bubble-out`, `--wa-bubble-in`, `--wa-panel`) for the chat-bubble colors and wallpaper pattern.
- **`ThemeContext.jsx`** toggles a `light`/`dark` class on `<html>`, which is what flips which variable set is active. The chosen theme (`light`, `dark`, or `system`) is saved to `localStorage` so it persists across visits, and `system` mode follows the OS-level preference live.
- The toggle lives in the sidebar header (sun/moon icon) on every screen, including login and registration.
- **To customize the palette**, edit the HSL values in `index.css` — for example, change `--primary` to swap the brand green for another color everywhere at once, since every shadcn component and the WhatsApp-style bubbles/panels all derive from these variables.
- **To add more shadcn components** (e.g. `Tooltip`, `Tabs`, `Popover`), the project is already wired for the standard `npx shadcn add <component>` CLI flow — `components.json` is present and the `@/` import alias is configured in `vite.config.js` and `jsconfig.json`. (Running the CLI requires network access to `ui.shadcn.com`, which isn't available in every sandboxed environment, but works fine on a normal dev machine.)

## Security Notes

- Passwords are hashed with **bcrypt** before storage; the raw password is never persisted or returned.
- JWTs live in **httpOnly, sameSite=strict cookies** — not `localStorage` — so they aren't readable by client-side JavaScript, which mitigates XSS-based token theft.
- Every REST route (except register/login) and every socket connection is authenticated server-side; a user can't fetch messages for a conversation they don't belong to.
- CORS is locked to `CLIENT_URL` with `credentials: true`.

This is a portfolio/learning project — before using it in production, add rate limiting, input sanitization, and HTTPS-only cookies (`secure: true`, already toggled on when `NODE_ENV=production`).

## Roadmap

- [ ] Voice & video calls (WebRTC)
- [ ] Message reactions & replies
- [ ] End-to-end encryption
- [ ] Push notifications
- [ ] Message deletion / editing
- [ ] Dark/light theme toggle

---

Built as a demonstration of real-time full-stack architecture with the MERN stack and Socket.IO.
