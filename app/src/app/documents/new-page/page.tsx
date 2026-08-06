import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { MIN_RANK_OPTIONS } from "@/lib/roles";
import { listWritableRooms, writesEverywhere } from "@/lib/rooms";
import { listCategoryNames } from "@/lib/category-store";
import { AppHeader } from "@/components/app-header";
import { SignOutButton } from "@/components/sign-out-button";
import { Card, CardContent } from "@/components/ui/card";
import { NewPageDocumentForm } from "@/components/new-page-document-form";

export const dynamic = "force-dynamic";

/**
 * Create a new portal-authored page document.
 * Same permission gate as /documents/new (upload): must be able to write
 * in at least one room, or be a Super User.
 */
export default async function NewPageDocumentPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");

  const managesEverything = writesEverywhere(user.role);
  const writableRooms = await listWritableRooms(user);
  const categoryOptions = await listCategoryNames();

  const canCreate = managesEverything || writableRooms.length > 0;
  if (!canCreate) redirect("/dashboard");

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
            New page document
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a document you&apos;ll write directly in the portal.
          </p>
        </div>
        <Card>
          <CardContent className="py-6">
            <NewPageDocumentForm
              rooms={writableRooms}
              categoryOptions={categoryOptions}
              canFileUnfiled={managesEverything}
              minRankOptions={[...MIN_RANK_OPTIONS]}
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
