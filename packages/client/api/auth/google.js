import crypto from "node:crypto";
import { sendError, sendJson } from ".../server/db.js";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

function getAuthSecret() {
  return process.env.AUTH_SECRET || "local-dev-change-me";
}

function createSignedState() {
  const payload = Buffer.from(
    JSON.stringify({
      exp: Math.floor(Date.now() / 1000) + 600,
      nonce: crypto.randomBytes(24).toString("base64url")
    })
  ).toString("base64url");
  const signature = crypto.createHmac("sha256", getAuthSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function getRedirectUri(request) {
  if (process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI;
  const host = request.headers["x-forwarded-host"] || request.headers.host;
  const protocol = request.headers["x-forwarded-proto"] || "https";
  return `${protocol}://${host}/api/auth/google/callback`;
}

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return sendJson(response, 405, { error: "method_not_allowed" });
  }

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return sendJson(response, 503, {
        error: "google_not_configured",
        message: "Set GOOGLE_CLIENT_ID in Vercel to enable Google sign in."
      });
    }

    const state = createSignedState();

    const params = new URLSearchParams({
      access_type: "offline",
      client_id: clientId,
      include_granted_scopes: "true",
      prompt: "select_account",
      redirect_uri: getRedirectUri(request),
      response_type: "code",
      scope: "openid email profile",
      state
    });

    response.writeHead(302, { Location: `${GOOGLE_AUTH_URL}?${params.toString()}` });
    response.end();
  } catch (error) {
    return sendError(response, error);
  }
}
