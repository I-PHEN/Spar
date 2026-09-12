// SharkPit — default user helper
//
// v1 has no auth. We use a single hardcoded "default user" for all sessions.
// When auth is added later, this becomes a real lookup.

import { db } from "./db";

const DEFAULT_USER_EMAIL = "founder@sharkpit.local";
const DEFAULT_USER_NAME = "Founder";

let cachedUserId: string | null = null;

export async function getDefaultUserId(): Promise<string> {
  if (cachedUserId) return cachedUserId;

  let user = await db.user.findUnique({
    where: { email: DEFAULT_USER_EMAIL },
  });

  if (!user) {
    user = await db.user.create({
      data: {
        email: DEFAULT_USER_EMAIL,
        name: DEFAULT_USER_NAME,
      },
    });
  }

  cachedUserId = user.id;
  return user.id;
}

export async function getDefaultUser() {
  const id = await getDefaultUserId();
  return db.user.findUnique({ where: { id } });
}
