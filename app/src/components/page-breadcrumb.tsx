import { Fragment } from "react";
import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

/**
 * The trail shown at the top of every page below the dashboard.
 *
 * Replaces what used to be three different back-navigation patterns — a header
 * button on some pages, an inline "← Back to documents" on others, and on the
 * room detail page nothing at all that reached Documents. A breadcrumb gives
 * every ancestor in one click rather than only the previous step, which is what
 * "back" cannot do once pages nest two deep.
 *
 * Documents is always the root: it is the dashboard, and the portal's reason to
 * exist. The last crumb is the current page and is not a link.
 */
export function PageBreadcrumb({
  trail,
}: {
  /** Ancestors, nearest last. The current page is `label` with no `href`. */
  trail: { label: string; href?: string }[];
}) {
  const crumbs = [{ label: "Documents", href: "/dashboard" }, ...trail];

  return (
    <Breadcrumb className="mb-4">
      <BreadcrumbList>
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            // The separator is itself an <li>, so it must sit beside the item
            // rather than inside it — nesting them is invalid list markup.
            <Fragment key={`${crumb.label}-${i}`}>
              <BreadcrumbItem>
                {isLast || !crumb.href ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={crumb.href}>{crumb.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {isLast ? null : <BreadcrumbSeparator />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
