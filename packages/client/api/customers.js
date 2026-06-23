import { countAdmins, ensureSchema, listCustomers, listLocationIds, recordAdminAudit, sendError, sendJson, updateCustomerRole } from "../server/db.js";
import { requireFreshRole } from "../server/roles.js";

const allowedRoles = new Set(["customer", "staff", "admin"]);

export default async function handler(request, response) {
  try {
    await ensureSchema();
    const adminSession = await requireFreshRole(request, response, ["admin"]);
    if (!adminSession) return;

    if (request.method === "GET") {
      return sendJson(response, 200, { customers: await listCustomers() });
    }

    if (request.method === "POST") {
      const { customerId, locationId, role } = request.body ?? {};
      if (!customerId || !allowedRoles.has(role)) {
        return sendJson(response, 400, { error: "bad_request", message: "Choose a valid customer role." });
      }
      const allowedLocationIds = new Set(await listLocationIds());
      if (role === "staff" && !allowedLocationIds.has(locationId)) {
        return sendJson(response, 400, { error: "bad_request", message: "Choose the staff member's location." });
      }

      if (customerId === adminSession.customerId && role !== "admin" && (await countAdmins()) <= 1) {
        return sendJson(response, 409, {
          error: "last_admin",
          message: "Create another admin before changing your own admin role."
        });
      }

      const customer = await updateCustomerRole({ customerId, locationId: role === "staff" ? locationId : null, role });
      if (!customer) return sendJson(response, 404, { error: "not_found", message: "Customer was not found." });
      await recordAdminAudit({
        action: "customer_role_updated",
        actorCustomerId: adminSession.customerId,
        details: { locationId: role === "staff" ? locationId : null, role },
        targetCustomerId: customerId
      });
      return sendJson(response, 200, { customer, customers: await listCustomers() });
    }

    response.setHeader("Allow", "GET, POST");
    return sendJson(response, 405, { error: "method_not_allowed" });
  } catch (error) {
    return sendError(response, error);
  }
}
