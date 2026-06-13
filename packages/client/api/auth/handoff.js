import { findCustomerById, getStoredState, sendError, sendJson } from "../../server/db.js";
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
      state: await getStoredState(customer.id)
    });
  } catch (error) {
    return sendError(response, error);
  }
}
