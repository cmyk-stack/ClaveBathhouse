import { ensureSchema, listCustomers, sendError, sendJson, updateCustomerRole } from "./_db.js";
import { requireRole, requireSession } from "./_security.js";

const allowedRoles = new Set(["customer", "staff", "admin"]);

export default async function handler(request, response) {
  try {
    const session = requireSession(request, response);
    if (!session) return;
    const adminSession = requireRole(request, response, ["admin"]);
    if (!adminSession) return;
    await ensureSchema();

    if (request.method === "GET") {
      return sendJson(response, 200, { customers: await listCustomers() });
    }

    if (request.method === "POST") {
      const { customerId, role } = request.body ?? {};
      if (!customerId || !allowedRoles.has(role)) {
        return sendJson(response, 400, { error: "bad_request", message: "Choose a valid customer role." });
      }

      const customer = await updateCustomerRole({ customerId, role });
      if (!customer) return sendJson(response, 404, { error: "not_found", message: "Customer was not found." });
      return sendJson(response, 200, { customer, customers: await listCustomers() });
    }

    response.setHeader("Allow", "GET, POST");
    return sendJson(response, 405, { error: "method_not_allowed" });
  } catch (error) {
    return sendError(response, error);
  }
}
