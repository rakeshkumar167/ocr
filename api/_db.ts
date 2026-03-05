import { createClient, type Client } from "@libsql/client";

let _client: Client | null = null;

export function getDb(): Client {
  if (!_client) {
    _client = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return _client;
}

export async function ensureSchema(db: Client): Promise<void> {
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
      invoice_description TEXT,
      invoice_amount REAL,
      invoice_category TEXT,
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

  // Migrate existing tables: add columns if they don't exist
  const migrations = [
    "ALTER TABLE invoices ADD COLUMN invoice_description TEXT",
    "ALTER TABLE invoices ADD COLUMN invoice_amount REAL",
    "ALTER TABLE invoices ADD COLUMN invoice_category TEXT",
  ];
  for (const sql of migrations) {
    try { await db.execute(sql); } catch { /* column already exists */ }
  }
}
