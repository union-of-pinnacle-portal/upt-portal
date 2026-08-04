"use client";

import { useMemo, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import {
  MAX_CATEGORY_LENGTH,
  categoryKey,
  normalizeCategoryName,
} from "@/lib/categories";

/**
 * Multi-select category picker with inline creation.
 *
 * Replaced a checkbox grid, which stopped scaling once categories became
 * user-creatable: typing to filter beats scanning a list that grows without
 * bound. Selected categories stay visible as chips above the field so the
 * answer never scrolls out of view.
 *
 * The selection is submitted as hidden inputs named `categories`, so host
 * forms keep reading it with `formData.getAll("categories")` and need no state
 * of their own.
 *
 * Creation is optimistic in the sense that the name is only *proposed* here —
 * the server resolves it against the stored vocabulary, so typing "legal" when
 * "Legal" exists reuses the existing category rather than forking it. That
 * matching is duplicated in `suggestion()` below purely so the UI doesn't
 * offer to "create" something that already exists; the server remains the
 * authority.
 */
export function CategoryPicker({
  options,
  selected: initialSelected = [],
}: {
  /** The existing vocabulary, from the server. */
  options: string[];
  /** Categories already on the document, when editing. */
  selected?: readonly string[];
}) {
  const [selected, setSelected] = useState<string[]>([...initialSelected]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedKeys = useMemo(
    () => new Set(selected.map(categoryKey)),
    [selected],
  );

  /** Unselected options matching the query, plus every known name for dedupe. */
  const { matches, knownKeys } = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return {
      matches: options.filter(
        (o) =>
          !selectedKeys.has(categoryKey(o)) &&
          (!needle || o.toLowerCase().includes(needle)),
      ),
      knownKeys: new Set(options.map(categoryKey)),
    };
  }, [options, query, selectedKeys]);

  /**
   * The name the "create" row would add, or null when there is nothing to
   * create — the query is empty/invalid, or it already names a category
   * (whether or not that one is currently selected).
   */
  const suggestion = useMemo(() => {
    const name = normalizeCategoryName(query);
    if (!name) return null;
    const key = categoryKey(name);
    if (knownKeys.has(key) || selectedKeys.has(key)) return null;
    return name;
  }, [query, knownKeys, selectedKeys]);

  // The create row sits last, so its index is the number of matches.
  const rowCount = matches.length + (suggestion ? 1 : 0);

  function add(name: string) {
    if (!selectedKeys.has(categoryKey(name))) {
      setSelected((prev) => [...prev, name]);
    }
    setQuery("");
    setHighlight(0);
    inputRef.current?.focus();
  }

  function remove(name: string) {
    setSelected((prev) => prev.filter((c) => c !== name));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      if (rowCount === 0) return;
      const step = e.key === "ArrowDown" ? 1 : -1;
      setHighlight((h) => (h + step + rowCount) % rowCount);
      return;
    }
    if (e.key === "Enter") {
      // Never let the picker submit the surrounding form.
      e.preventDefault();
      if (rowCount === 0) return;
      const pick = highlight < matches.length ? matches[highlight] : suggestion;
      if (pick) add(pick);
      return;
    }
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    // Backspace on an empty query removes the last chip, the usual token-field
    // behaviour — it beats reaching for the mouse to undo a mis-click.
    if (e.key === "Backspace" && query === "" && selected.length > 0) {
      remove(selected[selected.length - 1]);
    }
  }

  return (
    <div
      className="grid gap-2"
      // Close when focus leaves the whole widget (input or any row), rather
      // than on input blur alone, which would fire before a row's click lands.
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
    >
      <Label htmlFor="category-search">Categories</Label>

      {selected.map((name) => (
        <input key={name} type="hidden" name="categories" value={name} />
      ))}

      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((name) => (
            <span
              key={name}
              className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium"
            >
              {name}
              <button
                type="button"
                onClick={() => remove(name)}
                aria-label={`Remove ${name}`}
                className="text-muted-foreground hover:text-foreground"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div className="relative">
        <input
          id="category-search"
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls="category-options"
          autoComplete="off"
          maxLength={MAX_CATEGORY_LENGTH}
          value={query}
          placeholder={
            selected.length > 0
              ? "Add another category…"
              : "Search or create a category…"
          }
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlight(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="border-input bg-background flex w-full min-w-0 rounded-lg border px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />

        {open ? (
          <ul
            id="category-options"
            role="listbox"
            className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-input bg-background p-1 shadow-md"
          >
            {matches.map((name, i) => (
              <li key={name}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === highlight}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => add(name)}
                  className={`w-full rounded-md px-2 py-1.5 text-left text-sm ${
                    i === highlight ? "bg-muted" : ""
                  }`}
                >
                  {name}
                </button>
              </li>
            ))}

            {suggestion ? (
              <li>
                <button
                  type="button"
                  role="option"
                  aria-selected={highlight === matches.length}
                  onMouseEnter={() => setHighlight(matches.length)}
                  onClick={() => add(suggestion)}
                  className={`w-full rounded-md px-2 py-1.5 text-left text-sm ${
                    highlight === matches.length ? "bg-muted" : ""
                  }`}
                >
                  Create “<span className="font-medium">{suggestion}</span>”
                </button>
              </li>
            ) : null}

            {rowCount === 0 ? (
              <li className="px-2 py-1.5 text-sm text-muted-foreground">
                {query.trim()
                  ? "Already selected."
                  : "All categories selected."}
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground">
        Pick at least one. Type a new name to create a category — it becomes
        available to everyone, so check the list before adding.
      </p>
    </div>
  );
}
