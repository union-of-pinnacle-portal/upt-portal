"use client";

import { useCallback, useEffect, useState } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $createParagraphNode,
  $getSelection,
  $isRangeSelection,
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
  COMMAND_PRIORITY_LOW,
  FORMAT_TEXT_COMMAND,
  REDO_COMMAND,
  UNDO_COMMAND,
  type TextFormatType,
} from "lexical";
import { $setBlocksType } from "@lexical/selection";
import { $createHeadingNode, $createQuoteNode } from "@lexical/rich-text";
import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
} from "@lexical/list";
import { TOGGLE_LINK_COMMAND } from "@lexical/link";
import { mergeRegister } from "@lexical/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type BlockType = "paragraph" | "h1" | "h2" | "h3" | "quote";

const BUTTON =
  "rounded px-2 py-1 text-sm hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent";

/**
 * Formatting toolbar. Deliberately small: headings, the three inline marks,
 * lists, links, quotes, undo/redo. It covers minutes and agendas, which is
 * what the portal is for — every extra control is another thing to explain to
 * a volunteer.
 *
 * Active-state tracking is subscribed to the editor rather than derived on
 * render, because selection changes do not re-render React on their own.
 */
export function Toolbar() {
  const [editor] = useLexicalComposerContext();
  const [active, setActive] = useState<Set<string>>(new Set());
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const syncActive = useCallback(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return;
    const marks = new Set<string>();
    for (const format of ["bold", "italic", "underline"] as const) {
      if (selection.hasFormat(format)) marks.add(format);
    }
    setActive(marks);
  }, []);

  useEffect(
    () =>
      mergeRegister(
        editor.registerUpdateListener(({ editorState }) => {
          editorState.read(syncActive);
        }),
        // The history plugin broadcasts whether its stacks are non-empty.
        // Returning false lets the command keep propagating to other listeners.
        editor.registerCommand(
          CAN_UNDO_COMMAND,
          (payload: boolean) => {
            setCanUndo(payload);
            return false;
          },
          COMMAND_PRIORITY_LOW,
        ),
        editor.registerCommand(
          CAN_REDO_COMMAND,
          (payload: boolean) => {
            setCanRedo(payload);
            return false;
          },
          COMMAND_PRIORITY_LOW,
        ),
      ),
    [editor, syncActive],
  );

  function format(type: TextFormatType) {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, type);
  }

  function setBlock(type: BlockType) {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      $setBlocksType(selection, () => {
        if (type === "quote") return $createQuoteNode();
        if (type === "paragraph") return $createParagraphNode();
        return $createHeadingNode(type);
      });
    });
  }

  function insertLink() {
    const url = window.prompt("Link URL");
    if (url === null) return;
    // An empty string removes the link, which is how Lexical models "unlink".
    editor.dispatchCommand(TOGGLE_LINK_COMMAND, url.trim() || null);
  }

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-border px-2 py-1.5">
      <Select defaultValue="paragraph" onValueChange={(v) => setBlock(v as BlockType)}>
        <SelectTrigger aria-label="Text style" className="h-8 w-36 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="paragraph">Normal text</SelectItem>
          <SelectItem value="h1">Heading 1</SelectItem>
          <SelectItem value="h2">Heading 2</SelectItem>
          <SelectItem value="h3">Heading 3</SelectItem>
          <SelectItem value="quote">Quote</SelectItem>
        </SelectContent>
      </Select>

      <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />

      <button
        type="button"
        onClick={() => format("bold")}
        aria-pressed={active.has("bold")}
        className={`${BUTTON} font-semibold ${active.has("bold") ? "bg-muted" : ""}`}
      >
        B
      </button>
      <button
        type="button"
        onClick={() => format("italic")}
        aria-pressed={active.has("italic")}
        className={`${BUTTON} italic ${active.has("italic") ? "bg-muted" : ""}`}
      >
        I
      </button>
      <button
        type="button"
        onClick={() => format("underline")}
        aria-pressed={active.has("underline")}
        className={`${BUTTON} underline ${active.has("underline") ? "bg-muted" : ""}`}
      >
        U
      </button>

      <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />

      <button
        type="button"
        className={BUTTON}
        onClick={() =>
          editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)
        }
      >
        • List
      </button>
      <button
        type="button"
        className={BUTTON}
        onClick={() =>
          editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)
        }
      >
        1. List
      </button>
      <button type="button" className={BUTTON} onClick={insertLink}>
        Link
      </button>

      <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />

      <button
        type="button"
        className={BUTTON}
        disabled={!canUndo}
        onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
      >
        Undo
      </button>
      <button
        type="button"
        className={BUTTON}
        disabled={!canRedo}
        onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
      >
        Redo
      </button>
    </div>
  );
}
