import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

/**
 * Sticky top bar for authenticated pages: the logo (links home) on the left,
 * page actions (upload, sign out, …) passed as children on the right.
 */
export function AppHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-4xl items-center justify-between gap-4 px-6">
        <Link
          href="/dashboard"
          aria-label="Union of Pinnacle Tenants — portal home"
          className="flex items-center"
        >
          <BrandLogo className="h-9" />
        </Link>
        {children ? (
          <div className="flex items-center gap-2">{children}</div>
        ) : null}
      </div>
    </header>
  );
}
