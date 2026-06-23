import { findCustomerById, sendJson } from "./db.js";
import { requireSession } from "./security.js";

export async function requireFreshRole(request, response, allowedRoles) {
  const session = requireSession(request, response);
  if (!session) return null;

  const customer = await findCustomerById(session.customerId);
  if (!customer) {
    return sendJson(response, 401, { error: "unauthorized", message: "Sign in to continue." });
  }

  if (!allowedRoles.includes(customer.role)) {
    return sendJson(response, 403, { error: "forbidden", message: "Your account cannot access this operation." });
  }

  return {
    ...session,
    locationId: customer.locationId,
    role: customer.role
  };
}
