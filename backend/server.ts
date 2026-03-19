import express from "express";
import { initDb } from "./config/database.js";
import apiRoutes from "./routes/index.js";

const dbReady = initDb();

const app = express();

// CORS: run before any other middleware so preflight OPTIONS never fails due
// to downstream middleware (e.g. DB readiness).
const allowedOrigins: Array<string | RegExp> = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://localhost:5173",
  "https://localhost:3000",
  "https://ai-estimatic.vercel.app",
  "https://www.aiestimatic.com",
  "https://aiestimatic.com",
  /\.vercel\.app$/,
  /^https?:\/\/aiestimatic\.com(?::\d+)?$/,
  /^https?:\/\/www\.aiestimatic\.com(?::\d+)?$/,
  /^https?:\/\/ai-estimatic\.com(?::\d+)?$/,
  /^https?:\/\/www\.ai-estimatic\.com(?::\d+)?$/,
];
function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;
  return allowedOrigins.some((o) =>
    typeof o === "string" ? o === origin : o.test(origin),
  );
}
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && isOriginAllowed(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With",
  );
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// Health check (no DB wait – for load balancers / monitoring)
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// Ensure DB is ready before handling any request (for Vercel serverless)
app.use(async (_req, _res, next) => {
  try {
    await dbReady;
    next();
  } catch (err) {
    next(err);
  }
});

app.use(express.json());
app.use("/api", apiRoutes);

// Final error handler (ensures JSON + CORS headers already set above)
app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(err);
    if (res.headersSent) return;
    res.status(503).json({ error: "Service unavailable" });
  },
);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

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
          `Port ${PORT} is already in use. Stop the other process (e.g. \`lsof -ti :${PORT} | xargs kill\`) or set PORT to another number.`,
        );
        process.exit(1);
      }
      throw err;
    });
  });
}

export default app;
