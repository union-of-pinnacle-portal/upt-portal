import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import {
  listAllForAdmin,
  listPublishedForRank,
  type DocumentStatus,
  type PortalDocument,
} from "@/lib/documents";
import { canManageDocuments } from "@/lib/roles";
import { SignOutButton } from "@/components/sign-out-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Documents come from DynamoDB per-request; never statically cache this page.
export const dynamic = "force-dynamic";

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

const STATUS_STYLE: Record<DocumentStatus, string> = {
  published: "bg-primary/10 text-primary",
  draft: "bg-muted text-muted-foreground",
  archived: "bg-destructive/10 text-destructive",
};

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
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Documents</h1>
          <p className="text-sm text-muted-foreground">
            {user.email} · Role: <strong>{user.role}</strong>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin ? (
            <Button asChild size="sm">
              <Link href="/documents/new">Upload document</Link>
            </Button>
          ) : null}
          <SignOutButton />
        </div>
      </header>

      {loadError ? (
        <p className="text-sm text-destructive">
          Documents are temporarily unavailable. Please try again shortly.
        </p>
      ) : documents.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {isAdmin
            ? "No documents yet. Upload one to get started."
            : "No documents are available to your role yet."}
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {documents.map((doc) => (
            <li key={doc.id}>
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-lg">
                      <a
                        href={`/api/documents/${doc.id}/download`}
                        className="hover:underline"
                      >
                        {doc.title}
                      </a>
                    </CardTitle>
                    {isAdmin ? (
                      <div className="flex shrink-0 items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[doc.status]}`}
                        >
                          {doc.status}
                        </span>
                        <Link
                          href={`/documents/${doc.id}/edit`}
                          className="text-sm text-primary hover:underline"
                        >
                          Edit
                        </Link>
                      </div>
                    ) : null}
                  </div>
                  {doc.description ? (
                    <CardDescription>{doc.description}</CardDescription>
                  ) : null}
                </CardHeader>
                <CardContent className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{doc.category}</span>
                  <span>Updated {formatDate(doc.updatedAt)}</span>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
