import { createSessionRecord, deleteSessionRecord, ensureSchema, listSessions, recordAdminAudit, sendError, sendJson, updateSessionRecord } from "../server/db.js";
import { requireFreshRole } from "../server/roles.js";
import { requireSession } from "../server/security.js";

function dateRange(startDate, endDate) {
  const startMatch = String(startDate ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const endMatch = String(endDate ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!startMatch || !endMatch) return [];

  const start = Date.UTC(Number(startMatch[1]), Number(startMatch[2]) - 1, Number(startMatch[3]));
  const end = Date.UTC(Number(endMatch[1]), Number(endMatch[2]) - 1, Number(endMatch[3]));
  if (Number.isNaN(start) || Number.isNaN(end) || start > end) return [];

  const dates = [];
  for (let cursor = start; cursor <= end && dates.length < 120; cursor += 24 * 60 * 60 * 1000) {
    const date = new Date(cursor);
    dates.push(date.toISOString().slice(0, 10));
  }
  return dates;
}

export default async function handler(request, response) {
  try {
    const session = requireSession(request, response);
    if (!session) return;
    await ensureSchema();

    if (request.method === "GET") {
      return sendJson(response, 200, { sessions: await listSessions() });
    }

    if (request.method === "POST") {
      const adminSession = await requireFreshRole(request, response, ["admin"]);
      if (!adminSession) return;

      const { action, endDate, session: nextSession, sessionId, startDate } = request.body ?? {};
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

      if (action === "bulk-create") {
        const dates = dateRange(startDate, endDate);
        if (dates.length === 0) {
          return sendJson(response, 400, { error: "bad_request", message: "Choose a valid start and end date." });
        }

        const createdSessions = [];
        for (const date of dates) {
          createdSessions.push(
            await createSessionRecord({
              ...nextSession,
              date,
              id: `bulk-${nextSession.locationId ?? "scarborough"}-${date}-${nextSession.typeId}-${nextSession.time.replace(":", "")}`
            })
          );
        }
        await recordAdminAudit({
          action: "sessions_bulk_created",
          actorCustomerId: adminSession.customerId,
          details: { count: createdSessions.length, endDate, startDate }
        });
        return sendJson(response, 201, { createdSessions, sessions: await listSessions() });
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
