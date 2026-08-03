"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface RoomMemberRow {
  email: string;
  assignedBy: string;
  assignedAt: string;
}

/**
 * Roster management for a Committee Room — add or remove members.
 *
 * Membership is what grants write access inside this room. It does NOT change
 * anyone's global role or what they can read; the server enforces that
 * separation (see api/rooms/[id]/members), this UI just reflects it.
 */
export function RoomMemberManager({
  roomId,
  members,
}: {
  roomId: string;
  members: RoomMemberRow[];
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function send(method: "POST" | "DELETE", email: string) {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}/members`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        throw new Error((await res.json()).error ?? "That did not work.");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const email = String(new FormData(form).get("email") ?? "").trim();
    if (!email) return;
    await send("POST", email);
    form.reset();
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={onAdd} className="flex items-end gap-2">
        <div className="grid flex-1 gap-2">
          <Label htmlFor="email">Add a member by email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            placeholder="member@example.com"
          />
        </div>
        <Button type="submit" disabled={submitting}>
          Add
        </Button>
      </form>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {members.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No members yet. Only Super Users can write in this room until someone
          is added.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {members.map((member) => (
            <li
              key={member.email}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <span className="text-sm">{member.email}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={submitting}
                onClick={() => send("DELETE", member.email)}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
