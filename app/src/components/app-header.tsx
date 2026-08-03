import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { SignOutButton } from "@/components/sign-out-button";

/**
 * Sticky top bar for authenticated pages: the logo (links home) on the left,
 * page actions passed as children on the right.
 *
 * Sign out is rendered here rather than passed in by each page, and sits after
 * a divider. It is account management, not a page action — grouping it with
 * "Upload document" made a row of same-weight buttons where the destructive-ish
 * one was easiest to hit by accident. Pages no longer pass it at all.
 */
export function AppHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-6">
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
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
