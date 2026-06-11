import { ensureSchema, getStoredState, sendError, sendJson, upsertGoogleCustomer } from "../../_db.js";
import { setSessionCookie } from "../../_security.js";

const STATE_COOKIE = "clave_google_oauth_state";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

function getCookie(request, name) {
  return (request.headers.cookie || "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function clearStateCookie(response) {
  const secure = process.env.VERCEL ? "; Secure" : "";
  const cookie = `${STATE_COOKIE}=; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=0`;
  const existing = response.getHeader("Set-Cookie");
  response.setHeader("Set-Cookie", existing ? [existing, cookie].flat() : cookie);
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

    if (!code || !state || getCookie(request, STATE_COOKIE) !== state) {
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

    setSessionCookie(response, {
      customerId: customer.id,
      email: customer.email,
      role: customer.role
    });
    clearStateCookie(response);

    response.writeHead(302, { Location: `${getAppUrl(request)}/?auth=google_success` });
    response.end();
  } catch (error) {
    return sendError(response, error);
  }
}
