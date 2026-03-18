import express from "express";
import { initDb } from "./config/database.js";
import apiRoutes from "./routes/index.js";

const dbReady = initDb();

const app = express();

// Health check (no DB wait – for load balancers / monitoring)
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// Ensure DB is ready before handling any request (for Vercel serverless)
app.use(async (_req, _res, next) => {
  await dbReady;
  next();
});

// CORS: allow localhost:5173, localhost:3000, Vercel (*.vercel.app), and aiestimatic.com
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://localhost:5173",
  "https://localhost:3000",
  /\.vercel\.app$/,
  /^https?:\/\/aiestimatic\.com$/,
  /^https?:\/\/www\.aiestimatic\.com$/,
];
function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;
  return allowedOrigins.some((o) =>
    typeof o === "string" ? o === origin : o.test(origin)
  );
}
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && isOriginAllowed(origin))
    res.setHeader("Access-Control-Allow-Origin", origin);
  else if (!origin)
    res.setHeader("Access-Control-Allow-Origin", "http://localhost:5173");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(express.json());
app.use("/api", apiRoutes);

// Local development: start listening (PORT from env, default 3000)
const PORT = Number(process.env.PORT) || 3000;
if (process.env.VERCEL !== "1") {
  dbReady.then(() => {
    const server = app.listen(PORT, "0.0.0.0", () => {
      console.log(`API server running on http://localhost:${PORT}`);
    });
    server.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        console.error(
          `Port ${PORT} is already in use. Stop the other process (e.g. \`lsof -ti :${PORT} | xargs kill\`) or set PORT to another number.`
        );
        process.exit(1);
      }
      throw err;
    });
  });
}

export default app;
