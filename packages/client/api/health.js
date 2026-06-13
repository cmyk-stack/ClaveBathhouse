import { checkDatabaseConnection, sendJson } from "../server/db.js";

function envStatus(name) {
  return Boolean(process.env[name]);
}

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return sendJson(response, 405, { error: "method_not_allowed" });
  }

  const checks = {
    authSecret: envStatus("AUTH_SECRET"),
    database: envStatus("POSTGRES_URL"),
    email: envStatus("RESEND_API_KEY") && envStatus("EMAIL_FROM"),
    google: envStatus("GOOGLE_CLIENT_ID") && envStatus("GOOGLE_CLIENT_SECRET") && envStatus("GOOGLE_REDIRECT_URI"),
    publicAppUrl: envStatus("PUBLIC_APP_URL")
  };

  let databaseReachable = false;
  try {
    databaseReachable = await checkDatabaseConnection();
  } catch (error) {
    console.error("Health check database failure", error);
  }

  const missing = Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([name]) => name);
  const ok = checks.authSecret && checks.database && databaseReachable;

  return sendJson(response, ok ? 200 : 503, {
    checks: {
      ...checks,
      databaseReachable
    },
    missing,
    ok,
    service: "clave-bathhouse",
    timestamp: new Date().toISOString()
  });
}
