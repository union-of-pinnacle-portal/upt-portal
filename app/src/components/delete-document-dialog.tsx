"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * Confirmation for permanently deleting a document.
 *
 * Deliberately not a one-click action and deliberately not `window.confirm`:
 * the dialog names the document, says what survives, and points at archiving,
 * because the common mistake is reaching for delete when "hide it from
 * members" was meant.
 *
 * Controlled from outside so the row's dropdown can open it — a dialog nested
 * inside a menu item closes with the menu.
 */
export function DeleteDocumentDialog({
  documentId,
  title,
  open,
  onOpenChange,
}: {
  documentId: string;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function remove() {
    setWorking(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error((await res.json()).error ?? "Could not delete it.");
      }
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setWorking(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete “{title}”?</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <p className="text-sm">
            This removes the document and its entire version history from the
            portal. <strong>It cannot be undone from here.</strong>
          </p>
          <p className="text-sm text-muted-foreground">
            If you only want to hide it from members, close this and set the
            status to <strong>Archived</strong> instead — that keeps the record
            and can be reversed.
          </p>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex gap-2">
            <Button
              variant="destructive"
              onClick={remove}
              disabled={working}
            >
              {working ? "Deleting…" : "Delete permanently"}
            </Button>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={working}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
