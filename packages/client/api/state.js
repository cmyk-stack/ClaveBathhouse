import { ensureSchema, getStoredState, saveStoredState, sendError, sendJson, upsertCustomer } from "./_db.js";

export default async function handler(request, response) {
  try {
    await ensureSchema();

    if (request.method === "GET") {
      const customerId = String(request.query.customerId ?? "");
      if (!customerId) return sendJson(response, 400, { error: "missing_customer_id" });
      return sendJson(response, 200, { state: await getStoredState(customerId) });
    }

    if (request.method === "POST") {
      const { customer, state } = request.body ?? {};
      if (!customer?.id || !state) return sendJson(response, 400, { error: "bad_request" });

      await upsertCustomer(customer);
      await saveStoredState(customer.id, state);
      return sendJson(response, 200, { ok: true });
    }

    response.setHeader("Allow", "GET, POST");
    return sendJson(response, 405, { error: "method_not_allowed" });
  } catch (error) {
    return sendError(response, error);
  }
}
