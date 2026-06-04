import crypto from "node:crypto";
import { ensureSchema, sendError, sendJson } from "./_db.js";

function verifyStripeSignature(rawBody, signatureHeader, secret) {
  if (!rawBody || !signatureHeader || !secret) return false;
  const timestamp = signatureHeader.match(/t=([^,]+)/)?.[1];
  const signature = signatureHeader.match(/v1=([^,]+)/)?.[1];
  if (!timestamp || !signature) return false;

  const expected = crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  return expectedBuffer.length === actualBuffer.length && crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendJson(response, 405, { error: "method_not_allowed" });
  }

  try {
    await ensureSchema();

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const rawBody = typeof request.body === "string" ? request.body : JSON.stringify(request.body ?? {});
    if (webhookSecret && !verifyStripeSignature(rawBody, request.headers["stripe-signature"], webhookSecret)) {
      return sendJson(response, 400, { error: "invalid_signature" });
    }

    const event = typeof request.body === "string" ? JSON.parse(request.body) : request.body;
    if (event?.type === "checkout.session.completed") {
      console.log("Stripe checkout completed", event.data?.object?.id);
    }

    return sendJson(response, 200, { received: true });
  } catch (error) {
    return sendError(response, error);
  }
}
