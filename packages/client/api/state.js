import { ensureSchema, findCustomerById, getStoredState, saveStoredState, sendError, sendJson, upsertCustomer } from "./_db.js";
import { requireSession } from "./_security.js";

export default async function handler(request, response) {
  try {
    const session = requireSession(request, response);
    if (!session) return;
    await ensureSchema();

    if (request.method === "GET") {
      const customerId = session.role === "admin" ? String(request.query.customerId ?? session.customerId) : session.customerId;
      return sendJson(response, 200, { state: await getStoredState(customerId) });
    }

    if (request.method === "POST") {
      const { customer, state } = request.body ?? {};
      if (!state) return sendJson(response, 400, { error: "bad_request" });

      const storedCustomer = await findCustomerById(session.customerId);
      if (!storedCustomer) return sendJson(response, 404, { error: "not_found" });

      const nextCustomer = session.role === "admin" && customer?.id ? customer : { ...storedCustomer, ...customer, id: storedCustomer.id };
      await upsertCustomer(nextCustomer);
      await saveStoredState(nextCustomer.id, {
        ...state,
        isAuthenticated: true,
        selectedCustomerId: nextCustomer.id
      });
      return sendJson(response, 200, { ok: true });
    }

    response.setHeader("Allow", "GET, POST");
    return sendJson(response, 405, { error: "method_not_allowed" });
  } catch (error) {
    return sendError(response, error);
  }
}
