"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { MIN_RANK_OPTIONS, type Rank } from "@/lib/roles";
import { CategoryPicker } from "@/components/category-picker";

const FIELD =
  "border-input bg-background flex w-full min-w-0 rounded-lg border px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export interface EditableDocument {
  id: string;
  title: string;
  description?: string;
  /** Current categories, already normalized (legacy value folded in). */
  categories: string[];
  minRank: Rank;
  status: "draft" | "published" | "archived";
  originalFilename: string;
  /** Current room this document is filed in */
  roomId?: string;
}

/**
 * Admin edit form for a document's metadata. Sends a PATCH with only the
 * editable fields; the file itself is not replaceable here (P0 edits metadata
 * only). Status covers publish/unpublish/archive.
 *
 * `onSuccess`/`onCancel` let a host (e.g. a modal) take over on save/cancel;
 * without them the form navigates back to the dashboard (standalone page use).
 */
export function DocumentEditForm({
  doc,
  categoryOptions = [],
  rooms = [],
  canFileUnfiled = false,
  onSuccess,
  onCancel,
}: {
  doc: EditableDocument;
  categoryOptions?: string[];
  rooms?: { id: string; name: string }[];
  canFileUnfiled?: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const data = new FormData(e.currentTarget);

    const categories = data.getAll("categories").map(String);
    if (categories.length === 0) {
      setError("Please choose at least one category.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch(`/api/documents/${doc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.get("title"),
          description: data.get("description"),
          categories,
          minRank: Number(data.get("minRank")),
          status: data.get("status"),
          ...(rooms.length > 0 || canFileUnfiled
            ? {
                roomId: data.get("roomId") === "unfiled" ? null : (data.get("roomId") as string) || null,
              }
            : {}),
        }),
      });
      if (!res.ok) {
        throw new Error((await res.json()).error ?? "Could not save changes.");
      }
      if (onSuccess) {
        onSuccess();
        router.refresh();
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <p className="text-sm text-muted-foreground">
        File: <span className="font-mono">{doc.originalFilename}</span>
      </p>

      <div className="grid gap-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" defaultValue={doc.title} required maxLength={200} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="description">Description</Label>
        <textarea
          id="description"
          name="description"
          rows={3}
          maxLength={2000}
          defaultValue={doc.description ?? ""}
          className={FIELD}
        />
      </div>

      <CategoryPicker options={categoryOptions} selected={doc.categories} />

      {(rooms.length > 0 || canFileUnfiled) && (
        <div className="grid gap-2">
          <Label htmlFor="roomId">Committee room</Label>
          <Select name="roomId" defaultValue={doc.roomId ?? "unfiled"}>
            <SelectTrigger id="roomId" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {canFileUnfiled && (
                <SelectItem value="unfiled">— Unfiled —</SelectItem>
              )}
              {rooms.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid gap-2">
        <Label htmlFor="minRank">Who can view</Label>
        <Select name="minRank" defaultValue={String(doc.minRank)}>
          <SelectTrigger id="minRank" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MIN_RANK_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={String(opt.value)}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="status">Status</Label>
        <Select name="status" defaultValue={doc.status}>
          <SelectTrigger id="status" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="draft">Draft (hidden from members)</SelectItem>
            <SelectItem value="archived">Archived (hidden from members)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Save changes"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => (onCancel ? onCancel() : router.push("/dashboard"))}
          disabled={submitting}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
