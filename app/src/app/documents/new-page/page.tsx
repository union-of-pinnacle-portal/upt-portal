import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { listWritableRooms, writesEverywhere } from "@/lib/rooms";
import { listCategoryNames } from "@/lib/category-store";
import { AppHeader } from "@/components/app-header";
import { Card, CardContent } from "@/components/ui/card";
import { NewPageDocumentForm } from "@/components/new-page-document-form";

export const dynamic = "force-dynamic";

/**
 * Create a new portal-authored page document.
 * Same access gate as /documents/new (upload): must be able to write
 * in at least one room, or be a Super User who can file anywhere.
 */
export default async function NewPageDocumentPage() {
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
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="text-sm text-muted-foreground hover:underline"
          >
            ← Back to documents
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Create a page document
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Write a document directly in the portal — no file upload needed.
          </p>
        </div>
        <Card>
          <CardContent className="py-6">
            <NewPageDocumentForm
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
