"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * "Download PDF" for a portal-authored document.
 *
 * Uses the browser's print-to-PDF rather than generating a PDF in JavaScript.
 * That means the export is rendered by the same engine and the same stylesheet
 * as the page itself, so it always matches what the author sees — where a PDF
 * library would need every editor node mapped to its own primitives, and would
 * silently fall behind the first time the editor gained a feature.
 *
 * The trade is that the browser shows its print dialog and the reader picks
 * "Save as PDF" (macOS and Windows both offer it as a destination). Print
 * framing lives in globals.css under `@media print`.
 */
export function DownloadPdfButton() {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => window.print()}
      title="Opens your browser's print dialog — choose “Save as PDF”"
    >
      <Download className="mr-2 size-3.5" aria-hidden="true" />
      Download PDF
    </Button>
  );
}
