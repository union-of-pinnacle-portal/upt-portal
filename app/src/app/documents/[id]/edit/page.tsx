import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { canManageDocuments } from "@/lib/roles";
import { getDocument } from "@/lib/documents";
import { DocumentEditForm } from "@/components/document-edit-form";

export const dynamic = "force-dynamic";

/**
 * Admin-only document edit page. Role is enforced here (middleware only checks
 * for a session): no session → login; non-admin → dashboard.
 */
export default async function EditDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth/login");
  }
  if (!canManageDocuments(user.role)) {
    redirect("/dashboard");
  }

  const { id } = await params;
  const doc = await getDocument(id);
  if (!doc) {
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-xl px-6 py-10">
      <header className="mb-8">
        <Link
          href="/dashboard"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Back to documents
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Edit document</h1>
      </header>
      <DocumentEditForm
        doc={{
          id: doc.id,
          title: doc.title,
          description: doc.description,
          category: doc.category,
          minRank: doc.minRank,
          status: doc.status,
          originalFilename: doc.originalFilename,
        }}
      />
    </div>
  );
}
