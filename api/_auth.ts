import { getDb } from "./_db";

export async function validateToken(request: Request): Promise<boolean> {
  const auth = request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return false;
  const token = auth.slice(7);
  const db = getDb();
  const row = await db.execute({ sql: "SELECT 1 FROM sessions WHERE token = ?", args: [token] });
  return row.rows.length > 0;
}

export function unauthorized(): Response {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
