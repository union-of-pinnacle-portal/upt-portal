"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MIN_RANK_OPTIONS } from "@/lib/roles";

// Shared styling for the native <select>/<textarea>, matching the Input component.
const FIELD =
  "border-input bg-background flex w-full min-w-0 rounded-lg border px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/**
 * Admin upload form. Runs the three-step direct-to-S3 flow:
 *   1. POST /api/documents/upload-url  → { id, uploadUrl }
 *   2. PUT the file straight to S3 (never through the app server)
 *   3. POST /api/documents             → persist metadata
 * The server enforces committee-head access on steps 1 and 3; this form is
 * only reachable by admins, so failures here are unexpected and surfaced.
 *
 * `onSuccess`/`onCancel` let a host (e.g. a modal) take over on save/cancel;
 * without them the form navigates back to the dashboard (standalone page use).
 */
export function DocumentUploadForm({
  rooms = [],
  canFileUnfiled = false,
  onSuccess,
  onCancel,
}: {
  /** Committee Rooms this user may upload into. */
  rooms?: { id: string; name: string }[];
  /** Super Users may leave a document unfiled (no room). */
  canFileUnfiled?: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
} = {}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = e.currentTarget;
    const data = new FormData(form);
    const file = data.get("file") as File | null;
    if (!file || file.size === 0) {
      setError("Please choose a file.");
      return;
    }

    const contentType = file.type || "application/octet-stream";
    setSubmitting(true);

    try {
      // 1. Get a presigned upload URL and the new document id.
      const urlRes = await fetch("/api/documents/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType }),
      });
      if (!urlRes.ok) {
        throw new Error((await urlRes.json()).error ?? "Could not start upload.");
      }
      const { id, uploadUrl, contentType: signedType } = await urlRes.json();

      // 2. Upload the bytes directly to S3. The Content-Type must match the
      //    value the URL was signed with, or S3 rejects the signature.
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": signedType },
        body: file,
      });
      if (!putRes.ok) {
        throw new Error("Uploading the file to storage failed.");
      }

      // 3. Persist the document metadata.
      const metaRes = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          title: data.get("title"),
          description: data.get("description"),
          category: data.get("category"),
          roomId: data.get("roomId") || undefined,
          minRank: Number(data.get("minRank")),
          status: data.get("status"),
          originalFilename: file.name,
          contentType: signedType,
          sizeBytes: file.size,
        }),
      });
      if (!metaRes.ok) {
        throw new Error((await metaRes.json()).error ?? "Could not save the document.");
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
      <div className="grid gap-2">
        <Label htmlFor="file">File</Label>
        <Input id="file" name="file" type="file" required />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" required maxLength={200} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="description">Description</Label>
        <textarea
          id="description"
          name="description"
          rows={3}
          maxLength={2000}
          className={FIELD}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="category">Category</Label>
        <Input id="category" name="category" required maxLength={100} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="roomId">Committee room</Label>
        <select
          id="roomId"
          name="roomId"
          className={FIELD}
          required={!canFileUnfiled}
          defaultValue={canFileUnfiled ? "" : (rooms[0]?.id ?? "")}
        >
          {/* Only Super Users get the unfiled option; for everyone else the
              room is what authorizes the upload, so it cannot be blank. */}
          {canFileUnfiled ? <option value="">No room (unfiled)</option> : null}
          {rooms.map((room) => (
            <option key={room.id} value={room.id}>
              {room.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Controls who can edit this document later. It does not affect who can
          see it — that is “Who can view” below.
        </p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="minRank">Who can view</Label>
        <select id="minRank" name="minRank" defaultValue="1" className={FIELD}>
          {MIN_RANK_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="status">Status</Label>
        <select id="status" name="status" defaultValue="published" className={FIELD}>
          <option value="published">Published</option>
          <option value="draft">Draft (hidden from members)</option>
        </select>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Uploading…" : "Upload document"}
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
