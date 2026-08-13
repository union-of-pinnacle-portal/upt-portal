"use client";

import { useState } from "react";
import { MoreVertical } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EditDocumentDialog } from "@/components/edit-document-dialog";
import { ConvertDocumentButton } from "@/components/convert-document-button";
import { DeleteDocumentDialog } from "@/components/delete-document-dialog";
import { isConvertible } from "@/lib/document-formats";
import type { EditableDocument } from "@/components/document-edit-form";

/**
 * The Actions cell for one document row: a single ⋮ menu.
 *
 * Previously two or three text links sat side by side, which grew every time an
 * action was added and made the column widen unpredictably. A menu keeps the
 * column fixed and gives each action room for a real label.
 *
 * "Edit" means different things by kind, deliberately:
 *
 *   page — opens the document itself, where the body is edited. Metadata lives
 *          on that page too, so there is one destination.
 *   file — opens the metadata dialog, which is all you can change about an
 *          uploaded file without converting it first.
 *
 * Dialogs are rendered as siblings of the menu, not inside it: a dialog nested
 * in a menu item is unmounted the moment the menu closes.
 */
export function DocumentActions({
  doc,
  kind,
  categoryOptions,
  canDelete,
  rooms = [],
  canFileUnfiled = false,
}: {
  doc: EditableDocument;
  kind: "file" | "page";
  categoryOptions: string[];
  canDelete: boolean;
  rooms?: { id: string; name: string }[];
  canFileUnfiled?: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const showConvert = kind === "file" && isConvertible(doc.originalFilename);

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Actions for ${doc.title}`}
          className="flex size-8 items-center justify-center rounded-md hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
        >
          <MoreVertical className="size-4" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            Edit details
          </DropdownMenuItem>

          {showConvert ? (
            <DropdownMenuItem onSelect={() => setConvertOpen(true)}>
              Make editable
            </DropdownMenuItem>
          ) : null}

          {canDelete ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => setDeleteOpen(true)}
              >
                Delete
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <EditDocumentDialog
        doc={doc}
        categoryOptions={categoryOptions}
        rooms={rooms}
        canFileUnfiled={canFileUnfiled}
        open={editOpen}
        onOpenChange={setEditOpen}
        hideTrigger
      />
      {showConvert ? (
        <ConvertDocumentButton
          documentId={doc.id}
          title={doc.title}
          open={convertOpen}
          onOpenChange={setConvertOpen}
          hideTrigger
        />
      ) : null}
      {canDelete ? (
        <DeleteDocumentDialog
          documentId={doc.id}
          title={doc.title}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
        />
      ) : null}
    </div>
  );
}
