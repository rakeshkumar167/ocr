export const config = { runtime: "edge" };

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  let text: string;
  try {
    const body = await request.json();
    text = body.text;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (!text || typeof text !== "string") {
    return json({ error: "Missing text field" }, 400);
  }

  const apiKey = process.env.GROK_API_KEY;
  if (!apiKey) {
    return json({ error: "GROK_API_KEY is not configured" }, 500);
  }

  const grokRes = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "grok-2-latest",
      messages: [
        {
          role: "system",
          content:
            "You are an expert invoice analyst. When given raw OCR text from an invoice or billing document, extract and present the key information in a clear, structured format. Include: vendor/company name, invoice number, invoice date, due date, line items with descriptions and amounts, subtotal, taxes, and total amount due. If any field is not found, note it as not found. Be concise and accurate.",
        },
        {
          role: "user",
          content: `Please analyze this invoice OCR text and provide a structured summary:\n\n${text}`,
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
  const summary: string =
    data.choices?.[0]?.message?.content ?? "No summary generated";

  return json({ summary }, 200);
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
