import axios from "axios";

// In dev, Vite's proxy (see vite.config.js) forwards /api to the backend, so we can
// use a relative baseURL. In production the backend serves the built frontend from the
// same origin, so a relative baseURL works there too — no VITE_API_URL needed either way,
// but it's still supported as an override if you deploy frontend and backend separately.
const API_URL = import.meta.env.VITE_API_URL || "";

const api = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true, // send the httpOnly jwt cookie on every request
});

// Without this, an expired/missing JWT cookie just makes every request
// silently 401 forever — authUser in context stays truthy from the initial
// load, so the app LOOKS logged in but nothing actually loads or saves.
// That's the "minimize Chrome, come back, chat list is broken" bug: the
// cookie died while backgrounded and nothing ever told the app to log out.
// Broadcast a single event on any 401 so AuthContext can react in one place
// instead of every single api.get/post call needing its own check.
let sessionExpiredDispatched = false;

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || "";

    // Don't treat a failed login/register attempt as a "session expired"
    // event — that's just wrong credentials, not a dead session.
    const isAuthEndpoint = url.includes("/auth/login") || url.includes("/auth/register");

    if (status === 401 && !isAuthEndpoint && !sessionExpiredDispatched) {
      sessionExpiredDispatched = true;
      window.dispatchEvent(new CustomEvent("auth:session-expired"));
      // Reset the guard shortly after so a future real session-expiry
      // (after logging back in) can dispatch again.
      setTimeout(() => {
        sessionExpiredDispatched = false;
      }, 2000);
    }

    return Promise.reject(error);
  }
);

export default api;