import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { UserMenu } from "@/components/user-menu";
import { getCurrentUser } from "@/lib/session";
import { ROLE_LABEL, rankForRole } from "@/lib/roles";

/**
 * Sticky top bar for authenticated pages: the logo (links home) on the left,
 * page actions passed as children on the right.
 *
 * The account menu is rendered here rather than passed in by each page, and
 * sits after a divider. It is account management, not a page action — grouping
 * it with "Upload document" made a row of same-weight buttons where the
 * destructive-ish one was easiest to hit by accident.
 *
 * It reads the session itself instead of taking props, so every page shows who
 * you are signed in as and at what role. Previously only the dashboard did, and
 * in an app where role decides what you can see, "which account am I?" should
 * be answerable from anywhere.
 */
export async function AppHeader({ children }: { children?: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <header className="print-hide sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-[100rem] items-center justify-between gap-4 px-6 lg:px-10">
        <Link
          href="/dashboard"
          aria-label="Union of Pinnacle Tenants — portal home"
          className="flex items-center"
        >
          <BrandLogo className="h-9" />
        </Link>

        <div className="flex items-center gap-2">
          {children ? (
            <>
              <div className="flex items-center gap-2">{children}</div>
              <span
                aria-hidden="true"
                className="mx-1 h-6 w-px shrink-0 bg-border"
              />
            </>
          ) : null}
          {user ? (
            <UserMenu
              email={user.email}
              role={ROLE_LABEL[user.role]}
              canManageMembers={rankForRole(user.role) >= 3}
            />
          ) : null}
        </div>
      </div>
    </header>
  );
}
