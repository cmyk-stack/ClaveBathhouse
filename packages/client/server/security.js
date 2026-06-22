import crypto from "node:crypto";

const COOKIE_NAME = "clave_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;
const HANDOFF_TTL_SECONDS = 60;
const PBKDF2_ITERATIONS = 210000;

function getAuthSecret() {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  if (process.env.VERCEL) {
    const error = new Error("AUTH_SECRET is required in production.");
    error.code = "auth_secret_not_configured";
    throw error;
  }
  return "local-dev-change-me";
}

function base64UrlEncode(value) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlJson(value) {
  return base64UrlEncode(JSON.stringify(value));
}

function sign(value) {
  return crypto.createHmac("sha256", getAuthSecret()).update(value).digest("base64url");
}

function safeEqual(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("base64url");
  const hash = await new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, PBKDF2_ITERATIONS, 32, "sha256", (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey.toString("base64url"));
    });
  });
  return `pbkdf2_sha256$${PBKDF2_ITERATIONS}$${salt}$${hash}`;
}

export async function verifyPassword(password, passwordHash) {
  if (!passwordHash) return false;
  const [scheme, iterations, salt, expectedHash] = passwordHash.split("$");
  if (scheme !== "pbkdf2_sha256" || !iterations || !salt || !expectedHash) return false;

  const actualHash = await new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, Number(iterations), 32, "sha256", (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey.toString("base64url"));
    });
  });
  return safeEqual(actualHash, expectedHash);
}

export function setSessionCookie(response, session) {
  const now = Math.floor(Date.now() / 1000);
  const payload = base64UrlJson({
    customerId: session.customerId,
    email: session.email,
    exp: now + SESSION_TTL_SECONDS,
    role: session.role
  });
  const token = `${payload}.${sign(payload)}`;
  const secure = process.env.VERCEL ? "; Secure" : "";
  response.setHeader("Cache-Control", "no-store, max-age=0");
  response.setHeader("Pragma", "no-cache");
  response.setHeader("Set-Cookie", `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=${SESSION_TTL_SECONDS}`);
}

export function createSessionHandoffToken(session) {
  const now = Math.floor(Date.now() / 1000);
  const payload = base64UrlJson({
    customerId: session.customerId,
    email: session.email,
    exp: now + HANDOFF_TTL_SECONDS,
    role: session.role,
    type: "session_handoff"
  });
  return `${payload}.${sign(payload)}`;
}

export function verifySessionHandoffToken(token) {
  const [payload, signature] = String(token ?? "").split(".");
  if (!payload || !signature || !safeEqual(sign(payload), signature)) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (session.type !== "session_handoff") return null;
    if (!session.exp || session.exp < Math.floor(Date.now() / 1000)) return null;
    return session;
  } catch {
    return null;
  }
}

export function clearSessionCookie(response) {
  const secure = process.env.VERCEL ? "; Secure" : "";
  response.setHeader("Cache-Control", "no-store, max-age=0");
  response.setHeader("Pragma", "no-cache");
  response.setHeader("Set-Cookie", `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=0`);
}

export function getSession(request) {
  const cookieHeader = request.headers.cookie || "";
  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`));
  if (!cookie) return null;

  const token = cookie.slice(COOKIE_NAME.length + 1);
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !safeEqual(sign(payload), signature)) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!session.exp || session.exp < Math.floor(Date.now() / 1000)) return null;
    return session;
  } catch {
    return null;
  }
}

export function requireSession(request, response) {
  const session = getSession(request);
  if (!session) {
    response.status(401).json({ error: "unauthorized", message: "Sign in to continue." });
    return null;
  }
  return session;
}

export function requireRole(request, response, allowedRoles) {
  const session = requireSession(request, response);
  if (!session) return null;
  if (!allowedRoles.includes(session.role)) {
    response.status(403).json({ error: "forbidden", message: "Your account cannot access this operation." });
    return null;
  }
  return session;
}
