export const config = { runtime: "edge" };

import { getDb, ensureSchema } from "../../_db";
import { validateToken, unauthorized } from "../../_auth";

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!(await validateToken(request))) return unauthorized();

  const url = new URL(request.url);
  const parts = url.pathname.split("/");
  const idIndex = parts.indexOf("invoices") + 1;
  const invoiceId = parts[idIndex];
  if (!invoiceId) return json({ error: "Missing invoice id" }, 400);

  let body: { corrections: Array<{ wordIndex: number; originalText: string; correctedText: string }> };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const db = getDb();
  await ensureSchema(db);

  const stmts = body.corrections.map((c) => ({
    sql: `INSERT INTO corrections (invoice_id, word_index, original_text, corrected_text, created_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(invoice_id, word_index)
          DO UPDATE SET corrected_text = excluded.corrected_text, created_at = excluded.created_at`,
    args: [invoiceId, c.wordIndex, c.originalText, c.correctedText, Date.now()] as Array<string | number>,
  }));

  await db.batch(stmts);
  return json({ ok: true }, 200);
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
