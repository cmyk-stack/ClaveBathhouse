import { sql } from "@vercel/postgres";
import { hashPassword } from "./_security.js";

const seedCustomer = {
  id: "c1",
  name: "Shane Goodhew",
  email: "shane@example.com",
  phone: "+61 400 100 200",
  membershipId: "flow",
  credits: 2,
  paymentMethod: "Visa token ending 4242"
};

export async function ensureSchema() {
  const seedPasswordHash = await hashPassword("clave-demo-password");

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
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`ALTER TABLE clave_customers ADD COLUMN IF NOT EXISTS password_hash TEXT`;
  await sql`ALTER TABLE clave_customers ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'customer'`;
  await sql`ALTER TABLE clave_customers ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT`;
  await sql`ALTER TABLE clave_customers ADD COLUMN IF NOT EXISTS password_reset_token TEXT`;
  await sql`ALTER TABLE clave_customers ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMPTZ`;

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

  await sql`
    CREATE TABLE IF NOT EXISTS clave_bookings (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES clave_sessions(id),
      customer_id TEXT NOT NULL REFERENCES clave_customers(id),
      status TEXT NOT NULL CHECK (status IN ('confirmed', 'waitlist', 'cancelled', 'checked-in')),
      paid_cents INTEGER NOT NULL DEFAULT 0,
      stripe_checkout_session_id TEXT,
      stripe_payment_intent_id TEXT,
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
    CREATE TABLE IF NOT EXISTS clave_app_state (
      customer_id TEXT PRIMARY KEY REFERENCES clave_customers(id) ON DELETE CASCADE,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    INSERT INTO clave_customers (id, name, email, phone, membership_id, credits, payment_method, password_hash, role)
    VALUES (
      ${seedCustomer.id},
      ${seedCustomer.name},
      ${seedCustomer.email},
      ${seedCustomer.phone},
      ${seedCustomer.membershipId},
      ${seedCustomer.credits},
      ${seedCustomer.paymentMethod},
      ${seedPasswordHash},
      ${"admin"}
    )
    ON CONFLICT (email) DO NOTHING
  `;

  await sql`
    UPDATE clave_customers
    SET password_hash = ${seedPasswordHash}, role = 'admin'
    WHERE email = ${seedCustomer.email} AND password_hash IS NULL
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
      role = COALESCE(EXCLUDED.role, clave_customers.role)
  `;

  return findCustomerByEmail(customer.email);
}

export async function savePasswordResetToken(email, token, expiresAt) {
  await sql`
    UPDATE clave_customers
    SET password_reset_token = ${token}, password_reset_expires_at = ${expiresAt}
    WHERE lower(email) = lower(${email})
  `;
}

export async function getStoredState(customerId) {
  const result = await sql`
    SELECT payload
    FROM clave_app_state
    WHERE customer_id = ${customerId}
    LIMIT 1
  `;

  return result.rows[0]?.payload ?? null;
}

export async function saveStoredState(customerId, payload) {
  await sql`
    INSERT INTO clave_app_state (customer_id, payload, updated_at)
    VALUES (${customerId}, ${JSON.stringify(payload)}::jsonb, NOW())
    ON CONFLICT (customer_id)
    DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()
  `;
}

export function sendJson(response, statusCode, body) {
  response.status(statusCode).json(body);
}

export function sendError(response, error) {
  console.error(error);
  response.status(500).json({
    error: "database_error",
    message: "The database could not complete the request."
  });
}
