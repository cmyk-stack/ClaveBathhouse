import { sql } from "@vercel/postgres";

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
  await sql`
    CREATE TABLE IF NOT EXISTS clave_customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT NOT NULL,
      membership_id TEXT NOT NULL,
      credits INTEGER NOT NULL DEFAULT 0,
      payment_method TEXT NOT NULL,
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
    INSERT INTO clave_customers (id, name, email, phone, membership_id, credits, payment_method)
    VALUES (
      ${seedCustomer.id},
      ${seedCustomer.name},
      ${seedCustomer.email},
      ${seedCustomer.phone},
      ${seedCustomer.membershipId},
      ${seedCustomer.credits},
      ${seedCustomer.paymentMethod}
    )
    ON CONFLICT (email) DO NOTHING
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
    paymentMethod: row.payment_method
  };
}

export async function findCustomerByEmail(email) {
  const result = await sql`
    SELECT id, name, email, phone, membership_id, credits, payment_method
    FROM clave_customers
    WHERE lower(email) = lower(${email})
    LIMIT 1
  `;

  return result.rows[0] ? customerFromRow(result.rows[0]) : null;
}

export async function upsertCustomer(customer) {
  await sql`
    INSERT INTO clave_customers (id, name, email, phone, membership_id, credits, payment_method)
    VALUES (
      ${customer.id},
      ${customer.name},
      ${customer.email},
      ${customer.phone},
      ${customer.membershipId},
      ${customer.credits},
      ${customer.paymentMethod}
    )
    ON CONFLICT (email)
    DO UPDATE SET
      name = EXCLUDED.name,
      phone = EXCLUDED.phone,
      membership_id = EXCLUDED.membership_id,
      credits = EXCLUDED.credits,
      payment_method = EXCLUDED.payment_method
  `;

  return findCustomerByEmail(customer.email);
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
