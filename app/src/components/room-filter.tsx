import Link from "next/link";

/**
 * Sentinel for "documents with no room". A real room id is a uuid, so this
 * cannot collide with one.
 */
export const UNFILED = "unfiled";

/**
 * Room filter for the documents table, rendered as links rather than a
 * <select> so it needs no client JavaScript and each filter state is a real,
 * shareable URL.
 *
 * Selecting a room always drops the `page` param — staying on page 3 of a
 * filter that now has one page of results would show an empty table.
 */
export function RoomFilter({
  rooms,
  selected,
  showUnfiled,
}: {
  rooms: { id: string; name: string }[];
  selected: string;
  /** Only worth offering when unfiled documents can actually be seen. */
  showUnfiled?: boolean;
}) {
  const options = [
    { value: "", label: "All rooms" },
    ...rooms.map((r) => ({ value: r.id, label: r.name })),
    ...(showUnfiled ? [{ value: UNFILED, label: "Unfiled" }] : []),
  ];

  if (rooms.length === 0 && !showUnfiled) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-1.5">
      {options.map((opt) => {
        const isActive = selected === opt.value;
        return (
          <Link
            key={opt.value || "all"}
            href={opt.value ? `/dashboard?room=${opt.value}` : "/dashboard"}
            aria-current={isActive ? "page" : undefined}
            className={
              isActive
                ? "rounded-full bg-foreground px-3 py-1 text-xs font-medium text-background"
                : "rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
            }
          >
            {opt.label}
          </Link>
        );
      })}
    </div>
  );
}
