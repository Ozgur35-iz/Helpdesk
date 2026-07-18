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
import { useNavigate } from "react-router-dom";

type Ticket = {
  id: number;
  subject: string;
  requesterEmail: string;
  senderName: string;
  status: string;
  category: string | null;
  createdAt: string;
};

type TicketsResponse = {
  data: Ticket[];
  total: number;
  page: number;
  pageSize: number;
};

const MIN_SKELETON_MS = 2000;
const FILTER_DEBOUNCE_MS = 300;
const PAGE_SIZE = 10;
const DEFAULT_SORTING: SortingState = [{ id: "createdAt", desc: true }];
const STATUS_OPTIONS = ["open", "pending", "resolved", "closed"];
const CATEGORY_OPTIONS = ["billing", "technical", "account", "refund"];

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
  const navigate = useNavigate();
  const [sorting, setSorting] = useState<SortingState>(DEFAULT_SORTING);
  const sort = sorting[0] ?? DEFAULT_SORTING[0];

  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [subjectInput, setSubjectInput] = useState("");
  const [requesterInput, setRequesterInput] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [requesterFilter, setRequesterFilter] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setSubjectFilter(subjectInput.trim()), FILTER_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [subjectInput]);

  useEffect(() => {
    const timer = setTimeout(() => setRequesterFilter(requesterInput.trim()), FILTER_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [requesterInput]);

  const [pageIndex, setPageIndex] = useState(0);

  useEffect(() => {
    setPageIndex(0);
  }, [sort.id, sort.desc, statusFilter, categoryFilter, subjectFilter, requesterFilter]);

  const {
    data: response,
    error,
    isLoading,
  } = useQuery({
    queryKey: [
      "tickets",
      sort.id,
      sort.desc,
      statusFilter,
      categoryFilter,
      subjectFilter,
      requesterFilter,
      pageIndex,
    ],
    queryFn: async () =>
      (
        await axios.get<TicketsResponse>("/api/tickets", {
          params: {
            sortBy: sort.id,
            sortOrder: sort.desc ? "desc" : "asc",
            status: statusFilter || undefined,
            category: categoryFilter || undefined,
            subject: subjectFilter || undefined,
            requester: requesterFilter || undefined,
            page: pageIndex + 1,
            pageSize: PAGE_SIZE,
          },
        })
      ).data,
  });

  const tickets = response?.data ?? [];
  const total = response?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

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
      <div className="tickets-filters">
        <input
          type="text"
          placeholder="Search subject…"
          value={subjectInput}
          onChange={(e) => setSubjectInput(e.target.value)}
          aria-label="Search subject"
        />
        <input
          type="text"
          placeholder="Search requester…"
          value={requesterInput}
          onChange={(e) => setRequesterInput(e.target.value)}
          aria-label="Search requester"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          aria-label="Filter by category"
        >
          <option value="">All categories</option>
          {CATEGORY_OPTIONS.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
          <option value="none">None</option>
        </select>
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
                <tr
                  key={row.id}
                  className="clickable-row"
                  onClick={() => navigate(`/tickets/${row.original.id}`)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
      {!showSkeleton && (
        <div className="tickets-pagination">
          <button onClick={() => setPageIndex((p) => p - 1)} disabled={pageIndex === 0}>
            Previous
          </button>
          <span>
            Page {pageIndex + 1} of {pageCount} ({total} total)
          </span>
          <button onClick={() => setPageIndex((p) => p + 1)} disabled={pageIndex + 1 >= pageCount}>
            Next
          </button>
        </div>
      )}
    </div>
  );
}
