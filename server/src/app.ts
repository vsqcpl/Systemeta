import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth.js";
import routes from "./routes/index.js";

dotenv.config();

const app = express();
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

// Middlewares
app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
  })
);

app.use(express.json());
app.use(cookieParser());

// Mount Better Auth handler
app.all("/api/auth/*", (req, res, next) => {
  const customPaths = ["/api/auth/login", "/api/auth/logout", "/api/auth/me", "/api/auth/change-password"];
  if (customPaths.includes(req.path)) {
    return next();
  }
  return toNodeHandler(auth)(req, res);
});

// Friendly root handler
app.get("/", (req: Request, res: Response) => {
  res.json({
    name: "VSQC Platform Backend API",
    status: "online",
    version: "1.0.0",
    frontendUrl: FRONTEND_URL
  });
});

// App API routes
app.use("/api", routes);

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("Global Error Handler caught:", err);
  const status = err.status || 500;
  const message = err.message || "Internal server error";
  res.status(status).json({ message });
});

export default app;
