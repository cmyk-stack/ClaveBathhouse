import { ensureSchema, findCustomerByEmail, getStoredState, sendError, sendJson, upsertCustomer } from "./_db.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendJson(response, 405, { error: "method_not_allowed" });
  }

  try {
    await ensureSchema();

    const { mode, customer, email } = request.body ?? {};
    if (mode === "login" || mode === "social") {
      const existing = await findCustomerByEmail(email);
      if (!existing) {
        return sendJson(response, 404, { error: "not_found", message: "No account exists for that email." });
      }

      return sendJson(response, 200, {
        customer: existing,
        state: await getStoredState(existing.id)
      });
    }

    if (mode === "signup") {
      const savedCustomer = await upsertCustomer(customer);
      return sendJson(response, 200, {
        customer: savedCustomer,
        state: await getStoredState(savedCustomer.id)
      });
    }

    if (mode === "reset") {
      return sendJson(response, 200, {
        message: `Password reset link queued for ${email}.`
      });
    }

    return sendJson(response, 400, { error: "bad_request", message: "Unsupported auth mode." });
  } catch (error) {
    return sendError(response, error);
  }
}
