export const config = { runtime: "edge" };

import { getDb, ensureSchema } from "./_db";
import { validateToken, unauthorized } from "./_auth";

export default async function handler(request: Request): Promise<Response> {
  if (!(await validateToken(request))) return unauthorized();

  const db = getDb();
  await ensureSchema(db);

  if (request.method === "GET") {
    const rows = await db.execute(
      "SELECT id, created_at, summary, invoice_date, invoice_description, invoice_amount, invoice_category FROM invoices ORDER BY created_at DESC"
    );
    const invoices = rows.rows.map((r) => ({
      id: r.id,
      created_at: r.created_at,
      invoice_date: r.invoice_date ?? null,
      invoice_description: r.invoice_description ?? null,
      invoice_amount: r.invoice_amount != null ? Number(r.invoice_amount) : null,
      invoice_category: r.invoice_category ?? null,
      summaryPreview: r.summary ? String(r.summary).slice(0, 100) : null,
    }));
    return json({ invoices }, 200);
  }

  if (request.method === "POST") {
    let body: { image_base64: string; image_mime: string; ocr_words: unknown };
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }

    const id = crypto.randomUUID();
    await db.execute({
      sql: "INSERT INTO invoices (id, image_base64, image_mime, ocr_words, created_at) VALUES (?, ?, ?, ?, ?)",
      args: [id, body.image_base64, body.image_mime, JSON.stringify(body.ocr_words), Date.now()],
    });
    return json({ id }, 201);
  }

  return json({ error: "Method not allowed" }, 405);
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
