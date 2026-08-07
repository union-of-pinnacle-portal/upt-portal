import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { canViewRank } from "@/lib/roles";
import { canWriteInRoom } from "@/lib/rooms";
import { getDocument, documentKind, buildContentKey } from "@/lib/documents";
import { s3 } from "@/lib/aws/s3"
import { DOCUMENTS_BUCKET } from "@/lib/aws/config";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { AppHeader } from "@/components/app-header";
import { SignOutButton } from "@/components/sign-out-button";
import { EditContentClient } from "@/components/edit-content-client";

export const dynamic = "force-dynamic";

export default async function EditContentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");

  const { id } = await params;
  const doc = await getDocument(id);
  if (!doc) notFound();

  if (documentKind(doc) !== "page") redirect("/dashboard");
  if (!canViewRank(user.role, doc.minRank)) redirect("/dashboard");

  const canEdit = await canWriteInRoom(user, doc.roomId);

  let initialContent: unknown | null = null;
  try {
    const res = await s3.send(
      new GetObjectCommand({
        Bucket: DOCUMENTS_BUCKET,
        Key: buildContentKey(id),
      }),
    );
    const body = await res.Body?.transformToString();
    if (body) initialContent = JSON.parse(body);
  } catch {
    // NoSuchKey = new page
  }

  return (
    <div className="min-h-svh bg-muted/30">
      <AppHeader>
        <SignOutButton />
      </AppHeader>
      <main className="mx-auto w-full max-w-4xl px-6 py-8">
        <div className="mb-6">
          <Link href="/dashboard" className="text-sm text-muted-foreground hover:underline">
            ← Back to documents
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{doc.title}</h1>
          {doc.description && (
            <p className="mt-1 text-sm text-muted-foreground">{doc.description}</p>
          )}
          {!canEdit && (
            <p className="mt-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              You have read-only access to this document.
            </p>
          )}
        </div>
        <div className="rounded-lg border border-border bg-background">
          <EditContentClient
            documentId={id}
            initialContent={initialContent}
            readOnly={!canEdit}
          />
        </div>
      </main>
    </div>
  );
}