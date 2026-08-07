"use client";

import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowDown, ArrowUp, ArrowUpDown, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DocumentActions } from "@/components/document-actions";
import { UNFILED } from "@/lib/filters";
import type { DocumentKind } from "@/lib/document-formats";

/**
 * One table row, flattened on the server.
 *
 * Everything the client needs is resolved before it gets here — the room's
 * name, the categories, whether this user may edit it. That keeps the table
 * ignorant of permissions and of the `server-only` modules that decide them:
 * the client cannot compute `canEdit`, so it is never asked to.
 */
export interface DocumentRow {
  id: string;
  title: string;
  description?: string;
  kind: DocumentKind;
  roomId?: string;
  roomName: string | null;
  categories: string[];
  status: "draft" | "published" | "archived";
  updatedAt: string;
  originalFilename: string;
  minRank: 1 | 2 | 3 | 4;
  canEdit: boolean;
  /** Super Users only — deletion is stricter than editing. */
  canDelete: boolean;
}

/**
 * Radix rejects an empty string as a SelectItem value (it reserves "" for the
 * cleared state), so "all rooms" needs a real sentinel. Mapped back to "" the
 * moment it leaves the control.
 */
const ALL_ROOMS = "all";

const STATUS_STYLE: Record<DocumentRow["status"], string> = {
  published: "bg-brand text-brand-foreground",
  draft: "bg-muted text-muted-foreground",
  archived: "bg-destructive/10 text-destructive",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}

/** A sortable column header, per the shadcn Data Table pattern. */
function SortHeader({
  label,
  sorted,
  onToggle,
}: {
  label: string;
  sorted: false | "asc" | "desc";
  onToggle: () => void;
}) {
  const Icon = sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ArrowUpDown;
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onToggle}
      className="-ml-3 h-8 data-[state=open]:bg-accent"
    >
      {label}
      <Icon className="ml-2 size-3.5" aria-hidden="true" />
    </Button>
  );
}

const ROOM_COLUMN: ColumnDef<DocumentRow> = {
  id: "room",
  accessorFn: (row) => row.roomName ?? "",
  header: ({ column }) => (
    <SortHeader
      label="Room"
      sorted={column.getIsSorted()}
      onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")}
    />
  ),
  cell: ({ row }) =>
    row.original.roomName ?? <span className="text-muted-foreground/60">—</span>,
};

/**
 * The documents list, built on TanStack Table.
 *
 * Sorting, filtering and pagination all run client-side over the rows already
 * fetched. That is honest at this scale — the page loads every document the
 * viewer may see anyway, bounded by rank — but it is the thing to revisit
 * first if the corpus ever reaches the many-thousands, at which point paging
 * belongs in the DynamoDB query rather than here.
 *
 * Filter state is component state rather than the URL, which is the trade for
 * the built-in controls: a filtered view is no longer a shareable link.
 */
export function DocumentsTable({
  rows,
  rooms,
  showUnfiled,
  showManagement,
  categoryOptions,
  showRoom = true,
}: {
  rows: DocumentRow[];
  rooms: { id: string; name: string }[];
  showUnfiled: boolean;
  /** Whether the Status and Actions columns are worth showing at all. */
  showManagement: boolean;
  categoryOptions: string[];
  /**
   * Whether to show the Room column. False inside a single room, where every
   * row would repeat the same value.
   */
  showRoom?: boolean;
}) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "updatedAt", desc: true },
  ]);
  const [search, setSearch] = useState("");
  const [columnVisibility, setColumnVisibility] = useState({});
  const [room, setRoom] = useState("");

  // Room is filtered here rather than as a TanStack column filter because
  // "unfiled" is the absence of a value, which a plain equality filter on the
  // room column cannot express.
  const visible = useMemo(
    () =>
      room === UNFILED
        ? rows.filter((r) => !r.roomId)
        : room
          ? rows.filter((r) => r.roomId === room)
          : rows,
    [rows, room],
  );

  const columns = useMemo<ColumnDef<DocumentRow>[]>(() => {
    const defs: ColumnDef<DocumentRow>[] = [
      {
        accessorKey: "title",
        header: ({ column }) => (
          <SortHeader
            label="Title"
            sorted={column.getIsSorted()}
            onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")}
          />
        ),
        cell: ({ row }) => {
          const doc = row.original;
          return (
            <div>
              <a
                href={
                  doc.kind === "page"
                    ? `/documents/${doc.id}`
                    : `/api/documents/${doc.id}/download`
                }
                className="font-medium hover:underline"
              >
                {doc.title}
              </a>
              {doc.kind === "page" ? (
                <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  Doc
                </span>
              ) : null}
              {doc.description ? (
                <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                  {doc.description}
                </p>
              ) : null}
            </div>
          );
        },
      },
      {
        id: "categories",
        accessorFn: (row) => row.categories.join(" "),
        header: "Categories",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.categories.map((category) => (
              <span
                key={category}
                className="rounded-full bg-muted px-2 py-0.5 text-xs whitespace-nowrap text-muted-foreground"
              >
                {category}
              </span>
            ))}
          </div>
        ),
      },
    ];

    if (showRoom) {
      defs.splice(1, 0, ROOM_COLUMN);
    }

    if (showManagement) {
      defs.push({
        accessorKey: "status",
        header: ({ column }) => (
          <SortHeader
            label="Status"
            sorted={column.getIsSorted()}
            onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")}
          />
        ),
        cell: ({ row }) => (
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLE[row.original.status]}`}
          >
            {row.original.status}
          </span>
        ),
      });
    }

    defs.push({
      accessorKey: "updatedAt",
      header: ({ column }) => (
        <SortHeader
          label="Last updated"
          sorted={column.getIsSorted()}
          onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-muted-foreground">
          {formatDate(row.original.updatedAt)}
        </span>
      ),
    });

    if (showManagement) {
      defs.push({
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => {
          const doc = row.original;
          if (!doc.canEdit) return null;
          return (
            <DocumentActions
              kind={doc.kind}
              canDelete={doc.canDelete}
              categoryOptions={categoryOptions}
              doc={{
                id: doc.id,
                title: doc.title,
                description: doc.description,
                categories: doc.categories,
                minRank: doc.minRank,
                status: doc.status,
                originalFilename: doc.originalFilename,
              }}
            />
          );
        },
      });
    }

    return defs;
  }, [showManagement, categoryOptions, showRoom]);

  // The React Compiler lint flags useReactTable as unmemoizable. That is true
  // and expected: the table instance is rebuilt each render by design, and
  // TanStack owns its own memoization internally.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: visible,
    columns,
    state: { sorting, globalFilter: search, columnVisibility },
    onSortingChange: setSorting,
    onGlobalFilterChange: setSearch,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  const total = table.getFilteredRowModel().rows.length;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="doc-search" className="text-xs text-muted-foreground">
            Search
          </Label>
          <Input
            id="doc-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Title, room or category…"
            className="h-9 w-64"
          />
        </div>

        {rooms.length > 0 || showUnfiled ? (
          <div className="grid gap-1.5">
            <Label
              htmlFor="room-filter"
              className="text-xs text-muted-foreground"
            >
              Room
            </Label>
            <Select
              value={room || ALL_ROOMS}
              onValueChange={(value) => {
                setRoom(value === ALL_ROOMS ? "" : value);
                table.setPageIndex(0);
              }}
            >
              <SelectTrigger id="room-filter" className="h-9 w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_ROOMS}>All rooms</SelectItem>
                {rooms.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
                {showUnfiled ? (
                  <SelectItem value={UNFILED}>Unfiled</SelectItem>
                ) : null}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9">
              <SlidersHorizontal className="mr-2 size-3.5" aria-hidden="true" />
              Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Show columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {table
              .getAllColumns()
              // Title is the row's identity and the link out; hiding it would
              // leave a table you cannot navigate from.
              .filter((c) => c.getCanHide() && c.id !== "title")
              .map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  className="capitalize"
                  checked={column.getIsVisible()}
                  onCheckedChange={(value) => column.toggleVisibility(!!value)}
                >
                  {column.id === "updatedAt" ? "Last updated" : column.id}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {search || room ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              setRoom("");
            }}
          >
            Clear
          </Button>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-background">
        <Table className="min-w-[36rem]">
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={
                      header.id === "actions" ? "text-right" : undefined
                    }
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="py-10 text-center text-muted-foreground"
                >
                  No documents match those filters.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={`align-top ${cell.column.id === "actions" ? "text-right" : ""}`}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 flex items-center justify-between gap-4 text-sm text-muted-foreground">
        <span>
          {total === 0
            ? "No documents"
            : `${total} document${total === 1 ? "" : "s"} · page ${
                table.getState().pagination.pageIndex + 1
              } of ${table.getPageCount()}`}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </>
  );
}
