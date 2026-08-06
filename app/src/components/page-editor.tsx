"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { ListNode, ListItemNode } from "@lexical/list";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { LinkNode } from "@lexical/link";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import {
  $getSelection,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
  FORMAT_ELEMENT_COMMAND,
  type EditorState,
  type LexicalEditor,
} from "lexical";
import {
  $createHeadingNode,
  $createQuoteNode,
} from "@lexical/rich-text";
import { $setBlocksType } from "@lexical/selection";
import { $getRoot, $createParagraphNode } from "lexical";
import { Button } from "@/components/ui/button";

/** Minimal toolbar plugin — sits inside the composer so it can dispatch commands. */
function ToolbarPlugin({ readOnly }: { readOnly: boolean }) {
  const [editor] = useLexicalComposerContext();

  if (readOnly) return null;

  const format = (fmt: Parameters<typeof FORMAT_TEXT_COMMAND>[1]) =>
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, fmt);

  const setBlock = (type: "h1" | "h2" | "h3" | "paragraph" | "quote") => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      if (type === "quote") {
        $setBlocksType(selection, () => $createQuoteNode());
      } else if (type === "paragraph") {
        $setBlocksType(selection, () => $createParagraphNode());
      } else {
        $setBlocksType(selection, () => $createHeadingNode(type));
      }
    });
  };

  return (
    <div className="flex flex-wrap gap-1 border-b border-border px-3 py-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setBlock("h1")}
        className="text-xs"
      >
        H1
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setBlock("h2")}
        className="text-xs"
      >
        H2
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setBlock("paragraph")}
        className="text-xs"
      >
        ¶
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setBlock("quote")}
        className="text-xs"
      >
        " "
      </Button>
      <div className="mx-1 h-6 w-px self-center bg-border" />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => format("bold")}
        className="text-xs font-bold"
      >
        B
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => format("italic")}
        className="text-xs italic"
      >
        I
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => format("underline")}
        className="text-xs underline"
      >
        U
      </Button>
    </div>
  );
}

/** Restores saved content into the editor on first mount. */
function RestorePlugin({
  initialContent,
}: {
  initialContent: unknown | null;
}) {
  const [editor] = useLexicalComposerContext();
  const restored = useRef(false);

  useEffect(() => {
    if (restored.current || !initialContent) return;
    restored.current = true;
    const state = editor.parseEditorState(JSON.stringify(initialContent));
    editor.setEditorState(state);
  }, [editor, initialContent]);

  return null;
}

const theme = {
  heading: {
    h1: "text-3xl font-bold my-4",
    h2: "text-2xl font-semibold my-3",
    h3: "text-xl font-semibold my-2",
  },
  quote: "border-l-4 border-border pl-4 my-3 text-muted-foreground italic",
  text: {
    bold: "font-bold",
    italic: "italic",
    underline: "underline",
  },
  list: {
    ul: "list-disc pl-6 my-2",
    ol: "list-decimal pl-6 my-2",
    listitem: "my-1",
  },
  paragraph: "my-2",
};

interface PageEditorProps {
  documentId: string;
  initialContent: unknown | null;
  readOnly?: boolean;
}

/**
 * Lexical-based rich text editor for portal page documents.
 *
 * Controlled save: user clicks "Save" which POSTs the current editor state
 * to /api/documents/:id/content. No autosave — each save creates a snapshot.
 */
export function PageEditor({
  documentId,
  initialContent,
  readOnly = false,
}: PageEditorProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">(
    "idle",
  );
  const currentStateRef = useRef<EditorState | null>(null);

  const handleChange = useCallback((state: EditorState) => {
    currentStateRef.current = state;
    setSaveStatus("idle");
  }, []);

  async function handleSave() {
    if (!currentStateRef.current) return;
    setIsSaving(true);
    setSaveStatus("idle");

    try {
      const content = currentStateRef.current.toJSON();
      const res = await fetch(`/api/documents/${documentId}/content`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (!res.ok) {
        setSaveStatus("error");
      } else {
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 3000);
      }
    } catch {
      setSaveStatus("error");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-0">
      {!readOnly && (
        <div className="flex items-center justify-between border-b border-border bg-background px-4 py-2">
          <span className="text-xs text-muted-foreground">
            {saveStatus === "saved" && "Saved"}
            {saveStatus === "error" && (
              <span className="text-destructive">Save failed — try again</span>
            )}
          </span>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? "Saving…" : "Save"}
          </Button>
        </div>
      )}

      <LexicalComposer
        initialConfig={{
          namespace: `page-${documentId}`,
          theme,
          editable: !readOnly,
          onError: (err) => console.error("Lexical error:", err),
          nodes: [
            HeadingNode,
            QuoteNode,
            ListNode,
            ListItemNode,
            LinkNode,
          ],
        }}
      >
        <ToolbarPlugin readOnly={readOnly} />
        <div className="relative min-h-[400px]">
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                className="min-h-[400px] px-6 py-4 text-sm leading-relaxed outline-none"
                aria-label="Document content"
              />
            }
            placeholder={
              <div className="pointer-events-none absolute left-6 top-4 text-sm text-muted-foreground">
                {readOnly
                  ? "This page has no content yet."
                  : "Start writing…"}
              </div>
            }
            ErrorBoundary={({ children }) => <>{children}</>}
          />
        </div>
        <HistoryPlugin />
        <ListPlugin />
        <LinkPlugin />
        <OnChangePlugin onChange={handleChange} />
        <RestorePlugin initialContent={initialContent} />
      </LexicalComposer>
    </div>
  );
}
