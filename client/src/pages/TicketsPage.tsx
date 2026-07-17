import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { useEffect, useState } from "react";

type Ticket = {
  id: number;
  subject: string;
  requesterEmail: string;
  senderName: string;
  status: string;
  category: string | null;
  createdAt: string;
};

const MIN_SKELETON_MS = 2000;
const DEFAULT_SORTING: SortingState = [{ id: "createdAt", desc: true }];

const columnHelper = createColumnHelper<Ticket>();

const columns = [
  columnHelper.accessor("subject", { header: "Subject" }),
  columnHelper.display({
    id: "requester",
    header: "Requester",
    enableSorting: false,
    cell: ({ row }) => `${row.original.senderName} <${row.original.requesterEmail}>`,
  }),
  columnHelper.accessor("status", { header: "Status" }),
  columnHelper.accessor("category", {
    header: "Category",
    cell: (info) => info.getValue() ?? "—",
  }),
  columnHelper.accessor("createdAt", {
    header: "Created",
    cell: (info) => new Date(info.getValue()).toLocaleString(),
  }),
];

export function TicketsPage() {
  const [sorting, setSorting] = useState<SortingState>(DEFAULT_SORTING);
  const sort = sorting[0] ?? DEFAULT_SORTING[0];

  const {
    data: tickets = [],
    error,
    isLoading,
  } = useQuery({
    queryKey: ["tickets", sort.id, sort.desc],
    queryFn: async () =>
      (
        await axios.get<Ticket[]>("/api/tickets", {
          params: { sortBy: sort.id, sortOrder: sort.desc ? "desc" : "asc" },
        })
      ).data,
  });

  const table = useReactTable({
    data: tickets,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    manualSorting: true,
    enableSortingRemoval: false,
    getCoreRowModel: getCoreRowModel(),
  });

  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMinTimeElapsed(true), MIN_SKELETON_MS);
    return () => clearTimeout(timer);
  }, []);

  const showSkeleton = isLoading || !minTimeElapsed;

  if (error)
    return (
      <p className="auth-error">
        {axios.isAxiosError(error)
          ? (error.response?.data?.error ?? "Failed to load tickets")
          : error.message}
      </p>
    );

  return (
    <div className="tickets-page">
      <div className="tickets-header">
        <h1>Tickets</h1>
      </div>
      <table className="tickets-table">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className={header.column.getCanSort() ? "sortable" : undefined}
                  onClick={header.column.getToggleSortingHandler()}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {header.column.getIsSorted() === "asc" && " ▲"}
                  {header.column.getIsSorted() === "desc" && " ▼"}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {showSkeleton
            ? Array.from({ length: 5 }, (_, i) => (
                <tr key={i}>
                  <td>
                    <span className="skeleton" />
                  </td>
                  <td>
                    <span className="skeleton" />
                  </td>
                  <td>
                    <span className="skeleton skeleton-short" />
                  </td>
                  <td>
                    <span className="skeleton skeleton-short" />
                  </td>
                  <td>
                    <span className="skeleton skeleton-short" />
                  </td>
                </tr>
              ))
            : table.getRowModel().rows.map((row) => (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}
