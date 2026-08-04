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

/**
 * Table-row "Edit" action: opens the metadata edit form in a modal so admins
 * stay on the current page (and pagination position). On save it closes and
 * refreshes the table in place. The standalone /documents/[id]/edit page
 * remains as a deep-link fallback.
 */
export function EditDocumentDialog({
  doc,
  categoryOptions = [],
}: {
  doc: EditableDocument;
  categoryOptions?: string[];
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="font-medium text-primary hover:underline">
        Edit
      </DialogTrigger>
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
