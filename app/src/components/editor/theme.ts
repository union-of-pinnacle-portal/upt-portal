import type { EditorThemeClasses } from "lexical";

/**
 * Lexical maps node types to CSS classes through this object. Tailwind's
 * preflight strips default heading/list styling, so every element the editor
 * can produce has to be styled here or it renders as plain text — including in
 * the read-only viewer, which shares this theme so a document looks identical
 * whether you can edit it or not.
 */
export const editorTheme: EditorThemeClasses = {
  paragraph: "mb-3 leading-relaxed",
  quote: "mb-3 border-l-4 border-border pl-4 italic text-muted-foreground",
  heading: {
    h1: "mb-3 mt-6 text-2xl font-semibold tracking-tight first:mt-0",
    h2: "mb-2 mt-5 text-xl font-semibold tracking-tight first:mt-0",
    h3: "mb-2 mt-4 text-lg font-semibold tracking-tight first:mt-0",
  },
  list: {
    ul: "mb-3 ml-6 list-disc",
    ol: "mb-3 ml-6 list-decimal",
    listitem: "mb-1",
    nested: { listitem: "list-none" },
  },
  link: "text-primary underline underline-offset-2",
  text: {
    bold: "font-semibold",
    italic: "italic",
    underline: "underline underline-offset-2",
    strikethrough: "line-through",
    code: "rounded bg-muted px-1 py-0.5 font-mono text-sm",
  },
};
