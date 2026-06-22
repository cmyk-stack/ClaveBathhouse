import {
  ensureSchema,
  findCustomerById,
  listTransactions,
  sendError,
  sendJson,
  updateCustomerMembership,
  updateCustomerProfile
} from "../server/db.js";
import { sendTransactionalEmail } from "../server/email.js";
import { requireSession } from "../server/security.js";

const membershipPlans = {
  "drop-in": { credits: 0, id: "drop-in", name: "Drop In", price: 0 },
  flow: { credits: 4, id: "flow", name: "Flow", price: 149 },
  restore: { credits: 9, id: "restore", name: "Restore", price: 279 }
};

export default async function handler(request, response) {
  try {
    const session = requireSession(request, response);
    if (!session) return;
    await ensureSchema();
    const currentCustomer = await findCustomerById(session.customerId);
    if (!currentCustomer) return sendJson(response, 401, { error: "unauthorized", message: "Sign in to continue." });
    const effectiveSession = { ...session, role: currentCustomer.role };

    if (request.method !== "POST") {
      response.setHeader("Allow", "POST");
      return sendJson(response, 405, { error: "method_not_allowed" });
    }

    if (request.body?.action === "membership") {
      const membershipId = String(request.body?.membershipId ?? "");
      const plan = membershipPlans[membershipId];
      if (!plan) {
        return sendJson(response, 400, { error: "bad_request", message: "Choose a valid membership." });
      }

      const existingCustomer = currentCustomer;
      if (!existingCustomer) return sendJson(response, 404, { error: "not_found", message: "Customer was not found." });

      const customer =
        existingCustomer.membershipId === plan.id
          ? existingCustomer
          : await updateCustomerMembership({
              amountCents: Math.round(plan.price * 100),
              credits: plan.credits,
              customerId: session.customerId,
              membershipId: plan.id
            });

      if (!customer) return sendJson(response, 404, { error: "not_found", message: "Customer was not found." });

      await sendTransactionalEmail({
        subject: "Clave Bathhouse membership updated",
        text: `Hi ${customer.name},\n\n${plan.name} is active on your Clave Bathhouse account. Demo payment was approved for testing.`,
        to: customer.email
      });

      return sendJson(response, 200, {
        customer,
        transactions: await listTransactions({ customerId: effectiveSession.customerId, role: effectiveSession.role })
      });
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

    return sendJson(response, 200, { customer });
  } catch (error) {
    return sendError(response, error);
  }
}
