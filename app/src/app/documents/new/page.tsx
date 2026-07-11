import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { canManageDocuments } from "@/lib/roles";
import { DocumentUploadForm } from "@/components/document-upload-form";

// Auth state is per-request; never statically cache this page.
export const dynamic = "force-dynamic";

/**
 * Admin-only upload page. This server gate is the authoritative access check —
 * middleware only verifies a session exists, so role enforcement lives here:
 * no session → login; non-admin → dashboard.
 */
export default async function NewDocumentPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth/login");
  }
  if (!canManageDocuments(user.role)) {
    redirect("/dashboard");
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
        <h1 className="mt-2 text-2xl font-semibold">Upload a document</h1>
      </header>
      <DocumentUploadForm />
    </div>
  );
}
