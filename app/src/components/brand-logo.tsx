import { cn } from "@/lib/utils";

/**
 * The Union of Pinnacle Tenants logo lockup (building + wordmark).
 * Set the height via `className` (e.g. "h-9"); width scales automatically.
 */
export function BrandLogo({ className }: { className?: string }) {
  return (
    // Decorative brand mark served from /public; next/image optimization adds
    // no value here and would require fixed dimensions.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/upt-logo.png"
      alt="Union of Pinnacle Tenants"
      className={cn("w-auto select-none", className)}
    />
  );
}
