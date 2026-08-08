import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { listWritableRooms, writesEverywhere } from "@/lib/rooms";
import { listCategoryNames } from "@/lib/category-store";
import { AppHeader } from "@/components/app-header";
import { BackButton } from "@/components/back-button";
import { Card, CardContent } from "@/components/ui/card";
import { DocumentUploadForm } from "@/components/document-upload-form";

// Auth state is per-request; never statically cache this page.
export const dynamic = "force-dynamic";

/**
 * Standalone upload page (the dashboard's modal is the usual route in). This
 * server gate is the authoritative access check — middleware only verifies a
 * session exists: no session → login; nowhere to upload to → dashboard.
 *
 * "Nowhere to upload to" means no Committee Room this user may write in. Super
 * Users pass regardless, since they may file a document with no room at all.
 */
export default async function NewDocumentPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth/login");
  }

  const canFileUnfiled = writesEverywhere(user.role);
  const rooms = await listWritableRooms(user);
  if (!canFileUnfiled && rooms.length === 0) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-svh bg-muted/30">
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl px-6 py-8">
        <BackButton href="/dashboard" label="Back to documents" />

        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">
            Upload a document
          </h1>
        </div>
        <Card>
          <CardContent className="py-6">
            <DocumentUploadForm
              rooms={rooms}
              categoryOptions={await listCategoryNames()}
              canFileUnfiled={canFileUnfiled}
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
