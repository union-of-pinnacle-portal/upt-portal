"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DocumentEditForm,
  type EditableDocument,
} from "@/components/document-edit-form";
import { Button } from "@/components/ui/button";

/**
 * Table-row "Edit" action: opens the metadata edit form in a modal so admins
 * stay on the current page (and pagination position). On save it closes and
 * refreshes the table in place. The standalone /documents/[id]/edit page
 * remains as a deep-link fallback.
 */
export function EditDocumentDialog({
  doc,
  categoryOptions = [],
  trigger = "Edit",
  triggerStyle = "link",
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
}: {
  doc: EditableDocument;
  categoryOptions?: string[];
  /** Trigger text. "Details" on a page document, where "Edit" means the body. */
  trigger?: string;
  /**
   * How the trigger looks. "link" sits inline in a table's Actions cell
   * alongside the other text actions; "button" matches the outline buttons in
   * the app header, where it appears next to page-level actions.
   */
  triggerStyle?: "link" | "button";
  /**
   * Open state, when a parent owns it — the row's ⋮ menu opens this dialog,
   * and a dialog rendered inside a menu item unmounts as the menu closes.
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Suppress the built-in trigger when something else opens the dialog. */
  hideTrigger?: boolean;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {hideTrigger ? null : triggerStyle === "button" ? (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            {trigger}
          </Button>
        </DialogTrigger>
      ) : (
        <DialogTrigger className="font-medium text-primary hover:underline">
          {trigger}
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit document</DialogTitle>
        </DialogHeader>
        <DocumentEditForm
          doc={doc}
          categoryOptions={categoryOptions}
          onSuccess={() => {
            setOpen(false);
            router.refresh();
          }}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
