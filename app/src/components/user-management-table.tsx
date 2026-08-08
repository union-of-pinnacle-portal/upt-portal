"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { UserX } from "lucide-react";
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
      {success && <p className="text-sm text-foreground">{success}</p>}

      <div className="overflow-x-auto rounded-lg border border-border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Current role</TableHead>
              <TableHead>Change role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="p-0">
                  <EmptyState
                    icon={UserX}
                    title="No members found"
                    description="Try a different search term."
                  />
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((u) => {
                const isSelf = u.email === currentUserEmail;
                const canChange = canChangeRole(u);
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      {u.email}
                      {isSelf && (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">(you)</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium capitalize">
                        {ROLE_LABEL[u.role as Role] ?? u.role}
                      </span>
                    </TableCell>
                    <TableCell>
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
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
