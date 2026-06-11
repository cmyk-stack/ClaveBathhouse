import {
  cancelBookingRecord,
  checkInBookingRecord,
  createBookingRecord,
  ensureSchema,
  findCustomerById,
  listBookings,
  sendError,
  sendJson
} from "./_db.js";
import { requireRole, requireSession } from "./_security.js";

export default async function handler(request, response) {
  try {
    const session = requireSession(request, response);
    if (!session) return;
    await ensureSchema();

    if (request.method === "GET") {
      return sendJson(response, 200, { bookings: await listBookings({ customerId: session.customerId, role: session.role }) });
    }

    if (request.method === "POST") {
      const { action, amountCents = 0, bookingId, sessionId } = request.body ?? {};

      if (action === "cancel") {
        const booking = await cancelBookingRecord({ bookingId, session, role: session.role });
        if (!booking) return sendJson(response, 404, { error: "not_found", message: "Booking was not found." });
        return sendJson(response, 200, { booking, bookings: await listBookings({ customerId: session.customerId, role: session.role }) });
      }

      if (action === "check-in") {
        const staffSession = requireRole(request, response, ["staff", "admin"]);
        if (!staffSession) return;

        const booking = await checkInBookingRecord({ bookingId });
        if (!booking) return sendJson(response, 404, { error: "not_found", message: "Confirmed booking was not found." });
        return sendJson(response, 200, { booking, bookings: await listBookings({ customerId: session.customerId, role: session.role }) });
      }

      const customer = await findCustomerById(session.customerId);
      if (!customer) return sendJson(response, 404, { error: "not_found", message: "Customer was not found." });
      if (!sessionId) return sendJson(response, 400, { error: "bad_request", message: "Choose a session to book." });

      const booking = await createBookingRecord({ customer, sessionId, amountCents: Number(amountCents) });
      if (!booking) return sendJson(response, 404, { error: "not_found", message: "Session was not found." });

      return sendJson(response, 201, { booking, bookings: await listBookings({ customerId: session.customerId, role: session.role }) });
    }

    response.setHeader("Allow", "GET, POST");
    return sendJson(response, 405, { error: "method_not_allowed" });
  } catch (error) {
    return sendError(response, error);
  }
}
