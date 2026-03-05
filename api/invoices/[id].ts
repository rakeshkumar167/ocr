export const config = { runtime: "edge" };

import { getDb, ensureSchema } from "../_db";
import { validateToken, unauthorized } from "../_auth";

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
  if (!(await validateToken(request))) return unauthorized();

  const url = new URL(request.url);
  const id = url.pathname.split("/").pop();
  if (!id) return json({ error: "Missing id" }, 400);

  const db = getDb();
  await ensureSchema(db);

  const invoiceRow = await db.execute({ sql: "SELECT * FROM invoices WHERE id = ?", args: [id] });
  if (invoiceRow.rows.length === 0) return json({ error: "Not found" }, 404);

  const inv = invoiceRow.rows[0];
  const corrRows = await db.execute({
    sql: "SELECT word_index, original_text, corrected_text FROM corrections WHERE invoice_id = ? ORDER BY word_index",
    args: [id],
  });

  return json({
    id: inv.id,
    image_base64: inv.image_base64,
    image_mime: inv.image_mime,
    ocr_words: JSON.parse(inv.ocr_words as string),
    summary: inv.summary,
    invoice_date: inv.invoice_date ?? null,
    invoice_description: inv.invoice_description ?? null,
    invoice_amount: inv.invoice_amount != null ? Number(inv.invoice_amount) : null,
    invoice_category: inv.invoice_category ?? null,
    corrections: corrRows.rows.map((r) => ({
      wordIndex: r.word_index,
      originalText: r.original_text,
      correctedText: r.corrected_text,
    })),
    created_at: inv.created_at,
  }, 200);
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
