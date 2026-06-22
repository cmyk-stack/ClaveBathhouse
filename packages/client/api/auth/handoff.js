import { ensureSchema, findCustomerById, listBookings, listCustomers, listSessions, listTransactions, sendError, sendJson } from "../../server/db.js";
import { setSessionCookie, verifySessionHandoffToken } from "../../server/security.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendJson(response, 405, { error: "method_not_allowed" });
  }

  try {
    const session = verifySessionHandoffToken(request.body?.token);
    if (!session) {
      return sendJson(response, 400, { error: "invalid_handoff", message: "Google sign in handoff expired. Try signing in again." });
    }

    await ensureSchema();
    const customer = await findCustomerById(session.customerId);
    if (!customer) {
      return sendJson(response, 404, { error: "not_found", message: "Google account was not found." });
    }

    setSessionCookie(response, {
      customerId: customer.id,
      email: customer.email,
      role: customer.role
    });

    return sendJson(response, 200, {
      customer,
      bookings: await listBookings({ customerId: customer.id, role: customer.role }),
      customers: customer.role === "admin" ? await listCustomers() : undefined,
      sessions: await listSessions(),
      transactions: await listTransactions({ customerId: customer.id, role: customer.role })
    });
  } catch (error) {
    return sendError(response, error);
  }
}
