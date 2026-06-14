import {
  cancelBookingRecord,
  checkInBookingRecord,
  createBookingRecord,
  ensureSchema,
  findCustomerById,
  findSessionById,
  listBookings,
  listCustomers,
  listTransactions,
  sendError,
  sendJson
} from "../server/db.js";
import { bookingEmailText, sendTransactionalEmail } from "../server/email.js";
import { requireRole, requireSession } from "../server/security.js";

export default async function handler(request, response) {
  try {
    const session = requireSession(request, response);
    if (!session) return;
    await ensureSchema();

    if (request.method === "GET") {
      return sendJson(response, 200, {
        bookings: await listBookings({ customerId: session.customerId, role: session.role }),
        transactions: await listTransactions({ customerId: session.customerId, role: session.role })
      });
    }

    if (request.method === "POST") {
      const { action, amountCents = 0, bookingId, sessionId } = request.body ?? {};

      if (action === "cancel") {
        const booking = await cancelBookingRecord({ bookingId, session, role: session.role });
        if (!booking) return sendJson(response, 409, { error: "not_cancellable", message: "That booking is already cancelled or cannot be cancelled." });
        const customer = await findCustomerById(booking.customerId);
        await sendTransactionalEmail({
          subject: "Clave Bathhouse booking cancelled",
          text: `Your booking ${booking.id} has been cancelled.`,
          to: customer?.email
        });
        return sendJson(response, 200, {
          booking,
          bookings: await listBookings({ customerId: session.customerId, role: session.role }),
          customer: await findCustomerById(booking.customerId),
          customers: session.role === "admin" ? await listCustomers() : undefined,
          transactions: await listTransactions({ customerId: session.customerId, role: session.role })
        });
      }

      if (action === "check-in") {
        const staffSession = requireRole(request, response, ["staff", "admin"]);
        if (!staffSession) return;

        const booking = await checkInBookingRecord({ bookingId });
        if (!booking) return sendJson(response, 404, { error: "not_found", message: "Confirmed booking was not found." });
        const customer = await findCustomerById(booking.customerId);
        await sendTransactionalEmail({
          subject: "Clave Bathhouse check-in complete",
          text: `You have been checked in for booking ${booking.id}.`,
          to: customer?.email
        });
        return sendJson(response, 200, {
          booking,
          bookings: await listBookings({ customerId: session.customerId, role: session.role }),
          transactions: await listTransactions({ customerId: session.customerId, role: session.role })
        });
      }

      const customer = await findCustomerById(session.customerId);
      if (!customer) return sendJson(response, 404, { error: "not_found", message: "Customer was not found." });
      if (!sessionId) return sendJson(response, 400, { error: "bad_request", message: "Choose a session to book." });

      const booking = await createBookingRecord({ customer, sessionId, amountCents: Number(amountCents) });
      if (!booking) {
        return sendJson(response, 409, {
          error: "booking_unavailable",
          message: "That session is unavailable or already booked for this account."
        });
      }
      const bookedSession = await findSessionById(sessionId);
      await sendTransactionalEmail({
        subject: booking.status === "waitlist" ? "Clave Bathhouse waitlist" : "Clave Bathhouse booking confirmed",
        text: bookingEmailText({ booking, session: bookedSession }),
        to: customer.email
      });

      return sendJson(response, 201, {
        booking,
        bookings: await listBookings({ customerId: session.customerId, role: session.role }),
        customer: await findCustomerById(customer.id),
        transactions: await listTransactions({ customerId: session.customerId, role: session.role })
      });
    }

    response.setHeader("Allow", "GET, POST");
    return sendJson(response, 405, { error: "method_not_allowed" });
  } catch (error) {
    return sendError(response, error);
  }
}
