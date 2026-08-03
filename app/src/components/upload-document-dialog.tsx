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
import { Button } from "@/components/ui/button";
import { DocumentUploadForm } from "@/components/document-upload-form";

/**
 * Header "Upload document" action: opens the upload form in a modal so admins
 * stay on the dashboard (and keep their pagination position). On success it
 * closes and refreshes the table in place. The standalone /documents/new page
 * remains as a deep-link fallback.
 */
export function UploadDocumentDialog({
  rooms = [],
  categoryOptions = [],
  canFileUnfiled = false,
}: {
  rooms?: { id: string; name: string }[];
  categoryOptions?: string[];
  canFileUnfiled?: boolean;
} = {}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Upload document</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload a document</DialogTitle>
        </DialogHeader>
        <DocumentUploadForm
          rooms={rooms}
          categoryOptions={categoryOptions}
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
