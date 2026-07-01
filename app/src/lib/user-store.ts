/**
 * Temporary in-memory user store.
 *
 * Stand-in until the DynamoDB users table exists in infra/.
 * Data is lost on server restart — expected for now.
 *
 * When DynamoDB is ready: replace the function bodies below with
 * real DB calls. Signatures stay the same so nothing else changes.
 */

export type Role = "general" | "campaign_lead" | "committee_head";

export type User = {
  id: string;
  name: string;
  email: string;
  passwordHash: string | null; // null for Google-only users
  role: Role;
};

const users: User[] = [];

export function findUserByEmail(email: string): User | null {
  return users.find((u) => u.email === email) ?? null;
}

export function findUserById(id: string): User | null {
  return users.find((u) => u.id === id) ?? null;
}

export function createUser(data: {
  name: string;
  email: string;
  passwordHash: string | null;
}): User {
  const user: User = {
    id: crypto.randomUUID(),
    name: data.name,
    email: data.email,
    passwordHash: data.passwordHash,
    role: "general", // all new users default to general
  };
  users.push(user);
  return user;
}
