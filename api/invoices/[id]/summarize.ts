export const config = { runtime: "edge" };

import { getDb, ensureSchema } from "../../_db";
import { validateToken, unauthorized } from "../../_auth";
import { GROQ_SYSTEM_PROMPT, extractFieldsFromSummary } from "../../_prompt";

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
        { role: "system", content: GROQ_SYSTEM_PROMPT },
        { role: "user", content: `Extract the invoice data from this OCR text:\n\n${body.text}` },
      ],
      max_tokens: 1200,
    }),
  });

  if (!grokRes.ok) {
    const errorText = await grokRes.text();
    return json({ error: `Grok API error: ${errorText}` }, grokRes.status);
  }

  const data = await grokRes.json();
  const summary: string = data.choices?.[0]?.message?.content ?? "No summary generated";

  const fields = extractFieldsFromSummary(summary);

  const db = getDb();
  await ensureSchema(db);
  await db.execute({
    sql: "UPDATE invoices SET summary = ?, invoice_date = ?, invoice_description = ?, invoice_amount = ?, invoice_category = ? WHERE id = ?",
    args: [summary, fields.invoiceDate, fields.invoiceDescription, fields.invoiceAmount, fields.invoiceCategory, invoiceId],
  });

  return json({ summary }, 200);
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
