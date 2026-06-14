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

    if (request.method === "GET") {
      const customerId = session.role === "admin" ? String(request.query.customerId ?? session.customerId) : session.customerId;
      return sendJson(response, 200, {
        bookings: await listBookings({ customerId: session.customerId, role: session.role }),
        customers: session.role === "admin" ? await listCustomers() : undefined,
        sessions: await listSessions(),
        transactions: await listTransactions({ customerId: session.customerId, role: session.role }),
        state: withoutNotices(await getStoredState(customerId))
      });
    }

    if (request.method === "POST") {
      const { action, customer, state, transactionId } = request.body ?? {};

      if (action === "refund-transaction") {
        if (session.role !== "admin") {
          return sendJson(response, 403, { error: "forbidden", message: "Only admins can refund transactions." });
        }

        const transaction = await refundTransactionRecord({ transactionId });
        if (!transaction) {
          return sendJson(response, 409, { error: "not_refundable", message: "That transaction has already been refunded or no longer exists." });
        }

        return sendJson(response, 200, {
          transaction,
          transactions: await listTransactions({ customerId: session.customerId, role: session.role })
        });
      }

      if (!state) return sendJson(response, 400, { error: "bad_request" });

      const storedCustomer = await findCustomerById(session.customerId);
      if (!storedCustomer) return sendJson(response, 404, { error: "not_found" });

      const nextCustomer = session.role === "admin" && customer?.id ? customer : { ...storedCustomer, ...customer, id: storedCustomer.id };
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
