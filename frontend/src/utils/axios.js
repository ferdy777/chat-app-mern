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

export default api;
