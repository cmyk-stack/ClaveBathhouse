import { ensureSchema, findCustomerById, sendError, sendJson } from "./_db.js";
import { requireSession } from "./_security.js";

function getAppUrl(request) {
  if (process.env.PUBLIC_APP_URL) return process.env.PUBLIC_APP_URL.replace(/\/$/, "");
  const host = request.headers["x-forwarded-host"] || request.headers.host || "localhost:5173";
  const protocol = request.headers["x-forwarded-proto"] || "http";
  return `${protocol}://${host}`;
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendJson(response, 405, { error: "method_not_allowed" });
  }

  try {
    await ensureSchema();
    const session = requireSession(request, response);
    if (!session) return;

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      return sendJson(response, 503, {
        error: "stripe_not_configured",
        message: "Set STRIPE_SECRET_KEY in Vercel to enable live checkout."
      });
    }

    const customer = await findCustomerById(session.customerId);
    if (!customer) return sendJson(response, 404, { error: "not_found" });

    const { items = [], mode = "payment" } = request.body ?? {};
    const lineItems = items
      .filter((item) => item?.name && Number(item?.amountCents) >= 0)
      .map((item) => ({
        price_data: {
          currency: "aud",
          product_data: {
            name: String(item.name),
            metadata: {
              sessionId: String(item.sessionId ?? ""),
              typeId: String(item.typeId ?? "")
            }
          },
          unit_amount: Number(item.amountCents)
        },
        quantity: Number(item.quantity ?? 1)
      }));

    if (lineItems.length === 0) {
      return sendJson(response, 400, { error: "empty_checkout", message: "Choose at least one paid item." });
    }

    const appUrl = getAppUrl(request);
    const params = new URLSearchParams();
    params.set("mode", mode === "subscription" ? "subscription" : "payment");
    params.set("customer_email", customer.email);
    params.set("success_url", `${appUrl}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`);
    params.set("cancel_url", `${appUrl}/?checkout=cancelled`);
    params.set("metadata[customerId]", customer.id);
    params.set("metadata[customerEmail]", customer.email);

    lineItems.forEach((item, index) => {
      params.set(`line_items[${index}][price_data][currency]`, item.price_data.currency);
      params.set(`line_items[${index}][price_data][product_data][name]`, item.price_data.product_data.name);
      params.set(`line_items[${index}][price_data][unit_amount]`, String(item.price_data.unit_amount));
      params.set(`line_items[${index}][quantity]`, String(item.quantity));
    });

    const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      body: params,
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      method: "POST"
    });

    const stripeSession = await stripeResponse.json();
    if (!stripeResponse.ok) {
      return sendJson(response, stripeResponse.status, {
        error: "stripe_error",
        message: stripeSession.error?.message ?? "Stripe could not create checkout."
      });
    }

    return sendJson(response, 200, {
      id: stripeSession.id,
      url: stripeSession.url
    });
  } catch (error) {
    return sendError(response, error);
  }
}
