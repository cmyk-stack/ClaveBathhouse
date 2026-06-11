import { createSessionRecord, ensureSchema, listSessions, sendError, sendJson } from "./_db.js";
import { requireRole, requireSession } from "./_security.js";

export default async function handler(request, response) {
  try {
    const session = requireSession(request, response);
    if (!session) return;
    await ensureSchema();

    if (request.method === "GET") {
      return sendJson(response, 200, { sessions: await listSessions() });
    }

    if (request.method === "POST") {
      const adminSession = requireRole(request, response, ["admin"]);
      if (!adminSession) return;

      const { session: nextSession } = request.body ?? {};
      if (!nextSession?.typeId || !nextSession?.date || !nextSession?.time || !Number(nextSession?.capacity)) {
        return sendJson(response, 400, { error: "bad_request", message: "Session type, date, time, and capacity are required." });
      }

      return sendJson(response, 201, { session: await createSessionRecord(nextSession) });
    }

    response.setHeader("Allow", "GET, POST");
    return sendJson(response, 405, { error: "method_not_allowed" });
  } catch (error) {
    return sendError(response, error);
  }
}
