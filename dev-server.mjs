// Local dev proxy server — keeps API keys server-side.
// Run via: npm run dev  (started automatically alongside Vite)
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "@libsql/client";

// ── Env ────────────────────────────────────────────────────────
function loadEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch {
    // .env.local is optional
  }
}

loadEnv();

// ── Database ───────────────────────────────────────────────────
const db = createClient({
  url: process.env.TURSO_DATABASE_URL || "file:local.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function ensureSchema() {
  await db.batch([
    `CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      image_base64 TEXT NOT NULL,
      image_mime TEXT NOT NULL,
      ocr_words TEXT NOT NULL,
      summary TEXT,
      invoice_date TEXT,
      created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS corrections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id TEXT NOT NULL REFERENCES invoices(id),
      word_index INTEGER NOT NULL,
      original_text TEXT NOT NULL,
      corrected_text TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE(invoice_id, word_index)
    )`,
  ]);
}

// ── Auth helper ────────────────────────────────────────────────
async function validateToken(req) {
  const auth = req.headers["authorization"];
  if (!auth?.startsWith("Bearer ")) return false;
  const token = auth.slice(7);
  const row = await db.execute({ sql: "SELECT 1 FROM sessions WHERE token = ?", args: [token] });
  return row.rows.length > 0;
}

// ── Groq system prompt ────────────────────────────────────────
const GROQ_SYSTEM_PROMPT = `You are an invoice data extraction specialist. You receive raw OCR text scanned from invoices, which often contains noise: stray pipe characters (|), misread column headers (e.g. "ary" instead of "Qty"), garbled words, merged address lines, and other OCR artifacts. Your job is to ignore the noise and extract the real invoice data accurately.

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
  (any other relevant info, or "None")`;

// ── Helpers ────────────────────────────────────────────────────
function readBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => resolve(body));
  });
}

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json", ...corsHeaders() });
  res.end(JSON.stringify(body));
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "http://localhost:5173",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

async function callGroq(text) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set in .env.local");

  const grokRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: GROQ_SYSTEM_PROMPT },
        { role: "user", content: `Extract the invoice data from this OCR text:\n\n${text}` },
      ],
      max_tokens: 1000,
    }),
  });

  const data = await grokRes.json();
  if (!grokRes.ok) {
    const msg = data.error?.message ?? data.error ?? JSON.stringify(data);
    throw new Error(msg);
  }
  return data.choices?.[0]?.message?.content ?? "No summary generated";
}

// ── Extract invoice date from Grok summary ─────────────────────
function extractInvoiceDate(summary) {
  const match = summary.match(/Invoice Date:\s*(.+)/i);
  if (!match) return null;
  const dateStr = match[1].trim();
  if (!dateStr || dateStr === "N/A") return null;
  return dateStr;
}

// ── Route matching ─────────────────────────────────────────────
// /api/invoices/:id/corrections  → { id }
// /api/invoices/:id/summarize    → { id }
// /api/invoices/:id              → { id }
function matchRoute(url, method) {
  if (url === "/api/login" && method === "POST") return { route: "login" };
  if (url === "/api/summarize" && method === "POST") return { route: "summarize" };
  if (url === "/api/invoices" && (method === "GET" || method === "POST")) return { route: "invoices" };

  const corrMatch = url.match(/^\/api\/invoices\/([^/]+)\/corrections$/);
  if (corrMatch && method === "POST") return { route: "corrections", id: corrMatch[1] };

  const sumMatch = url.match(/^\/api\/invoices\/([^/]+)\/summarize$/);
  if (sumMatch && method === "POST") return { route: "invoice-summarize", id: sumMatch[1] };

  const saveSumMatch = url.match(/^\/api\/invoices\/([^/]+)\/summary$/);
  if (saveSumMatch && method === "PUT") return { route: "save-summary", id: saveSumMatch[1] };

  const idMatch = url.match(/^\/api\/invoices\/([^/]+)$/);
  if (idMatch && method === "GET") return { route: "invoice-detail", id: idMatch[1] };

  return null;
}

// ── Server ─────────────────────────────────────────────────────
const PORT = 3001;

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }

  const matched = matchRoute(req.url, req.method);
  if (!matched) return send(res, 404, { error: "Not found" });

  try {
    // ── Login ──────────────────────────────────────────────
    if (matched.route === "login") {
      const { username, password } = JSON.parse(await readBody(req));
      if (username !== "empire" || password !== "mayans") {
        return send(res, 401, { error: "Invalid credentials" });
      }
      const token = randomUUID();
      await db.execute({
        sql: "INSERT INTO sessions (token, created_at) VALUES (?, ?)",
        args: [token, Date.now()],
      });
      return send(res, 200, { token });
    }

    // ── Legacy summarize (no auth) ─────────────────────────
    if (matched.route === "summarize") {
      const { text } = JSON.parse(await readBody(req));
      if (!text || typeof text !== "string") return send(res, 400, { error: "Missing text field" });
      const summary = await callGroq(text);
      return send(res, 200, { summary });
    }

    // All remaining routes require auth
    if (!(await validateToken(req))) return send(res, 401, { error: "Unauthorized" });

    // ── List / Create invoices ──────────────────────────────
    if (matched.route === "invoices") {
      if (req.method === "GET") {
        const rows = await db.execute("SELECT id, created_at, summary, invoice_date FROM invoices ORDER BY created_at DESC");
        const invoices = rows.rows.map((r) => ({
          id: r.id,
          created_at: r.created_at,
          invoice_date: r.invoice_date ?? null,
          summaryPreview: r.summary ? String(r.summary).slice(0, 100) : null,
        }));
        return send(res, 200, { invoices });
      }
      // POST
      const body = JSON.parse(await readBody(req));
      const id = randomUUID();
      await db.execute({
        sql: "INSERT INTO invoices (id, image_base64, image_mime, ocr_words, created_at) VALUES (?, ?, ?, ?, ?)",
        args: [id, body.image_base64, body.image_mime, JSON.stringify(body.ocr_words), Date.now()],
      });
      return send(res, 201, { id });
    }

    // ── Invoice detail ──────────────────────────────────────
    if (matched.route === "invoice-detail") {
      const invoiceRow = await db.execute({ sql: "SELECT * FROM invoices WHERE id = ?", args: [matched.id] });
      if (invoiceRow.rows.length === 0) return send(res, 404, { error: "Not found" });
      const inv = invoiceRow.rows[0];
      const corrRows = await db.execute({
        sql: "SELECT word_index, original_text, corrected_text FROM corrections WHERE invoice_id = ? ORDER BY word_index",
        args: [matched.id],
      });
      return send(res, 200, {
        id: inv.id,
        image_base64: inv.image_base64,
        image_mime: inv.image_mime,
        ocr_words: JSON.parse(inv.ocr_words),
        summary: inv.summary,
        invoice_date: inv.invoice_date ?? null,
        corrections: corrRows.rows.map((r) => ({
          wordIndex: r.word_index,
          originalText: r.original_text,
          correctedText: r.corrected_text,
        })),
        created_at: inv.created_at,
      });
    }

    // ── Save corrections ────────────────────────────────────
    if (matched.route === "corrections") {
      const { corrections } = JSON.parse(await readBody(req));
      const stmts = corrections.map((c) => ({
        sql: `INSERT INTO corrections (invoice_id, word_index, original_text, corrected_text, created_at)
              VALUES (?, ?, ?, ?, ?)
              ON CONFLICT(invoice_id, word_index)
              DO UPDATE SET corrected_text = excluded.corrected_text, created_at = excluded.created_at`,
        args: [matched.id, c.wordIndex, c.originalText, c.correctedText, Date.now()],
      }));
      await db.batch(stmts);
      return send(res, 200, { ok: true });
    }

    // ── Summarize invoice ───────────────────────────────────
    if (matched.route === "invoice-summarize") {
      const { text } = JSON.parse(await readBody(req));
      if (!text || typeof text !== "string") return send(res, 400, { error: "Missing text field" });
      const summary = await callGroq(text);
      const invoiceDate = extractInvoiceDate(summary);
      await db.execute({
        sql: "UPDATE invoices SET summary = ?, invoice_date = ? WHERE id = ?",
        args: [summary, invoiceDate, matched.id],
      });
      return send(res, 200, { summary });
    }

    // ── Save summary (without re-running Groq) ─────────────
    if (matched.route === "save-summary") {
      const { summary } = JSON.parse(await readBody(req));
      if (!summary || typeof summary !== "string") return send(res, 400, { error: "Missing summary field" });
      const invoiceDate = extractInvoiceDate(summary);
      await db.execute({
        sql: "UPDATE invoices SET summary = ?, invoice_date = ? WHERE id = ?",
        args: [summary, invoiceDate, matched.id],
      });
      return send(res, 200, { ok: true });
    }
  } catch (err) {
    console.error(err);
    send(res, 500, { error: err.message ?? "Internal error" });
  }
});

// Init schema then start listening
ensureSchema().then(() => {
  server.listen(PORT, () => {
    console.log(`  [dev-server] API proxy running on http://localhost:${PORT}`);
  });
});
