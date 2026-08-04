import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { canWriteInRoom } from "@/lib/rooms";
import { getDocument } from "@/lib/documents";
import { documentCategories } from "@/lib/categories";
import { listCategoryNames } from "@/lib/category-store";
import { AppHeader } from "@/components/app-header";
import { Card, CardContent } from "@/components/ui/card";
import { DocumentEditForm } from "@/components/document-edit-form";

export const dynamic = "force-dynamic";

/**
 * Document edit page. Access is enforced here (middleware only checks for a
 * session): no session → login; no write access to *this document's room* →
 * dashboard.
 *
 * The room check must come after loading the document, since the document is
 * what names the room. Ordering it this way also means a nonexistent id 404s
 * rather than silently redirecting.
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

  const { id } = await params;
  const doc = await getDocument(id);
  if (!doc) {
    notFound();
  }

  if (!(await canWriteInRoom(user, doc.roomId))) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-svh bg-muted/30">
      <AppHeader />
      <main className="mx-auto w-full max-w-2xl px-6 py-8">
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="text-sm text-muted-foreground hover:underline"
          >
            ← Back to documents
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Edit document
          </h1>
        </div>
        <Card>
          <CardContent className="py-6">
            <DocumentEditForm
              categoryOptions={await listCategoryNames()}
              doc={{
                id: doc.id,
                title: doc.title,
                description: doc.description,
                categories: documentCategories(doc),
                minRank: doc.minRank,
                status: doc.status,
                originalFilename: doc.originalFilename,
              }}
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
