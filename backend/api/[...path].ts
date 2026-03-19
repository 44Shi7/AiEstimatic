import app from "../server.js";

export default function handler(req: unknown, res: unknown) {
  return app(req as any, res as any);
}
