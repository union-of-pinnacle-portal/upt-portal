"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MIN_RANK_OPTIONS, type Rank } from "@/lib/roles";

const FIELD =
  "border-input bg-background flex w-full min-w-0 rounded-lg border px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export interface EditableDocument {
  id: string;
  title: string;
  description?: string;
  category: string;
  minRank: Rank;
  status: "draft" | "published" | "archived";
  originalFilename: string;
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
  onSuccess,
  onCancel,
}: {
  doc: EditableDocument;
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

    setSubmitting(true);

    try {
      const res = await fetch(`/api/documents/${doc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.get("title"),
          description: data.get("description"),
          category: data.get("category"),
          minRank: Number(data.get("minRank")),
          status: data.get("status"),
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

      <div className="grid gap-2">
        <Label htmlFor="category">Category</Label>
        <Input
          id="category"
          name="category"
          defaultValue={doc.category}
          required
          maxLength={100}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="minRank">Who can view</Label>
        <select
          id="minRank"
          name="minRank"
          defaultValue={String(doc.minRank)}
          className={FIELD}
        >
          {MIN_RANK_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="status">Status</Label>
        <select
          id="status"
          name="status"
          defaultValue={doc.status}
          className={FIELD}
        >
          <option value="published">Published</option>
          <option value="draft">Draft (hidden from members)</option>
          <option value="archived">Archived (hidden from members)</option>
        </select>
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
