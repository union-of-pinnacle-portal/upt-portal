import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { canManageDocuments } from "@/lib/roles";
import { AppHeader } from "@/components/app-header";
import { SignOutButton } from "@/components/sign-out-button";
import { Card, CardContent } from "@/components/ui/card";
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
            Upload a document
          </h1>
        </div>
        <Card>
          <CardContent className="py-6">
            <DocumentUploadForm />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
