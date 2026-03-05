export const config = { runtime: "edge" };

import { GROQ_SYSTEM_PROMPT } from "./_prompt";

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

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return json({ error: "GROQ_API_KEY is not configured" }, 500);
  }

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
          content: GROQ_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: `Extract the invoice data from this OCR text:\n\n${text}`,
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
