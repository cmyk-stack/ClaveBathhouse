import crypto from "node:crypto";
import { sql } from "@vercel/postgres";
import { hashPassword } from "./security.js";

const seedLocations = [
  { id: "scarborough", name: "Clave Scarborough", address: "West Coast Highway, Scarborough WA", hours: "6:00am - 9:00pm" },
  { id: "fremantle", name: "Clave Fremantle", address: "Market Street, Fremantle WA", hours: "7:00am - 8:00pm" }
];

export function isDatabaseConfigured() {
  return Boolean(process.env.POSTGRES_URL);
}

export function assertDatabaseConfigured() {
  if (!isDatabaseConfigured()) {
    const error = new Error("Neon database is not configured. Set POSTGRES_URL in Vercel.");
    error.code = "database_not_configured";
    throw error;
  }
}

export async function checkDatabaseConnection() {
  assertDatabaseConfigured();
  await sql`SELECT 1`;
  return true;
}

export async function ensureSchema() {
  assertDatabaseConfigured();

  await sql`
    CREATE TABLE IF NOT EXISTS clave_customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT NOT NULL,
      membership_id TEXT NOT NULL,
      credits INTEGER NOT NULL DEFAULT 0,
      payment_method TEXT NOT NULL,
      password_hash TEXT,
      role TEXT NOT NULL DEFAULT 'customer',
      stripe_customer_id TEXT,
      password_reset_token TEXT,
      password_reset_expires_at TIMESTAMPTZ,
      google_sub TEXT UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`ALTER TABLE clave_customers ADD COLUMN IF NOT EXISTS password_hash TEXT`;
  await sql`ALTER TABLE clave_customers ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'customer'`;
  await sql`ALTER TABLE clave_customers ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT`;
  await sql`ALTER TABLE clave_customers ADD COLUMN IF NOT EXISTS password_reset_token TEXT`;
  await sql`ALTER TABLE clave_customers ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMPTZ`;
  await sql`ALTER TABLE clave_customers ADD COLUMN IF NOT EXISTS google_sub TEXT UNIQUE`;

  await sql`
    CREATE TABLE IF NOT EXISTS clave_locations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      hours TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS clave_sessions (
      id TEXT PRIMARY KEY,
      location_id TEXT REFERENCES clave_locations(id),
      type_id TEXT NOT NULL,
      starts_at TIMESTAMPTZ NOT NULL,
      capacity INTEGER NOT NULL CHECK (capacity > 0),
      practitioner TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`ALTER TABLE clave_sessions ADD COLUMN IF NOT EXISTS location_id TEXT REFERENCES clave_locations(id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS clave_bookings (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES clave_sessions(id),
      customer_id TEXT NOT NULL REFERENCES clave_customers(id),
      status TEXT NOT NULL CHECK (status IN ('confirmed', 'waitlist', 'cancelled', 'checked-in')),
      paid_cents INTEGER NOT NULL DEFAULT 0,
      payment_id TEXT,
      stripe_checkout_session_id TEXT,
      stripe_payment_intent_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`ALTER TABLE clave_bookings ADD COLUMN IF NOT EXISTS payment_id TEXT`;

  await sql`
    CREATE TABLE IF NOT EXISTS clave_admin_audit (
      id TEXT PRIMARY KEY,
      actor_customer_id TEXT NOT NULL REFERENCES clave_customers(id),
      target_customer_id TEXT REFERENCES clave_customers(id),
      action TEXT NOT NULL,
      details JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS clave_transactions (
      id TEXT PRIMARY KEY,
      booking_id TEXT,
      customer_id TEXT REFERENCES clave_customers(id),
      amount_cents INTEGER NOT NULL,
      status TEXT NOT NULL,
      provider TEXT NOT NULL DEFAULT 'stripe',
      provider_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS clave_vouchers (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      purchaser_customer_id TEXT NOT NULL REFERENCES clave_customers(id),
      recipient_email TEXT,
      amount_cents INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'issued',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      redeemed_at TIMESTAMPTZ
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS clave_app_state (
      customer_id TEXT PRIMARY KEY REFERENCES clave_customers(id) ON DELETE CASCADE,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await seedFirstAdmin();

  for (const location of seedLocations) {
    await sql`
      INSERT INTO clave_locations (id, name, address, hours)
      VALUES (${location.id}, ${location.name}, ${location.address}, ${location.hours})
      ON CONFLICT (id) DO NOTHING
    `;
  }

}

async function seedFirstAdmin() {
  const firstAdminEmail = process.env.FIRST_ADMIN_EMAIL;
  if (!firstAdminEmail) return;

  const firstAdminName = process.env.FIRST_ADMIN_NAME || firstAdminEmail.split("@")[0];
  const firstAdminPassword = process.env.FIRST_ADMIN_PASSWORD;
  const passwordHash = firstAdminPassword ? await hashPassword(firstAdminPassword) : null;

  await sql`
    INSERT INTO clave_customers (id, name, email, phone, membership_id, credits, payment_method, password_hash, role)
    VALUES (
      ${`admin-${firstAdminEmail.toLowerCase()}`},
      ${firstAdminName},
      ${firstAdminEmail},
      ${""},
      ${"drop-in"},
      ${0},
      ${""},
      ${passwordHash},
      ${"admin"}
    )
    ON CONFLICT (email)
    DO UPDATE SET
      role = 'admin',
      password_hash = COALESCE(EXCLUDED.password_hash, clave_customers.password_hash)
  `;
}

export function customerFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    membershipId: row.membership_id,
    credits: row.credits,
    paymentMethod: row.payment_method,
    role: row.role ?? "customer",
    stripeCustomerId: row.stripe_customer_id ?? null
  };
}

export async function findCustomerByEmail(email) {
  const result = await sql`
    SELECT id, name, email, phone, membership_id, credits, payment_method, role, stripe_customer_id
    FROM clave_customers
    WHERE lower(email) = lower(${email})
    LIMIT 1
  `;

  return result.rows[0] ? customerFromRow(result.rows[0]) : null;
}

export async function findCustomerByGoogleSub(googleSub) {
  const result = await sql`
    SELECT id, name, email, phone, membership_id, credits, payment_method, role, stripe_customer_id
    FROM clave_customers
    WHERE google_sub = ${googleSub}
    LIMIT 1
  `;

  return result.rows[0] ? customerFromRow(result.rows[0]) : null;
}

export async function findCustomerWithAuthByEmail(email) {
  const result = await sql`
    SELECT id, name, email, phone, membership_id, credits, payment_method, password_hash, role, stripe_customer_id
    FROM clave_customers
    WHERE lower(email) = lower(${email})
    LIMIT 1
  `;

  return result.rows[0] ?? null;
}

export async function findCustomerById(customerId) {
  const result = await sql`
    SELECT id, name, email, phone, membership_id, credits, payment_method, role, stripe_customer_id
    FROM clave_customers
    WHERE id = ${customerId}
    LIMIT 1
  `;

  return result.rows[0] ? customerFromRow(result.rows[0]) : null;
}

export async function listCustomers() {
  const result = await sql`
    SELECT id, name, email, phone, membership_id, credits, payment_method, role, stripe_customer_id
    FROM clave_customers
    ORDER BY created_at DESC
  `;

  return result.rows.map(customerFromRow);
}

export async function verifyPasswordResetToken({ email, token }) {
  const result = await sql`
    SELECT id, name, email, phone, membership_id, credits, payment_method, password_hash, role, stripe_customer_id
    FROM clave_customers
    WHERE lower(email) = lower(${email})
      AND password_reset_token = ${token}
      AND password_reset_expires_at > NOW()
    LIMIT 1
  `;

  return result.rows[0] ?? null;
}

export async function updateCustomerPassword({ customerId, passwordHash }) {
  const result = await sql`
    UPDATE clave_customers
    SET
      password_hash = ${passwordHash},
      password_reset_token = NULL,
      password_reset_expires_at = NULL
    WHERE id = ${customerId}
    RETURNING id, name, email, phone, membership_id, credits, payment_method, role, stripe_customer_id
  `;

  return result.rows[0] ? customerFromRow(result.rows[0]) : null;
}

export async function addCustomerCredits({ credits, customerId }) {
  const result = await sql`
    UPDATE clave_customers
    SET credits = credits + ${credits}
    WHERE id = ${customerId}
    RETURNING id, name, email, phone, membership_id, credits, payment_method, role, stripe_customer_id
  `;

  return result.rows[0] ? customerFromRow(result.rows[0]) : null;
}

export async function createVoucherRecord({ amountCents, purchaserCustomerId, recipientEmail }) {
  const code = `CLAVE-${Math.random().toString(36).slice(2, 8).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const result = await sql`
    INSERT INTO clave_vouchers (id, code, purchaser_customer_id, recipient_email, amount_cents)
    VALUES (${`v-${crypto.randomUUID()}`}, ${code}, ${purchaserCustomerId}, ${recipientEmail || null}, ${amountCents})
    RETURNING id, code, recipient_email, amount_cents, status, created_at
  `;

  const voucher = result.rows[0];
  return voucher
    ? {
        amountCents: voucher.amount_cents,
        code: voucher.code,
        createdAt: voucher.created_at,
        id: voucher.id,
        recipientEmail: voucher.recipient_email,
        status: voucher.status
      }
    : null;
}

export async function countAdmins() {
  const result = await sql`
    SELECT count(*)::int AS total
    FROM clave_customers
    WHERE role = 'admin'
  `;
  return Number(result.rows[0]?.total ?? 0);
}

export async function recordAdminAudit({ action, actorCustomerId, details = {}, targetCustomerId = null }) {
  await sql`
    INSERT INTO clave_admin_audit (id, actor_customer_id, target_customer_id, action, details)
    VALUES (${`audit-${Date.now()}-${Math.random().toString(36).slice(2)}`}, ${actorCustomerId}, ${targetCustomerId}, ${action}, ${JSON.stringify(details)}::jsonb)
  `;
}

export async function updateCustomerRole({ customerId, role }) {
  const result = await sql`
    UPDATE clave_customers
    SET role = ${role}
    WHERE id = ${customerId}
    RETURNING id, name, email, phone, membership_id, credits, payment_method, role, stripe_customer_id
  `;

  return result.rows[0] ? customerFromRow(result.rows[0]) : null;
}

export async function updateCustomerProfile({ customerId, name, phone }) {
  const result = await sql`
    UPDATE clave_customers
    SET
      name = ${name},
      phone = ${phone}
    WHERE id = ${customerId}
    RETURNING id, name, email, phone, membership_id, credits, payment_method, role, stripe_customer_id
  `;

  return result.rows[0] ? customerFromRow(result.rows[0]) : null;
}

export async function upsertCustomer(customer, passwordHash = null) {
  await sql`
    INSERT INTO clave_customers (id, name, email, phone, membership_id, credits, payment_method, password_hash, role)
    VALUES (
      ${customer.id},
      ${customer.name},
      ${customer.email},
      ${customer.phone},
      ${customer.membershipId},
      ${customer.credits},
      ${customer.paymentMethod},
      ${passwordHash},
      ${customer.role ?? "customer"}
    )
    ON CONFLICT (email)
    DO UPDATE SET
      name = EXCLUDED.name,
      phone = EXCLUDED.phone,
      membership_id = EXCLUDED.membership_id,
      credits = EXCLUDED.credits,
      payment_method = EXCLUDED.payment_method,
      password_hash = COALESCE(EXCLUDED.password_hash, clave_customers.password_hash),
      role = clave_customers.role
  `;

  return findCustomerByEmail(customer.email);
}

export async function upsertGoogleCustomer(profile) {
  const name = profile.name || profile.email.split("@")[0];
  const existingBySub = await findCustomerByGoogleSub(profile.sub);
  if (existingBySub) {
    const result = await sql`
      UPDATE clave_customers
      SET
        name = COALESCE(NULLIF(${name}, ''), name)
      WHERE id = ${existingBySub.id}
      RETURNING id, name, email, phone, membership_id, credits, payment_method, role, stripe_customer_id
    `;
    return result.rows[0] ? customerFromRow(result.rows[0]) : null;
  }

  const existingByEmail = await findCustomerByEmail(profile.email);
  if (existingByEmail) {
    const result = await sql`
      UPDATE clave_customers
      SET
        google_sub = ${profile.sub},
        name = COALESCE(NULLIF(${name}, ''), name)
      WHERE id = ${existingByEmail.id}
      RETURNING id, name, email, phone, membership_id, credits, payment_method, role, stripe_customer_id
    `;
    return result.rows[0] ? customerFromRow(result.rows[0]) : null;
  }

  const result = await sql`
    INSERT INTO clave_customers (id, name, email, phone, membership_id, credits, payment_method, role, google_sub)
    VALUES (${`g-${crypto.randomUUID()}`}, ${name}, ${profile.email}, '', 'drop-in', 0, '', 'customer', ${profile.sub})
    RETURNING id, name, email, phone, membership_id, credits, payment_method, role, stripe_customer_id
  `;

  return result.rows[0] ? customerFromRow(result.rows[0]) : null;
}

export async function savePasswordResetToken(email, token, expiresAt) {
  const result = await sql`
    UPDATE clave_customers
    SET password_reset_token = ${token}, password_reset_expires_at = ${expiresAt}
    WHERE lower(email) = lower(${email})
  `;
  return result.rowCount > 0;
}

export async function getStoredState(customerId) {
  const result = await sql`
    SELECT payload
    FROM clave_app_state
    WHERE customer_id = ${customerId}
    LIMIT 1
  `;

  const payload = result.rows[0]?.payload ?? null;
  if (!payload || typeof payload !== "object") return payload;
  const { notices, ...safePayload } = payload;
  return safePayload;
}

export async function saveStoredState(customerId, payload) {
  await sql`
    INSERT INTO clave_app_state (customer_id, payload, updated_at)
    VALUES (${customerId}, ${JSON.stringify(payload)}::jsonb, NOW())
    ON CONFLICT (customer_id)
    DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()
  `;
}

function datePartsFromStartsAt(startsAt) {
  const date = new Date(startsAt);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    timeZone: "Australia/Perth",
    year: "numeric"
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`
  };
}

export function sessionFromRow(row) {
  const parts = datePartsFromStartsAt(row.starts_at);
  return {
    id: row.id,
    typeId: row.type_id,
    date: parts.date,
    time: parts.time,
    capacity: row.capacity,
    practitioner: row.practitioner,
    locationId: row.location_id
  };
}

export function bookingFromRow(row) {
  return {
    id: row.id,
    sessionId: row.session_id,
    customerId: row.customer_id,
    customerName: row.customer_name,
    status: row.status,
    paid: Number(row.paid_cents ?? 0) / 100,
    createdAt: row.created_at,
    paymentId: row.payment_id ?? row.stripe_payment_intent_id ?? row.stripe_checkout_session_id ?? undefined
  };
}

export async function listSessions() {
  const result = await sql`
    SELECT id, location_id, type_id, starts_at, capacity, practitioner
    FROM clave_sessions
    WHERE starts_at > NOW()
    ORDER BY starts_at ASC
  `;
  return result.rows.map(sessionFromRow);
}

export async function createSessionRecord(session) {
  const id = session.id ?? `s${Date.now()}`;
  const startsAt = `${session.date}T${session.time}:00+08:00`;
  const result = await sql`
    INSERT INTO clave_sessions (id, location_id, type_id, starts_at, capacity, practitioner)
    VALUES (${id}, ${session.locationId ?? "scarborough"}, ${session.typeId}, ${startsAt}, ${session.capacity}, ${session.practitioner ?? "Clave Team"})
    RETURNING id, location_id, type_id, starts_at, capacity, practitioner
  `;
  return sessionFromRow(result.rows[0]);
}

export async function updateSessionRecord({ sessionId, session }) {
  const startsAt = `${session.date}T${session.time}:00+08:00`;
  const result = await sql`
    UPDATE clave_sessions
    SET
      type_id = ${session.typeId},
      starts_at = ${startsAt},
      capacity = ${session.capacity},
      practitioner = ${session.practitioner ?? "Clave Team"},
      location_id = ${session.locationId ?? "scarborough"}
    WHERE id = ${sessionId}
    RETURNING id, location_id, type_id, starts_at, capacity, practitioner
  `;
  return result.rows[0] ? sessionFromRow(result.rows[0]) : null;
}

export async function deleteSessionRecord({ sessionId }) {
  const activeBookings = await sql`
    SELECT count(*)::int AS total
    FROM clave_bookings
    WHERE session_id = ${sessionId}
      AND status IN ('confirmed', 'waitlist', 'checked-in')
  `;

  if (Number(activeBookings.rows[0]?.total ?? 0) > 0) {
    const error = new Error("Cancel or move active bookings before removing this session.");
    error.code = "session_has_bookings";
    throw error;
  }

  const result = await sql`
    DELETE FROM clave_sessions
    WHERE id = ${sessionId}
    RETURNING id, location_id, type_id, starts_at, capacity, practitioner
  `;
  return result.rows[0] ? sessionFromRow(result.rows[0]) : null;
}

export async function findSessionById(sessionId) {
  const result = await sql`
    SELECT id, location_id, type_id, starts_at, capacity, practitioner
    FROM clave_sessions
    WHERE id = ${sessionId}
    LIMIT 1
  `;
  return result.rows[0] ? sessionFromRow(result.rows[0]) : null;
}

export async function listBookings({ customerId, role }) {
  const result =
    role === "staff" || role === "admin"
      ? await sql`
          SELECT b.id, b.session_id, b.customer_id, c.name AS customer_name, b.status, b.paid_cents, b.payment_id, b.created_at
          FROM clave_bookings b
          JOIN clave_customers c ON c.id = b.customer_id
          ORDER BY b.created_at DESC
        `
      : await sql`
          SELECT b.id, b.session_id, b.customer_id, c.name AS customer_name, b.status, b.paid_cents, b.payment_id, b.created_at
          FROM clave_bookings b
          JOIN clave_customers c ON c.id = b.customer_id
          WHERE b.customer_id = ${customerId}
          ORDER BY b.created_at DESC
        `;
  return result.rows.map(bookingFromRow);
}

export async function createBookingRecord({ customer, sessionId, amountCents }) {
  const id = `b${Date.now()}-${sessionId}`;
  const result = await sql`
    WITH locked AS (
      SELECT pg_advisory_xact_lock(hashtext(${sessionId})) AS lock
    ),
    target_session AS (
      SELECT id, capacity
      FROM clave_sessions
      WHERE id = ${sessionId}
        AND starts_at > NOW()
    ),
    existing_booking AS (
      SELECT id
      FROM clave_bookings
      WHERE session_id = ${sessionId}
        AND customer_id = ${customer.id}
        AND status IN ('confirmed', 'waitlist', 'checked-in')
      LIMIT 1
    ),
    active_count AS (
      SELECT count(*)::int AS total
      FROM clave_bookings
      WHERE session_id = ${sessionId}
        AND status IN ('confirmed', 'checked-in')
    ),
    inserted AS (
      INSERT INTO clave_bookings (id, session_id, customer_id, status, paid_cents, payment_id)
      SELECT
        ${id},
        target_session.id,
        ${customer.id},
        CASE WHEN active_count.total >= target_session.capacity THEN 'waitlist' ELSE 'confirmed' END,
        CASE WHEN active_count.total >= target_session.capacity THEN 0 ELSE ${amountCents} END,
        CASE WHEN active_count.total >= target_session.capacity THEN NULL ELSE ${amountCents > 0 ? `txn-${Date.now()}-${sessionId}` : "membership-credit"} END
      FROM locked, target_session, active_count
      WHERE NOT EXISTS (SELECT 1 FROM existing_booking)
      RETURNING id, session_id, customer_id, status, paid_cents, payment_id, created_at
    )
    SELECT inserted.*, ${customer.name} AS customer_name
    FROM inserted
  `;
  if (!result.rows[0]) return null;
  return bookingFromRow(result.rows[0]);
}

export async function cancelBookingRecord({ bookingId, session, role }) {
  const targetResult =
    role === "admin" || role === "staff"
      ? await sql`
          SELECT b.id, b.session_id, b.customer_id, c.name AS customer_name, b.status, b.paid_cents, b.payment_id, b.created_at
          FROM clave_bookings b
          JOIN clave_customers c ON c.id = b.customer_id
          WHERE b.id = ${bookingId}
          LIMIT 1
        `
      : await sql`
          SELECT b.id, b.session_id, b.customer_id, c.name AS customer_name, b.status, b.paid_cents, b.payment_id, b.created_at
          FROM clave_bookings b
          JOIN clave_customers c ON c.id = b.customer_id
          WHERE b.id = ${bookingId} AND b.customer_id = ${session.customerId}
          LIMIT 1
        `;

  const target = targetResult.rows[0];
  if (!target) return null;

  const cancelledResult = await sql`
    WITH locked AS (
      SELECT pg_advisory_xact_lock(hashtext(${target.session_id})) AS lock
    ),
    cancelled AS (
      UPDATE clave_bookings
      SET status = 'cancelled'
      FROM locked
      WHERE id = ${bookingId}
      RETURNING id, session_id, customer_id, status, paid_cents, payment_id, created_at
    ),
    promoted AS (
      UPDATE clave_bookings
      SET status = 'confirmed', payment_id = COALESCE(payment_id, ${`txn-${Date.now()}-waitlist`})
      WHERE id = (
        SELECT id
        FROM clave_bookings
        WHERE session_id = ${target.session_id} AND status = 'waitlist'
        ORDER BY created_at ASC
        LIMIT 1
      )
      RETURNING id
    )
    SELECT cancelled.*, ${target.customer_name} AS customer_name
    FROM cancelled
  `;
  return bookingFromRow(cancelledResult.rows[0]);
}

export async function checkInBookingRecord({ bookingId }) {
  const result = await sql`
    UPDATE clave_bookings b
    SET status = 'checked-in'
    FROM clave_customers c
    WHERE b.id = ${bookingId}
      AND b.customer_id = c.id
      AND b.status = 'confirmed'
    RETURNING b.id, b.session_id, b.customer_id, c.name AS customer_name, b.status, b.paid_cents, b.payment_id, b.created_at
  `;
  return result.rows[0] ? bookingFromRow(result.rows[0]) : null;
}

export function sendJson(response, statusCode, body) {
  response.status(statusCode).json(body);
}

export function sendError(response, error) {
  console.error(error);
  if (error?.code === "database_not_configured") {
    response.status(503).json({
      error: "database_not_configured",
      message: "Neon database is not configured. Set POSTGRES_URL in Vercel."
    });
    return;
  }

  if (error?.code === "session_has_bookings") {
    response.status(409).json({
      error: "session_has_bookings",
      message: error.message
    });
    return;
  }

  if (error?.code === "23505") {
    response.status(409).json({
      error: "database_unique_conflict",
      message: "That account is already linked to an existing Clave profile."
    });
    return;
  }

  if (error?.code === "23502") {
    response.status(400).json({
      error: "database_required_field",
      message: "A required account field was missing."
    });
    return;
  }

  if (error?.code === "23503") {
    response.status(409).json({
      error: "database_relation_conflict",
      message: "That request references a record that no longer exists."
    });
    return;
  }

  response.status(500).json({
    error: "database_error",
    message: "The database could not complete the request."
  });
}
