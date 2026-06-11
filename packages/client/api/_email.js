export async function sendTransactionalEmail({ subject, text, to }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from || !to) {
    console.log("Email skipped", { reason: "email_not_configured", subject, to });
    return { skipped: true };
  }

  let response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      body: JSON.stringify({
        from,
        subject,
        text,
        to
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      method: "POST"
    });
  } catch (error) {
    console.error("Email transport failed", error);
    return { error: "transport_failed", skipped: false };
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("Email failed", body);
    return { error: body, skipped: false };
  }

  return { id: body.id, skipped: false };
}

export function bookingEmailText({ booking, session }) {
  const status = booking.status === "waitlist" ? "waitlist" : "confirmed";
  return [
    `Your Clave Bathhouse booking is ${status}.`,
    "",
    `Session: ${session?.typeId ?? booking.sessionId}`,
    `Date: ${session?.date ?? "TBC"}`,
    `Time: ${session?.time ?? "TBC"}`,
    `Booking ID: ${booking.id}`
  ].join("\n");
}
