import {
  ensureSchema,
  findCustomerById,
  getStoredState,
  listBookings,
  listCustomers,
  listSessions,
  listTransactions,
  refundTransactionRecord,
  saveStoredState,
  sendError,
  sendJson,
  upsertCustomer
} from "../server/db.js";
import { requireFreshRole } from "../server/roles.js";
import { requireSession } from "../server/security.js";

function withoutNotices(state) {
  if (!state || typeof state !== "object") return state;
  const { notices: _discardedNotices, ...safeState } = state;
  return safeState;
}

export default async function handler(request, response) {
  try {
    const session = requireSession(request, response);
    if (!session) return;
    await ensureSchema();
    const currentCustomer = await findCustomerById(session.customerId);
    if (!currentCustomer) return sendJson(response, 401, { error: "unauthorized", message: "Sign in to continue." });
    const effectiveSession = { ...session, role: currentCustomer.role };

    if (request.method === "GET") {
      const customerId = effectiveSession.role === "admin" ? String(request.query.customerId ?? effectiveSession.customerId) : effectiveSession.customerId;
      return sendJson(response, 200, {
        bookings: await listBookings({ customerId: effectiveSession.customerId, role: effectiveSession.role }),
        customers: effectiveSession.role === "admin" ? await listCustomers() : undefined,
        sessions: await listSessions(),
        transactions: await listTransactions({ customerId: effectiveSession.customerId, role: effectiveSession.role }),
        state: withoutNotices(await getStoredState(customerId))
      });
    }

    if (request.method === "POST") {
      const { action, customer, state, transactionId } = request.body ?? {};

      if (action === "refund-transaction") {
        const adminSession = await requireFreshRole(request, response, ["admin"]);
        if (!adminSession) return;

        const transaction = await refundTransactionRecord({ transactionId });
        if (!transaction) {
          return sendJson(response, 409, { error: "not_refundable", message: "That transaction has already been refunded or no longer exists." });
        }

        return sendJson(response, 200, {
          transaction,
          transactions: await listTransactions({ customerId: adminSession.customerId, role: adminSession.role })
        });
      }

      if (!state) return sendJson(response, 400, { error: "bad_request" });

      const storedCustomer = currentCustomer;
      if (!storedCustomer) return sendJson(response, 404, { error: "not_found" });

      const nextCustomer = effectiveSession.role === "admin" && customer?.id ? customer : { ...storedCustomer, ...customer, id: storedCustomer.id };
      await upsertCustomer(nextCustomer);
      await saveStoredState(nextCustomer.id, {
        ...withoutNotices(state),
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
