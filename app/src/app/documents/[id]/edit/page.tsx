import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { canManageDocuments } from "@/lib/roles";
import { getDocument } from "@/lib/documents";
import { AppHeader } from "@/components/app-header";
import { SignOutButton } from "@/components/sign-out-button";
import { Card, CardContent } from "@/components/ui/card";
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
    <div className="min-h-svh bg-muted/30">
      <AppHeader>
        <SignOutButton />
      </AppHeader>
      <main className="mx-auto w-full max-w-xl px-6 py-8">
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
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
