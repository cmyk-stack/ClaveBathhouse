import crypto from "node:crypto";
import { ensureSchema, sendError, sendJson, upsertGoogleCustomer } from "../../../server/db.js";
import { createSessionHandoffToken, setSessionCookie } from "../../../server/security.js";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

function getAuthSecret() {
  return process.env.AUTH_SECRET || "local-dev-change-me";
}

function verifySignedState(state) {
  if (!state || typeof state !== "string") return false;
  const [payload, signature] = state.split(".");
  if (!payload || !signature) return false;

  const expected = crypto.createHmac("sha256", getAuthSecret()).update(payload).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) return false;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return Boolean(parsed.exp && parsed.exp >= Math.floor(Date.now() / 1000));
  } catch {
    return false;
  }
}

function getRedirectUri(request) {
  if (process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI;
  const host = request.headers["x-forwarded-host"] || request.headers.host;
  const protocol = request.headers["x-forwarded-proto"] || "https";
  return `${protocol}://${host}/api/auth/google/callback`;
}

function getAppUrl(request) {
  const host = request.headers["x-forwarded-host"] || request.headers.host;
  const protocol = request.headers["x-forwarded-proto"] || "https";
  return `${protocol}://${host}`;
}

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return sendJson(response, 405, { error: "method_not_allowed" });
  }

  try {
    const { code, error, state } = request.query ?? {};
    if (error) {
      response.writeHead(302, { Location: `${getAppUrl(request)}/?auth=google_cancelled` });
      response.end();
      return;
    }

    if (!code || !verifySignedState(String(state))) {
      return sendJson(response, 400, { error: "invalid_oauth_state", message: "Google sign in could not be verified." });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return sendJson(response, 503, {
        error: "google_not_configured",
        message: "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Vercel."
      });
    }

    await ensureSchema();

    const tokenParams = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: String(code),
      grant_type: "authorization_code",
      redirect_uri: getRedirectUri(request)
    });

    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      body: tokenParams,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      method: "POST"
    });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) {
      return sendJson(response, 502, {
        error: "google_token_error",
        message: tokenData.error_description ?? "Google could not complete sign in."
      });
    }

    const userResponse = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const profile = await userResponse.json();
    if (!userResponse.ok || !profile.email || !profile.sub) {
      return sendJson(response, 502, { error: "google_profile_error", message: "Google profile could not be loaded." });
    }

    const customer = await upsertGoogleCustomer({
      email: String(profile.email),
      name: String(profile.name ?? ""),
      sub: String(profile.sub)
    });
    if (!customer) {
      return sendJson(response, 500, {
        error: "google_customer_error",
        message: "Google sign in succeeded, but the Clave account could not be created."
      });
    }

    setSessionCookie(response, {
      customerId: customer.id,
      email: customer.email,
      role: customer.role
    });
    const handoffToken = createSessionHandoffToken({
      customerId: customer.id,
      email: customer.email,
      role: customer.role
    });
    response.writeHead(302, { Location: `${getAppUrl(request)}/?auth=google_success&handoff=${encodeURIComponent(handoffToken)}` });
    response.end();
  } catch (error) {
    return sendError(response, error);
  }
}
