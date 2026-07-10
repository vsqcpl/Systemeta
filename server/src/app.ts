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
const TRUSTED_ORIGINS = process.env.TRUSTED_ORIGINS 
  ? process.env.TRUSTED_ORIGINS.split(",").map(url => url.trim()) 
  : [FRONTEND_URL, "http://localhost:3000", "http://localhost:3001"];

// Middlewares
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (TRUSTED_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
  })
);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(cookieParser());

// Global Cache-Control for sensitive API endpoints
app.use("/api", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

// Import rate limiters
import { createRateLimiter } from "./middlewares/rateLimiter.js";

const authRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 5,
  keyPrefix: "auth"
});

const aiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  keyPrefix: "ai"
});

// Apply rate limiting on authentication and AI routes
app.use("/api/auth/login", authRateLimiter);
app.use("/api/auth/register", authRateLimiter);
app.use("/api/auth/signup", authRateLimiter);
app.use("/api/auth/sign-up", authRateLimiter);
app.use("/api/auth/password-reset", authRateLimiter);
app.use("/api/auth/reset-password", authRateLimiter);
app.use("/api/auth/verify-otp", authRateLimiter);
app.use("/api/auth/two-factor/verify", authRateLimiter);

app.use("/api/ai", aiRateLimiter);

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
