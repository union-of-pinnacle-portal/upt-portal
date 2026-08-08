"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROLES, ROLE_LABEL, rankForRole, type Role } from "@/lib/roles";
import type { UserRow } from "@/app/api/admin/users/route";

export function UserManagementTable({
  users,
  currentUserEmail,
  currentUserRank,
}: {
  users: UserRow[];
  currentUserEmail: string;
  currentUserRank: number;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const filtered = users.filter((u) =>
    u.email.toLowerCase().includes(search.toLowerCase()),
  );

  // Roles this user can assign — up to their own rank
  const assignableRoles = ROLES.filter(
    (r) => rankForRole(r) <= currentUserRank,
  );

  function canChangeRole(target: UserRow): boolean {
    const isSelf = target.email === currentUserEmail;
    if (target.rank === 4 && !isSelf) return false;
    if (target.rank >= currentUserRank && !isSelf) return false;
    return true;
  }

  async function handleRoleChange(userId: string, newRole: Role, email: string) {
    setError(null);
    setSuccess(null);

    const res = await fetch(`/api/admin/users/${userId}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Failed to update role.");
      return;
    }

    setSuccess(`Updated ${email} to ${ROLE_LABEL[newRole as Role]}.`);
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex flex-col gap-4">
      <Input
        placeholder="Search by email…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-green-600">{success}</p>}

      <div className="overflow-x-auto rounded-lg border border-border bg-background">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Current role</th>
              <th className="px-4 py-3">Change role</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                  No users found.
                </td>
              </tr>
            ) : (
              filtered.map((u) => {
                const isSelf = u.email === currentUserEmail;
                const canChange = canChangeRole(u);
                return (
                  <tr
                    key={u.id}
                    className="border-b border-border/60 last:border-0 hover:bg-muted/40"
                  >
                    <td className="px-4 py-3 font-medium">
                      {u.email}
                      {isSelf && (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">(you)</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium capitalize">
                        {ROLE_LABEL[u.role as Role] ?? u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {canChange ? (
                        <Select
                          defaultValue={u.role}
                          onValueChange={(v) =>
                            handleRoleChange(u.id, v as Role, u.email)
                          }
                          disabled={isPending}
                        >
                          <SelectTrigger className="w-44">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {assignableRoles.map((r) => (
                              <SelectItem key={r} value={r}>
                                {ROLE_LABEL[r]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {u.rank === 4 && !isSelf
                            ? "Super User — cannot change"
                            : "—"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
