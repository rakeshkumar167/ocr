export const config = { runtime: "edge" };

import { getDb, ensureSchema } from "../_db";
import { validateToken, unauthorized } from "../_auth";

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
  if (!(await validateToken(request))) return unauthorized();

  const db = getDb();
  await ensureSchema(db);

  const monthlyRows = await db.execute(
    `SELECT substr(invoice_date, 1, 7) as month, SUM(invoice_amount) as total, COUNT(*) as count
     FROM invoices
     WHERE invoice_date IS NOT NULL AND invoice_amount IS NOT NULL
     GROUP BY substr(invoice_date, 1, 7)
     ORDER BY month`
  );

  const categoryRows = await db.execute(
    `SELECT substr(invoice_date, 1, 7) as month, invoice_category as category, SUM(invoice_amount) as total, COUNT(*) as count
     FROM invoices
     WHERE invoice_date IS NOT NULL AND invoice_amount IS NOT NULL AND invoice_category IS NOT NULL
     GROUP BY substr(invoice_date, 1, 7), invoice_category
     ORDER BY month, category`
  );

  return json({
    monthly: monthlyRows.rows.map((r) => ({
      month: r.month as string,
      total: Number(r.total),
      count: Number(r.count),
    })),
    byCategory: categoryRows.rows.map((r) => ({
      month: r.month as string,
      category: r.category as string,
      total: Number(r.total),
      count: Number(r.count),
    })),
  }, 200);
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
