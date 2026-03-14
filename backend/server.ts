import express from "express";
import { initDb } from "./config/database.js";
import apiRoutes from "./routes/index.js";

const dbReady = initDb();

const app = express();

// Ensure DB is ready before handling any request (for Vercel serverless)
app.use(async (_req, _res, next) => {
  await dbReady;
  next();
});

// CORS: allow frontend (localhost:5173) and Vercel preview/production origins
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowed =
    !origin ||
    origin.includes("localhost:5173") ||
    origin.includes("vercel.app");
  if (origin && allowed) res.setHeader("Access-Control-Allow-Origin", origin);
  else if (!origin) res.setHeader("Access-Control-Allow-Origin", "http://localhost:5173");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(express.json());
app.use("/api", apiRoutes);

// Local development: start listening
if (process.env.VERCEL !== "1") {
  dbReady.then(() => {
    app.listen(3000, "0.0.0.0", () => {
      console.log("API server running on http://localhost:3000");
    });
  });
}

export default app;
