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
  rooms = [],
  canFileUnfiled = false,
  trigger = "Edit",
  triggerStyle = "link",
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
}: {
  doc: EditableDocument;
  categoryOptions?: string[];
  rooms?: { id: string; name: string }[];
  canFileUnfiled?: boolean;
  trigger?: string;
  triggerStyle?: "link" | "button";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
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
          rooms={rooms}
          canFileUnfiled={canFileUnfiled}
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
