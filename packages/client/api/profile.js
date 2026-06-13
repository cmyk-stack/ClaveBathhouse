import { ensureSchema, getStoredState, sendError, sendJson, updateCustomerProfile } from "../server/db.js";
import { sendTransactionalEmail } from "../server/email.js";
import { requireSession } from "../server/security.js";

export default async function handler(request, response) {
  try {
    const session = requireSession(request, response);
    if (!session) return;
    await ensureSchema();

    if (request.method !== "POST") {
      response.setHeader("Allow", "POST");
      return sendJson(response, 405, { error: "method_not_allowed" });
    }

    const name = String(request.body?.name ?? "").trim();
    const phone = String(request.body?.phone ?? "").trim();
    if (!name) {
      return sendJson(response, 400, { error: "bad_request", message: "Name is required." });
    }

    const customer = await updateCustomerProfile({
      customerId: session.customerId,
      name,
      phone
    });
    if (!customer) return sendJson(response, 404, { error: "not_found", message: "Customer was not found." });
    await sendTransactionalEmail({
      subject: "Clave Bathhouse profile updated",
      text: `Hi ${customer.name},\n\nYour Clave Bathhouse profile details were updated.`,
      to: customer.email
    });

    return sendJson(response, 200, {
      customer,
      state: await getStoredState(customer.id)
    });
  } catch (error) {
    return sendError(response, error);
  }
}
