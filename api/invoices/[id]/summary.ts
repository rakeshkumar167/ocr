export const config = { runtime: "edge" };

import { getDb, ensureSchema } from "../../_db";
import { validateToken, unauthorized } from "../../_auth";
import { extractFieldsFromSummary } from "../../_prompt";

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "PUT") return json({ error: "Method not allowed" }, 405);
  if (!(await validateToken(request))) return unauthorized();

  const url = new URL(request.url);
  const parts = url.pathname.split("/");
  const idIndex = parts.indexOf("invoices") + 1;
  const invoiceId = parts[idIndex];
  if (!invoiceId) return json({ error: "Missing invoice id" }, 400);

  let body: { summary: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  if (!body.summary || typeof body.summary !== "string") {
    return json({ error: "Missing summary field" }, 400);
  }

  const fields = extractFieldsFromSummary(body.summary);

  const db = getDb();
  await ensureSchema(db);
  await db.execute({
    sql: "UPDATE invoices SET summary = ?, invoice_date = ?, invoice_description = ?, invoice_amount = ?, invoice_category = ? WHERE id = ?",
    args: [body.summary, fields.invoiceDate, fields.invoiceDescription, fields.invoiceAmount, fields.invoiceCategory, invoiceId],
  });

  return json({ ok: true }, 200);
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
