"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * "Make editable" — converts an uploaded .docx into a portal document.
 *
 * The conversion runs here, in the browser, for two reasons: mammoth ships a
 * browser build, and Lexical builds its editor state from a DOM the server
 * doesn't have. The server only commits the finished result.
 *
 * IT IS LOSSY, and the dialog says so before doing anything. Word carries far
 * more than the editor models — tables survive only roughly, images, headers,
 * footers, numbering and most styling do not. That is why this is an explicit,
 * one-time, confirmed action rather than something that happens quietly behind
 * an Edit button: the person doing it should know what they're trading, and
 * the original .docx stays in version history either way.
 */
export function ConvertDocumentButton({
  documentId,
  title,
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
}: {
  documentId: string;
  title: string;
  /** Open state, when the row's ⋮ menu owns it. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function convert() {
    setWorking(true);
    setError(null);

    // Each step names itself, so a failure says which one broke rather than
    // surfacing a bare "Failed to fetch" that could be any of five things.
    let step = "starting";
    const at = <T,>(name: string, run: () => Promise<T>) => {
      step = name;
      return run();
    };

    try {
      // 1. Read the current file through our own origin (`inline=1`), not via
      //    the S3 redirect — one less cross-origin hop to go wrong.
      const arrayBuffer = await at("reading the file", async () => {
        const res = await fetch(
          `/api/documents/${documentId}/download?inline=1`,
        );
        if (!res.ok) {
          throw new Error(`server returned ${res.status}`);
        }
        return res.arrayBuffer();
      });

      // 2. Word → HTML. Imported here rather than at module scope so mammoth
      //    is only downloaded by someone who actually converts something, and
      //    through its package entry so the bundler applies mammoth's own
      //    browser field instead of us hardcoding its standalone UMD build.
      const html = await at("reading the Word format", async () => {
        const mammoth = await import("mammoth");
        const { value } = await mammoth.convertToHtml({ arrayBuffer });
        return value;
      });

      // 3. HTML → Lexical state. A detached editor is enough; it never mounts.
      const [
        { createEditor, $getRoot, $insertNodes },
        { $generateNodesFromDOM },
        { HeadingNode, QuoteNode },
        { ListItemNode, ListNode },
        { AutoLinkNode, LinkNode },
        { editorTheme },
      ] = await at("loading the editor", () =>
        Promise.all([
          import("lexical"),
          import("@lexical/html"),
          import("@lexical/rich-text"),
          import("@lexical/list"),
          import("@lexical/link"),
          import("@/components/editor/theme"),
        ]),
      );

      step = "building the document";
      const editor = createEditor({
        namespace: "portal-document",
        theme: editorTheme,
        nodes: [
          HeadingNode,
          QuoteNode,
          ListNode,
          ListItemNode,
          LinkNode,
          AutoLinkNode,
        ],
        onError: (err) => {
          throw err;
        },
      });

      const dom = new DOMParser().parseFromString(html, "text/html");
      editor.update(
        () => {
          const nodes = $generateNodesFromDOM(editor, dom);
          const root = $getRoot();
          root.clear();
          root.select();
          $insertNodes(nodes);
        },
        { discrete: true },
      );

      const content = JSON.stringify(editor.getEditorState().toJSON());

      // 4. Commit. The server backfills the original .docx as version 1.
      await at("saving", async () => {
        const res = await fetch(`/api/documents/${documentId}/convert`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });
        if (!res.ok) {
          throw new Error((await res.json()).error ?? `server returned ${res.status}`);
        }
      });

      router.push(`/documents/${documentId}`);
      router.refresh();
    } catch (err) {
      console.error("Conversion failed while", step, err);
      const detail = err instanceof Error ? err.message : String(err);
      setError(`Failed while ${step}: ${detail}`);
      setWorking(false);
    }
  }

  return (
    <>
      {hideTrigger ? null : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="font-medium text-primary hover:underline"
        >
          Make editable
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Make “{title}” editable</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <p className="text-sm">
              This converts the Word file into a document you can edit in the
              portal. From then on, <strong>Edit</strong> opens it in the
              editor.
            </p>
            <div className="rounded-lg border border-border bg-muted/50 p-3 text-sm">
              <p className="font-medium">Formatting will be simplified.</p>
              <p className="mt-1 text-muted-foreground">
                Headings, lists, links, bold and italic carry over. Images,
                headers and footers, page numbering, and most other Word styling
                do not. Tables come across roughly.
              </p>
              <p className="mt-2 text-muted-foreground">
                The original Word file is kept in this document&apos;s history,
                so nothing is lost — you can always download it back.
              </p>
            </div>

            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}

            <div className="flex gap-2">
              <Button onClick={convert} disabled={working}>
                {working ? "Converting…" : "Convert"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={working}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
