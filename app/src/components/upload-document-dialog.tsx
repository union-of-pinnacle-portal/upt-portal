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
import { NewPageDocumentForm } from "@/components/new-page-document-form";

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
  const [tab, setTab] = useState<"upload" | "page">("upload");
  const router = useRouter();

  function handleSuccess() {
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Add document</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add document</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 border-b border-border pb-3">
          <button
            type="button"
            onClick={() => setTab("upload")}
            className={`text-sm font-medium px-3 py-1.5 rounded-md transition-colors ${
              tab === "upload"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Upload file
          </button>
          <button
            type="button"
            onClick={() => setTab("page")}
            className={`text-sm font-medium px-3 py-1.5 rounded-md transition-colors ${
              tab === "page"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Create page
          </button>
        </div>

        {tab === "upload" ? (
          <DocumentUploadForm
            rooms={rooms}
            categoryOptions={categoryOptions}
            canFileUnfiled={canFileUnfiled}
            onSuccess={handleSuccess}
            onCancel={() => setOpen(false)}
          />
        ) : (
          <NewPageDocumentForm
            rooms={rooms}
            categoryOptions={categoryOptions}
            canFileUnfiled={canFileUnfiled}
            onSuccess={handleSuccess}
            onCancel={() => setOpen(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}