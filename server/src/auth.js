// JWT 签发 + 中间件
import jwt from "jsonwebtoken";
import { config } from "./config.js";

export function signToken(payload) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

export function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

export function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "missing_token" });
  }
  try {
    req.user = verifyToken(token);
    next();
  } catch (_err) {
    return res.status(401).json({ error: "invalid_token" });
  }
}

export function adminRequired(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "missing_token" });
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "forbidden" });
  }
  next();
}
