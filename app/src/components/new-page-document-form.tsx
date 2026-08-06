"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface NewPageDocumentFormProps {
  rooms: { id: string; name: string }[];
  categoryOptions: string[];
  canFileUnfiled: boolean;
  minRankOptions: { value: number; label: string }[];
}

/**
 * Form to create a new portal-authored page document.
 * On submit, POSTs to /api/documents with kind: "page", then redirects
 * to the editor so the user can start writing immediately.
 */
export function NewPageDocumentForm({
  rooms,
  categoryOptions,
  canFileUnfiled,
  minRankOptions,
}: NewPageDocumentFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [roomId, setRoomId] = useState(rooms[0]?.id ?? "");
  const [minRank, setMinRank] = useState(1);
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const id = crypto.randomUUID();

    const res = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        title: title.trim(),
        description: description.trim() || undefined,
        kind: "page",
        roomId: roomId || undefined,
        minRank,
        status,
        // Page documents don't have a file — use placeholder values
        originalFilename: `${id}.page`,
        contentType: "application/json",
        sizeBytes: 0,
        categories: [],
      }),
    });

    const data = await res.json();
    setIsSubmitting(false);

    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }

    // Go straight to the editor
    router.push(`/documents/${data.id}/edit-content`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Document title"
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="description">
          Description{" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description"
        />
      </div>

      {(rooms.length > 0 || canFileUnfiled) && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="room">Committee room</Label>
          <select
            id="room"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
          >
            {canFileUnfiled && <option value="">— Unfiled —</option>}
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="minRank">Who can view</Label>
        <select
          id="minRank"
          value={minRank}
          onChange={(e) => setMinRank(Number(e.target.value))}
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
        >
          {minRankOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="status">Status</Label>
        <select
          id="status"
          value={status}
          onChange={(e) => setStatus(e.target.value as "draft" | "published")}
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </select>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Creating…" : "Create page"}
      </Button>
    </form>
  );
}
