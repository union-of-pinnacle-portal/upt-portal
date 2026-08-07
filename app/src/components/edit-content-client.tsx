"use client";

import dynamic from "next/dynamic";

const PageEditor = dynamic(
  () => import("@/components/page-editor").then((m) => m.PageEditor),
  {
    ssr: false,
    loading: () => (
      <div className="p-6 text-sm text-muted-foreground">Loading editor…</div>
    ),
  },
);

export function EditContentClient({
  documentId,
  initialContent,
  readOnly,
}: {
  documentId: string;
  initialContent: unknown | null;
  readOnly: boolean;
}) {
  return (
    <PageEditor
      documentId={documentId}
      initialContent={initialContent}
      readOnly={readOnly}
    />
  );
}