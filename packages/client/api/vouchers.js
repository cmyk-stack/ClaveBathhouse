import { addCustomerCredits, createVoucherRecord, ensureSchema, findCustomerById, listTransactions, redeemVoucherRecord, sendError, sendJson } from "../server/db.js";
import { sendTransactionalEmail } from "../server/email.js";
import { requireSession } from "../server/security.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendJson(response, 405, { error: "method_not_allowed" });
  }

  try {
    const session = requireSession(request, response);
    if (!session) return;
    await ensureSchema();
    const currentCustomer = await findCustomerById(session.customerId);
    if (!currentCustomer) return sendJson(response, 401, { error: "unauthorized", message: "Sign in to continue." });
    const effectiveSession = { ...session, role: currentCustomer.role };

    if (request.body?.action === "redeem") {
      const code = String(request.body?.code ?? "").trim();
      if (!code) return sendJson(response, 400, { error: "bad_request", message: "Enter a voucher code." });

      const result = await redeemVoucherRecord({ code, customerId: session.customerId });
      if (!result) {
        return sendJson(response, 409, { error: "voucher_not_redeemable", message: "That voucher code is invalid or has already been redeemed." });
      }

      return sendJson(response, 200, result);
    }

    const amountCents = Math.round(Number(request.body?.amount ?? 0) * 100);
    const mode = request.body?.mode === "credit" ? "credit" : "send";
    const recipientEmail = String(request.body?.recipientEmail ?? "").trim();

    if (amountCents < 100) {
      return sendJson(response, 400, { error: "bad_request", message: "Enter a voucher value of at least $1." });
    }
    if (mode === "send" && !recipientEmail) {
      return sendJson(response, 400, { error: "bad_request", message: "Enter the recipient email address." });
    }

    const customer = currentCustomer;

    const voucher = await createVoucherRecord({
      amountCents,
      purchaserCustomerId: customer.id,
      recipientEmail: mode === "send" ? recipientEmail : customer.email
    });
    if (!voucher) return sendJson(response, 500, { error: "voucher_not_created", message: "Voucher could not be created." });

    if (mode === "send") {
      await sendTransactionalEmail({
        subject: "Clave Bathhouse gift voucher",
        text: `You have received a Clave Bathhouse gift voucher.\n\nValue: $${(amountCents / 100).toFixed(2)}\nCode: ${voucher.code}\n\nUse this code when booking or show it at reception.`,
        to: recipientEmail
      });
      return sendJson(response, 201, {
        transactions: await listTransactions({ customerId: effectiveSession.customerId, role: effectiveSession.role }),
        voucher
      });
    }

    const credits = Math.max(1, Math.floor(amountCents / 5800));
    const updatedCustomer = await addCustomerCredits({ credits, customerId: customer.id });
    return sendJson(response, 201, {
      creditsAdded: credits,
      customer: updatedCustomer,
      transactions: await listTransactions({ customerId: effectiveSession.customerId, role: effectiveSession.role }),
      voucher
    });
  } catch (error) {
    return sendError(response, error);
  }
}
