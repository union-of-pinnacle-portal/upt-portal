import type { LucideIcon } from "lucide-react";

/**
 * The shared empty / error state.
 *
 * These had drifted into five near-identical blocks with slightly different
 * padding and tone. Centralising them keeps "nothing here yet" looking the
 * same wherever it appears, and gives each one an icon so an empty region
 * reads as deliberate rather than as a page that failed to load.
 *
 * `tone="error"` is for genuine failures, which should not look like the calm
 * "you have nothing yet" case — the two mean opposite things about whether the
 * user should try again.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  tone = "empty",
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  tone?: "empty" | "error";
}) {
  const isError = tone === "error";

  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div
        className={`mb-3 flex size-11 items-center justify-center rounded-full ${
          isError ? "bg-destructive/10" : "bg-muted"
        }`}
      >
        <Icon
          className={`size-5 ${isError ? "text-destructive" : "text-muted-foreground"}`}
          aria-hidden="true"
        />
      </div>
      <p
        className={`text-sm font-medium ${isError ? "text-destructive" : "text-foreground"}`}
      >
        {title}
      </p>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
}
