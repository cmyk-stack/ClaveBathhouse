import crypto from "node:crypto";
import { sendError, sendJson } from "../_db.js";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const STATE_COOKIE = "clave_google_oauth_state";

function getRedirectUri(request) {
  if (process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI;
  const host = request.headers["x-forwarded-host"] || request.headers.host;
  const protocol = request.headers["x-forwarded-proto"] || "https";
  return `${protocol}://${host}/api/auth/google/callback`;
}

function setStateCookie(response, state) {
  const secure = process.env.VERCEL ? "; Secure" : "";
  response.setHeader("Set-Cookie", `${STATE_COOKIE}=${state}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=600`);
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

    const state = crypto.randomBytes(24).toString("base64url");
    setStateCookie(response, state);

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
