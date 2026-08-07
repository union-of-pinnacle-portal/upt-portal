"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { ListItemNode, ListNode } from "@lexical/list";
import { AutoLinkNode, LinkNode } from "@lexical/link";
import type { EditorState } from "lexical";

import { Button } from "@/components/ui/button";
import { editorTheme } from "@/components/editor/theme";
import { Toolbar } from "@/components/editor/toolbar";

/** Every node type the theme styles must be registered, or Lexical throws. */
const NODES = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  LinkNode,
  AutoLinkNode,
];

/** How often to renew the edit lease, comfortably inside its 120s lifetime. */
const HEARTBEAT_MS = 45_000;

/**
 * The page-document editor.
 *
 * Saving is explicit. Autosave-on-keystroke would either spam the version
 * history — every save is a version here, the same as replacing an uploaded
 * file — or need a parallel draft mechanism that can disagree with it. A Save
 * button and an unsaved-changes warning are honest about when work is durable.
 *
 * The edit lock is advisory: it stops two people unknowingly typing into the
 * same document, and the server never refuses a save because of it. Someone
 * who arrives second gets a read-only editor and a banner naming the holder.
 */
export function PageEditor({
  documentId,
  initialContent,
  canEdit,
  lockedBy,
}: {
  documentId: string;
  /** Serialized Lexical state, or null for a document with no body yet. */
  initialContent: string | null;
  /** Whether this user may write the document's room at all. */
  canEdit: boolean;
  /** Someone else's email if they hold the lock, else null. */
  lockedBy: string | null;
}) {
  const router = useRouter();
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Held in a ref, not state: it changes on every keystroke and nothing
  // renders from it, so state would re-render the whole editor as you type.
  const latest = useRef<string | null>(initialContent);

  const editable = canEdit && !lockedBy;

  const save = useCallback(async () => {
    if (!latest.current) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/content`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: latest.current }),
      });
      if (!res.ok) {
        throw new Error((await res.json()).error ?? "Could not save.");
      }
      const { savedAt: at } = await res.json();
      setSavedAt(at);
      setDirty(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }, [documentId, router]);

  // Hold the lease while the tab is open, and give it up on the way out so the
  // next person doesn't wait out the full expiry.
  useEffect(() => {
    if (!editable) return;

    const beat = () =>
      void fetch(`/api/documents/${documentId}/lock`, { method: "POST" });
    const timer = setInterval(beat, HEARTBEAT_MS);

    const release = () => {
      // keepalive so the request survives the page going away.
      void fetch(`/api/documents/${documentId}/lock`, {
        method: "DELETE",
        keepalive: true,
      });
    };
    window.addEventListener("pagehide", release);

    return () => {
      clearInterval(timer);
      window.removeEventListener("pagehide", release);
      release();
    };
  }, [documentId, editable]);

  // Browser-level guard for the close/navigate-away case the Save button
  // cannot cover.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function onChange(state: EditorState) {
    const serialized = JSON.stringify(state.toJSON());
    if (serialized === latest.current) return;
    latest.current = serialized;
    setDirty(true);
  }

  return (
    <LexicalComposer
      initialConfig={{
        namespace: "portal-document",
        theme: editorTheme,
        nodes: NODES,
        editable,
        editorState: initialContent ?? undefined,
        onError: (err) => {
          // Surfacing beats Lexical's default of throwing into the void; a
          // corrupt state should say so rather than render an empty page.
          console.error(err);
          setError("The document could not be loaded correctly.");
        },
      }}
    >
      <div className="print-document rounded-lg border border-border bg-background">
        {editable ? (
          <div className="print-hide">
            <Toolbar />
          </div>
        ) : null}
        <div className="relative px-4 py-3">
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                // Capped to a readable measure rather than the page width.
                // Past roughly 90 characters the eye loses its place tracking
                // back to the start of the next line.
                className="print-document mx-auto min-h-[24rem] max-w-[70ch] outline-none"
                aria-label="Document body"
              />
            }
            placeholder={
              <p className="pointer-events-none absolute inset-x-0 top-3 mx-auto max-w-[70ch] px-4 text-muted-foreground">
                {editable ? "Start writing…" : "This document is empty."}
              </p>
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
          <HistoryPlugin />
          <ListPlugin />
          <LinkPlugin />
          <OnChangePlugin onChange={onChange} ignoreSelectionChange />
        </div>
      </div>

      {lockedBy ? (
        <p className="print-hide mt-3 rounded-lg bg-muted px-3 py-2 text-sm">
          <span className="font-medium">{lockedBy}</span> is editing this
          document. You are seeing it read-only so you don&apos;t both write
          over each other. Reload once they&apos;re done.
        </p>
      ) : null}

      {canEdit && !lockedBy ? (
        <div className="print-hide mt-4 flex items-center gap-3">
          <Button onClick={save} disabled={saving || !dirty}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <span className="text-sm text-muted-foreground">
            {dirty
              ? "Unsaved changes"
              : savedAt
                ? "Saved"
                : "No changes yet"}
          </span>
        </div>
      ) : null}

      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
    </LexicalComposer>
  );
}
