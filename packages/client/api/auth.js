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
  upsertCustomer
} from "./_db.js";
import { clearSessionCookie, getSession, hashPassword, setSessionCookie, verifyPassword } from "./_security.js";

export default async function handler(request, response) {
  if (!["GET", "POST", "DELETE"].includes(request.method)) {
    response.setHeader("Allow", "GET, POST, DELETE");
    return sendJson(response, 405, { error: "method_not_allowed" });
  }

  try {
    if (request.method === "GET") {
      const session = getSession(request);
      if (!session) return sendJson(response, 200, { customer: null, state: null });

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

      return sendJson(response, 200, {
        customer: savedCustomer,
        state: await getStoredState(savedCustomer.id)
      });
    }

    if (mode === "reset") {
      const resetToken = crypto.randomBytes(32).toString("base64url");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      await savePasswordResetToken(email, resetToken, expiresAt);
      return sendJson(response, 200, {
        message: `Password reset link queued for ${email}.`
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
