/**
 * API base URL. When running frontend and backend separately:
 * Set VITE_API_URL=http://localhost:3000 in frontend .env to send requests to the backend.
 * Leave unset to use the Vite proxy (requests go to same origin and are proxied to backend).
 */
export const API_BASE = (import.meta.env.VITE_API_URL as string) ?? "";
