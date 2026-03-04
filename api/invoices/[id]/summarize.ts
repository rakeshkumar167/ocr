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

  let body: { text: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  if (!body.text || typeof body.text !== "string") {
    return json({ error: "Missing text field" }, 400);
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return json({ error: "GROQ_API_KEY is not configured" }, 500);

  const grokRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `You are an invoice data extraction specialist. You receive raw OCR text scanned from invoices, which often contains noise: stray pipe characters (|), misread column headers (e.g. "ary" instead of "Qty"), garbled words, merged address lines, and other OCR artifacts. Your job is to ignore the noise and extract the real invoice data accurately.

Always output in this exact format — use "N/A" for any field not found:

VENDOR
  Name:
  Address:

BILL TO
  Name:
  Address:

SHIP TO
  Name:
  Address:

INVOICE DETAILS
  Invoice #:
  PO #:
  Invoice Date:
  Due Date:

LINE ITEMS
  #  | Description               | Qty | Unit Price | Amount
  ---|---------------------------|-----|------------|-------
  (one row per line item, clean up any | artifacts in descriptions)

TOTALS
  Subtotal:
  Tax (label + rate if shown):
  Total:

PAYMENT INFO
  Terms:
  Bank:
  Account Number:
  Routing Number:

NOTES
  (any other relevant info, or "None")`,
        },
        {
          role: "user",
          content: `Extract the invoice data from this OCR text:\n\n${body.text}`,
        },
      ],
      max_tokens: 1000,
    }),
  });

  if (!grokRes.ok) {
    const errorText = await grokRes.text();
    return json({ error: `Grok API error: ${errorText}` }, grokRes.status);
  }

  const data = await grokRes.json();
  const summary: string = data.choices?.[0]?.message?.content ?? "No summary generated";

  // Extract invoice date from summary
  const dateMatch = summary.match(/Invoice Date:\s*(.+)/i);
  const invoiceDate = dateMatch && dateMatch[1].trim() !== "N/A" ? dateMatch[1].trim() : null;

  // Save summary + invoice date to DB
  const db = getDb();
  await ensureSchema(db);
  await db.execute({
    sql: "UPDATE invoices SET summary = ?, invoice_date = ? WHERE id = ?",
    args: [summary, invoiceDate, invoiceId],
  });

  return json({ summary }, 200);
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
