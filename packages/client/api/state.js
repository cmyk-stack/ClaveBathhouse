import {
  ensureSchema,
  findCustomerById,
  listBookings,
  listCustomers,
  listSessions,
  listTransactions,
  refundTransactionRecord,
  sendError,
  sendJson
} from "../server/db.js";
import { requireFreshRole } from "../server/roles.js";
import { requireSession } from "../server/security.js";

export default async function handler(request, response) {
  try {
    const session = requireSession(request, response);
    if (!session) return;
    await ensureSchema();
    const currentCustomer = await findCustomerById(session.customerId);
    if (!currentCustomer) return sendJson(response, 401, { error: "unauthorized", message: "Sign in to continue." });
    const effectiveSession = { ...session, role: currentCustomer.role };

    if (request.method === "GET") {
      return sendJson(response, 200, {
        bookings: await listBookings({ customerId: effectiveSession.customerId, role: effectiveSession.role }),
        customers: effectiveSession.role === "admin" ? await listCustomers() : undefined,
        sessions: await listSessions(),
        transactions: await listTransactions({ customerId: effectiveSession.customerId, role: effectiveSession.role })
      });
    }

    if (request.method === "POST") {
      const { action, transactionId } = request.body ?? {};

      if (action === "refund-transaction") {
        const adminSession = await requireFreshRole(request, response, ["admin"]);
        if (!adminSession) return;

        const transaction = await refundTransactionRecord({ transactionId });
        if (!transaction) {
          return sendJson(response, 409, { error: "not_refundable", message: "That transaction has already been refunded or no longer exists." });
        }

        return sendJson(response, 200, {
          transaction,
          bookings: await listBookings({ customerId: adminSession.customerId, role: adminSession.role }),
          customers: await listCustomers(),
          sessions: await listSessions(),
          transactions: await listTransactions({ customerId: adminSession.customerId, role: adminSession.role })
        });
      }

      return sendJson(response, 400, { error: "bad_request", message: "Choose a valid state action." });
    }

    response.setHeader("Allow", "GET, POST");
    return sendJson(response, 405, { error: "method_not_allowed" });
  } catch (error) {
    return sendError(response, error);
  }
}
