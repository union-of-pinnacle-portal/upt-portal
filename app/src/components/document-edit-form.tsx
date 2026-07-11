"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const FIELD =
  "border-input bg-background flex w-full min-w-0 rounded-lg border px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export interface EditableDocument {
  id: string;
  title: string;
  description?: string;
  category: string;
  minRank: 1 | 2 | 3;
  status: "draft" | "published" | "archived";
  originalFilename: string;
}

/**
 * Admin edit form for a document's metadata. Sends a PATCH with only the
 * editable fields; the file itself is not replaceable here (P0 edits metadata
 * only). Status covers publish/unpublish/archive.
 */
export function DocumentEditForm({ doc }: { doc: EditableDocument }) {
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
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <p className="text-sm text-muted-foreground">
        File: <span className="font-mono">{doc.originalFilename}</span> (cannot
        be changed here)
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
          <option value="1">All members (general and up)</option>
          <option value="2">Contributors and committee heads</option>
          <option value="3">Committee heads only</option>
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
          onClick={() => router.push("/dashboard")}
          disabled={submitting}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
