import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * A back control for pages that sit beside the document tree rather than
 * inside it.
 *
 * Those pages get this instead of a breadcrumb: a breadcrumb describes a
 * hierarchy, and a single-item one is just the page title repeated above the
 * heading. "Back" states plainly where the link goes without implying the
 * destination is a parent.
 *
 * A real button rather than a bare text link so it reads as an affordance and
 * gets a proper hit area — the old inline "← Back to dashboard" was easy to
 * miss and fiddly to hit.
 */
export function BackButton({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
      <Link href={href}>
        <ArrowLeft className="mr-1.5 size-4" aria-hidden="true" />
        {label}
      </Link>
    </Button>
  );
}
