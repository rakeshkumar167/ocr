export const config = { runtime: "edge" };

import { getDb, ensureSchema } from "./_db";

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  let username: string, password: string;
  try {
    const body = await request.json();
    username = body.username;
    password = body.password;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (username !== "empire" || password !== "mayans") {
    return json({ error: "Invalid credentials" }, 401);
  }

  const db = getDb();
  await ensureSchema(db);

  const token = crypto.randomUUID();
  await db.execute({
    sql: "INSERT INTO sessions (token, created_at) VALUES (?, ?)",
    args: [token, Date.now()],
  });

  return json({ token }, 200);
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
