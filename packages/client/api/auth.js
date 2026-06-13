import crypto from "node:crypto";
import {
  customerFromRow,
  ensureSchema,
  findCustomerById,
  findCustomerWithAuthByEmail,
  getStoredState,
  savePasswordResetToken,
  sendError,
  sendJson,
  updateCustomerPassword,
  upsertCustomer,
  verifyPasswordResetToken
} from "../server/db.js";
import { sendTransactionalEmail } from "../server/email.js";
import { clearSessionCookie, getSession, hashPassword, setSessionCookie, verifyPassword } from "../server/security.js";

export default async function handler(request, response) {
  if (!["GET", "POST", "DELETE"].includes(request.method)) {
    response.setHeader("Allow", "GET, POST, DELETE");
    return sendJson(response, 405, { error: "method_not_allowed" });
  }

  try {
    if (request.method === "GET") {
      const session = getSession(request);
      if (!session) {
        const authResult = request.query?.debug === "1";
        return sendJson(response, 200, authResult ? { customer: null, hasSession: false, state: null } : { customer: null, state: null });
      }

      await ensureSchema();
      const customer = await findCustomerById(session.customerId);
      if (!customer) {
        clearSessionCookie(response);
        return sendJson(response, 200, { customer: null, state: null });
      }

      return sendJson(response, 200, {
        customer,
        state: await getStoredState(customer.id)
      });
    }

    if (request.method === "DELETE") {
      clearSessionCookie(response);
      return sendJson(response, 200, { ok: true });
    }

    await ensureSchema();
    const { mode, customer, email } = request.body ?? {};
    if (mode === "login") {
      const existing = await findCustomerWithAuthByEmail(email);
      const passwordOk = await verifyPassword(String(request.body?.password ?? ""), existing?.password_hash);
      if (!existing || !passwordOk) {
        return sendJson(response, 404, { error: "not_found", message: "No account exists for that email." });
      }

      const publicCustomer = customerFromRow(existing);
      setSessionCookie(response, {
        customerId: publicCustomer.id,
        email: publicCustomer.email,
        role: publicCustomer.role
      });

      return sendJson(response, 200, {
        customer: publicCustomer,
        state: await getStoredState(publicCustomer.id)
      });
    }

    if (mode === "signup") {
      const password = String(request.body?.password ?? "");
      if (!customer?.email || !customer?.name || password.length < 8) {
        return sendJson(response, 400, { error: "bad_request", message: "Use a name, email, and password of at least 8 characters." });
      }

      const savedCustomer = await upsertCustomer(
        {
          ...customer,
          role: "customer"
        },
        await hashPassword(password)
      );
      setSessionCookie(response, {
        customerId: savedCustomer.id,
        email: savedCustomer.email,
        role: savedCustomer.role
      });
      await sendTransactionalEmail({
        subject: "Welcome to Clave Bathhouse",
        text: `Hi ${savedCustomer.name},\n\nYour Clave Bathhouse account is ready.`,
        to: savedCustomer.email
      });

      return sendJson(response, 200, {
        customer: savedCustomer,
        state: await getStoredState(savedCustomer.id)
      });
    }

    if (mode === "reset") {
      const resetToken = crypto.randomBytes(32).toString("base64url");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const tokenSaved = await savePasswordResetToken(email, resetToken, expiresAt);
      if (tokenSaved) {
        await sendTransactionalEmail({
          subject: "Clave Bathhouse password reset",
          text: `A password reset was requested for your Clave Bathhouse account.\n\nReset token: ${resetToken}\n\nThis token expires in 1 hour.`,
          to: email
        });
      }
      return sendJson(response, 200, {
        message: "If an account exists for that email, a reset token has been sent."
      });
    }

    if (mode === "reset-complete") {
      const token = String(request.body?.token ?? "").trim();
      const password = String(request.body?.password ?? "");
      if (!email || !token || password.length < 8) {
        return sendJson(response, 400, { error: "bad_request", message: "Enter your email, reset token, and a new password of at least 8 characters." });
      }

      const existing = await verifyPasswordResetToken({ email, token });
      if (!existing) {
        return sendJson(response, 400, { error: "invalid_reset_token", message: "That reset token is invalid or expired." });
      }

      const customer = await updateCustomerPassword({
        customerId: existing.id,
        passwordHash: await hashPassword(password)
      });
      if (!customer) return sendJson(response, 404, { error: "not_found", message: "Account could not be updated." });

      setSessionCookie(response, {
        customerId: customer.id,
        email: customer.email,
        role: customer.role
      });
      await sendTransactionalEmail({
        subject: "Clave Bathhouse password changed",
        text: `Hi ${customer.name},\n\nYour Clave Bathhouse password was changed. If this was not you, contact Clave Bathhouse straight away.`,
        to: customer.email
      });

      return sendJson(response, 200, {
        customer,
        state: await getStoredState(customer.id)
      });
    }

    if (mode === "social") {
      return sendJson(response, 501, {
        error: "provider_not_configured",
        message: "OAuth provider configuration is not connected yet."
      });
    }

    return sendJson(response, 400, { error: "bad_request", message: "Unsupported auth mode." });
  } catch (error) {
    return sendError(response, error);
  }
}
