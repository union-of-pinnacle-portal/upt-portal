"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import Session from "supertokens-web-js/recipe/session";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Initials for the avatar, from the local part of the email. */
function initials(email: string): string {
  const name = email.split("@")[0] ?? "";
  const parts = name.split(/[.\-_]+/).filter(Boolean);
  const letters = parts.length >= 2 ? parts[0][0] + parts[1][0] : name.slice(0, 2);
  return letters.toUpperCase() || "?";
}

/**
 * Account menu in the header: who you are, what you can do, and sign out.
 *
 * This replaces a "Signed in as … · Super User" line that sat under the
 * dashboard's page title. Two things were wrong with that: identity is not
 * page content, and it appeared on the dashboard alone — so anywhere else in
 * the portal you could not tell which account or role you were acting under,
 * which matters in an app where the role decides what you can see.
 *
 * The role sits inside the menu rather than always-on in the bar because it is
 * reference information, not a control; showing it permanently spends prime
 * header space on something you check rarely.
 */
export function UserMenu({
  email,
  role,
  canManageMembers,
}: {
  email: string;
  role: string;
  /** Chairs and Super Users — matches the /admin/users rank gate. */
  canManageMembers: boolean;
}) {
  const router = useRouter();

  async function signOut() {
    await Session.signOut();
    router.push("/auth/login");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account"
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground outline-none hover:bg-muted/70 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {initials(email)}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium">{email || "Your account"}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{role}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {/* Member management is account administration, not a page action —
            it belongs with identity rather than beside "Upload document". */}
        {canManageMembers ? (
          <>
            <DropdownMenuItem asChild>
              <Link href="/admin/users">Manage members</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuItem onSelect={signOut}>Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
