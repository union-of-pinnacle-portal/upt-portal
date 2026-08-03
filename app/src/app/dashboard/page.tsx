import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import {
  listAllForAdmin,
  listPublishedForRank,
  type DocumentStatus,
  type PortalDocument,
} from "@/lib/documents";
import { canManageDocuments, type Role } from "@/lib/roles";
import { AppHeader } from "@/components/app-header";
import { SignOutButton } from "@/components/sign-out-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Documents come from DynamoDB per-request; never statically cache this page.
export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<Role, string> = {
  general: "General member",
  contributor: "Contributor",
  super_user: "Committee head",
};

const STATUS_STYLE: Record<DocumentStatus, string> = {
  published: "bg-brand text-brand-foreground",
  draft: "bg-muted text-muted-foreground",
  archived: "bg-destructive/10 text-destructive",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth/login");
  }

  const isAdmin = canManageDocuments(user.role);

  // Admins manage every document (drafts + archived included); members see only
  // what their rank may view. Isolate a data-store outage so the portal still
  // renders (and tells the user) instead of throwing a 500.
  let documents: PortalDocument[] = [];
  let loadError = false;
  try {
    documents = isAdmin
      ? await listAllForAdmin()
      : await listPublishedForRank(user.rank);
  } catch {
    loadError = true;
  }

  return (
    <div className="min-h-svh bg-muted/30">
      <AppHeader>
        {isAdmin ? (
          <Button asChild size="sm">
            <Link href="/documents/new">Upload document</Link>
          </Button>
        ) : null}
        <SignOutButton />
      </AppHeader>

      <main className="mx-auto w-full max-w-4xl px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
          <p className="text-sm text-muted-foreground">
            Signed in as {user.email || "your account"} ·{" "}
            <span className="font-medium text-foreground">
              {ROLE_LABEL[user.role]}
            </span>
          </p>
        </div>

        {loadError ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-destructive">
              Documents are temporarily unavailable. Please try again shortly.
            </CardContent>
          </Card>
        ) : documents.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              {isAdmin
                ? "No documents yet. Use “Upload document” to add the first one."
                : "No documents are available to your role yet."}
            </CardContent>
          </Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {documents.map((doc) => (
              <li key={doc.id}>
                <Card className="transition-colors hover:border-foreground/20">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <CardTitle className="text-lg leading-snug">
                        <a
                          href={`/api/documents/${doc.id}/download`}
                          className="hover:underline"
                        >
                          {doc.title}
                        </a>
                      </CardTitle>
                      {isAdmin ? (
                        <div className="flex shrink-0 items-center gap-3">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLE[doc.status]}`}
                          >
                            {doc.status}
                          </span>
                          <Link
                            href={`/documents/${doc.id}/edit`}
                            className="text-sm font-medium text-primary hover:underline"
                          >
                            Edit
                          </Link>
                        </div>
                      ) : null}
                    </div>
                    {doc.description ? (
                      <CardDescription className="line-clamp-2">
                        {doc.description}
                      </CardDescription>
                    ) : null}
                  </CardHeader>
                  <CardContent className="flex items-center justify-between text-sm text-muted-foreground">
                    <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
                      {doc.category}
                    </span>
                    <span>Updated {formatDate(doc.updatedAt)}</span>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
