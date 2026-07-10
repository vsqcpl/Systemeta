import { Request, Response, NextFunction } from "express";

export function validateCsrf(req: any, res: Response, next: NextFunction) {
  const isProd = process.env.NODE_ENV === "production";
  const cookieName = isProd ? "__Secure-csrf-token-sig" : "csrf-token-sig";
  
  const cookieToken = req.cookies[cookieName];
  const headerToken = req.headers["x-csrf-token"];
  
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({
      message: "Invalid or missing CSRF token."
    });
  }
  
  next();
}
