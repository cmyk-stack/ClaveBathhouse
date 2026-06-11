import { createSessionRecord, deleteSessionRecord, ensureSchema, listSessions, recordAdminAudit, sendError, sendJson, updateSessionRecord } from "./_db.js";
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

      const { action, session: nextSession, sessionId } = request.body ?? {};
      if (action === "delete") {
        if (!sessionId) return sendJson(response, 400, { error: "bad_request", message: "Session ID is required." });
        const deletedSession = await deleteSessionRecord({ sessionId });
        if (!deletedSession) return sendJson(response, 404, { error: "not_found", message: "Session was not found." });
        await recordAdminAudit({
          action: "session_deleted",
          actorCustomerId: adminSession.customerId,
          details: { sessionId }
        });
        return sendJson(response, 200, { session: deletedSession, sessions: await listSessions() });
      }

      if (!nextSession?.typeId || !nextSession?.date || !nextSession?.time || !Number(nextSession?.capacity)) {
        return sendJson(response, 400, { error: "bad_request", message: "Session type, date, time, and capacity are required." });
      }

      if (action === "update") {
        if (!sessionId) return sendJson(response, 400, { error: "bad_request", message: "Session ID is required." });
        const updatedSession = await updateSessionRecord({ session: nextSession, sessionId });
        if (!updatedSession) return sendJson(response, 404, { error: "not_found", message: "Session was not found." });
        await recordAdminAudit({
          action: "session_updated",
          actorCustomerId: adminSession.customerId,
          details: { sessionId }
        });
        return sendJson(response, 200, { session: updatedSession, sessions: await listSessions() });
      }

      const createdSession = await createSessionRecord(nextSession);
      await recordAdminAudit({
        action: "session_created",
        actorCustomerId: adminSession.customerId,
        details: { sessionId: createdSession.id }
      });
      return sendJson(response, 201, { session: createdSession, sessions: await listSessions() });
    }

    response.setHeader("Allow", "GET, POST");
    return sendJson(response, 405, { error: "method_not_allowed" });
  } catch (error) {
    return sendError(response, error);
  }
}
