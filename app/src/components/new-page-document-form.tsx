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
import { MIN_RANK_OPTIONS } from "@/lib/roles";
import { CategoryPicker } from "@/components/category-picker";

const UNFILED_ROOM = "unfiled";

const FIELD =
  "border-input bg-background flex w-full min-w-0 rounded-lg border px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/**
 * Form to create a new portal-authored page document.
 * Matches the shape of DocumentUploadForm so both options feel identical to users.
 * On submit, POSTs to /api/documents with kind:"page", then redirects to the editor.
 */
export function NewPageDocumentForm({
  rooms = [],
  categoryOptions = [],
  canFileUnfiled = false,
  onSuccess,
  onCancel,
}: {
  rooms?: { id: string; name: string }[];
  categoryOptions?: string[];
  canFileUnfiled?: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [roomId, setRoomId] = useState(
    rooms.length > 0 ? rooms[0].id : UNFILED_ROOM,
  );
  const [minRank, setMinRank] = useState<number>(1);
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [categories, setCategories] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Title is required.");
      return;
    }

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
        roomId: roomId === UNFILED_ROOM ? undefined : roomId,
        minRank,
        status,
        categories,
        originalFilename: `${id}.page`,
        contentType: "application/json",
        sizeBytes: 0,
      }),
    });

    setIsSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      return;
    }

    const data = await res.json();

    if (onSuccess) {
      onSuccess();
    }

    // Go straight to the editor
    router.push(`/documents/${data.id}/edit-content`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
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
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description of this document"
          rows={3}
          className={FIELD}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="categories">Categories</Label>
        <CategoryPicker
          options={categoryOptions}
          value={categories}
          onChange={setCategories}
        />
      </div>

      {(rooms.length > 0 || canFileUnfiled) && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="room">Committee room</Label>
          <Select value={roomId} onValueChange={setRoomId}>
            <SelectTrigger id="room">
              <SelectValue placeholder="Select a room" />
            </SelectTrigger>
            <SelectContent>
              {canFileUnfiled && (
                <SelectItem value={UNFILED_ROOM}>— Unfiled —</SelectItem>
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

      <div className="flex flex-col gap-2">
        <Label htmlFor="minRank">Who can view</Label>
        <Select
          value={String(minRank)}
          onValueChange={(v) => setMinRank(Number(v))}
        >
          <SelectTrigger id="minRank">
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

      <div className="flex flex-col gap-2">
        <Label htmlFor="status">Status</Label>
        <Select
          value={status}
          onValueChange={(v) => setStatus(v as "draft" | "published")}
        >
          <SelectTrigger id="status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="published">Published</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting} className="flex-1">
          {isSubmitting ? "Creating…" : "Create page"}
        </Button>
      </div>
    </form>
  );
}
