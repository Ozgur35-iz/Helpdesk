import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import { TicketsPage } from "./TicketsPage";
import { renderWithQuery } from "../test/renderWithQuery";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    isAxiosError: vi.fn(),
  },
}));

const mockedGet = vi.mocked(axios.get);
const mockedIsAxiosError = vi.mocked(axios.isAxiosError);

function renderTicketsPage() {
  return renderWithQuery(<TicketsPage />);
}

const tickets = [
  {
    id: 2,
    subject: "Can't reset my password",
    requesterEmail: "bob@example.com",
    senderName: "Bob Smith",
    status: "open",
    category: null,
    createdAt: "2024-06-01T12:00:00.000Z",
  },
  {
    id: 1,
    subject: "Billing question",
    requesterEmail: "ada@example.com",
    senderName: "Ada Lovelace",
    status: "open",
    category: "billing",
    createdAt: "2024-03-15T09:30:00.000Z",
  },
];

function ticketsResponse(data: typeof tickets, total = data.length) {
  return { data, total, page: 1, pageSize: 10 };
}

beforeEach(() => {
  mockedGet.mockReset();
  mockedIsAxiosError.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

it("shows skeleton placeholder rows while the request is in flight", async () => {
  mockedGet.mockReturnValue(new Promise(() => {}));

  renderTicketsPage();

  await screen.findByRole("heading", { name: "Tickets" });
  const rows = screen.getAllByRole("row").slice(1); // drop header row
  expect(rows).toHaveLength(5);
  rows.forEach((row) => {
    expect(row.querySelectorAll(".skeleton").length).toBeGreaterThan(0);
  });
  expect(screen.queryByText("Billing question")).not.toBeInTheDocument();
});

it("renders the fetched tickets once loading finishes and the minimum skeleton time has elapsed", async () => {
  vi.useFakeTimers();
  mockedGet.mockResolvedValue({ data: ticketsResponse(tickets) });

  renderTicketsPage();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });

  expect(screen.getByText("Can't reset my password")).toBeInTheDocument();
  expect(screen.getByText("Bob Smith <bob@example.com>")).toBeInTheDocument();
  expect(screen.getByText("—")).toBeInTheDocument();
  expect(screen.getByRole("cell", { name: "billing" })).toBeInTheDocument();
  expect(
    screen.getByText(new Date(tickets[0].createdAt).toLocaleString()),
  ).toBeInTheDocument();

  expect(screen.getByText("Billing question")).toBeInTheDocument();
  expect(document.querySelectorAll(".skeleton")).toHaveLength(0);
});

it("shows the server-provided error message when the request fails with an axios error", async () => {
  mockedIsAxiosError.mockReturnValue(true);
  mockedGet.mockRejectedValue({
    response: { data: { error: "You are not authorized to view tickets" } },
  });

  renderTicketsPage();

  expect(
    await screen.findByText("You are not authorized to view tickets"),
  ).toBeInTheDocument();
});

it("falls back to the generic error message when the failure isn't an axios error", async () => {
  mockedIsAxiosError.mockReturnValue(false);
  mockedGet.mockRejectedValue(new Error("Network down"));

  renderTicketsPage();

  expect(await screen.findByText("Network down")).toBeInTheDocument();
});

it("fetches tickets sorted by createdAt desc, page 1, by default", async () => {
  vi.useFakeTimers();
  mockedGet.mockResolvedValue({ data: ticketsResponse(tickets) });

  renderTicketsPage();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });

  expect(mockedGet).toHaveBeenCalledWith("/api/tickets", {
    params: { sortBy: "createdAt", sortOrder: "desc", page: 1, pageSize: 10 },
  });
});

it("re-fetches with the clicked column's sort params when a sortable header is clicked", async () => {
  vi.useFakeTimers();
  mockedGet.mockResolvedValue({ data: ticketsResponse(tickets) });

  renderTicketsPage();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });

  vi.useRealTimers();
  mockedGet.mockClear();

  const user = userEvent.setup();
  await user.click(screen.getByText("Subject"));

  expect(mockedGet).toHaveBeenCalledWith("/api/tickets", {
    params: { sortBy: "subject", sortOrder: "asc", page: 1, pageSize: 10 },
  });
});

it("does not attach a sort handler to the non-sortable Requester column", async () => {
  mockedGet.mockResolvedValue({ data: ticketsResponse(tickets) });

  renderTicketsPage();

  const requesterHeader = await screen.findByText("Requester");
  expect(requesterHeader.className).not.toContain("sortable");
});

it("re-fetches with the selected status filter", async () => {
  vi.useFakeTimers();
  mockedGet.mockResolvedValue({ data: ticketsResponse(tickets) });

  renderTicketsPage();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });

  vi.useRealTimers();
  mockedGet.mockClear();

  const user = userEvent.setup();
  await user.selectOptions(screen.getByLabelText("Filter by status"), "pending");

  await waitFor(() =>
    expect(mockedGet).toHaveBeenCalledWith("/api/tickets", {
      params: { sortBy: "createdAt", sortOrder: "desc", status: "pending", page: 1, pageSize: 10 },
    }),
  );
});

it("re-fetches with 'none' when the None category option is selected", async () => {
  vi.useFakeTimers();
  mockedGet.mockResolvedValue({ data: ticketsResponse(tickets) });

  renderTicketsPage();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });

  vi.useRealTimers();
  mockedGet.mockClear();

  const user = userEvent.setup();
  await user.selectOptions(screen.getByLabelText("Filter by category"), "none");

  await waitFor(() =>
    expect(mockedGet).toHaveBeenCalledWith("/api/tickets", {
      params: { sortBy: "createdAt", sortOrder: "desc", category: "none", page: 1, pageSize: 10 },
    }),
  );
});

it("re-fetches with the subject search text after the debounce delay", async () => {
  vi.useFakeTimers();
  mockedGet.mockResolvedValue({ data: ticketsResponse(tickets) });

  renderTicketsPage();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });

  vi.useRealTimers();
  mockedGet.mockClear();

  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Search subject"), "billing");

  await waitFor(() =>
    expect(mockedGet).toHaveBeenCalledWith("/api/tickets", {
      params: { sortBy: "createdAt", sortOrder: "desc", subject: "billing", page: 1, pageSize: 10 },
    }),
  );
});

it("re-fetches with the requester search text after the debounce delay", async () => {
  vi.useFakeTimers();
  mockedGet.mockResolvedValue({ data: ticketsResponse(tickets) });

  renderTicketsPage();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });

  vi.useRealTimers();
  mockedGet.mockClear();

  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Search requester"), "ada");

  await waitFor(() =>
    expect(mockedGet).toHaveBeenCalledWith("/api/tickets", {
      params: { sortBy: "createdAt", sortOrder: "desc", requester: "ada", page: 1, pageSize: 10 },
    }),
  );
});

it("shows the page count and disables Next when there's only one page", async () => {
  vi.useFakeTimers();
  mockedGet.mockResolvedValue({ data: ticketsResponse(tickets) });

  renderTicketsPage();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });

  expect(screen.getByText("Page 1 of 1 (2 total)")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
});

it("fetches the next page when Next is clicked and there are more pages", async () => {
  vi.useFakeTimers();
  mockedGet.mockResolvedValue({ data: ticketsResponse(tickets, 25) });

  renderTicketsPage();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });

  expect(screen.getByText("Page 1 of 3 (25 total)")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();

  vi.useRealTimers();
  mockedGet.mockClear();

  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Next" }));

  expect(mockedGet).toHaveBeenCalledWith("/api/tickets", {
    params: { sortBy: "createdAt", sortOrder: "desc", page: 2, pageSize: 10 },
  });
});

it("resets back to page 1 when a filter changes after navigating forward", async () => {
  vi.useFakeTimers();
  mockedGet.mockResolvedValue({ data: ticketsResponse(tickets, 25) });

  renderTicketsPage();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });

  vi.useRealTimers();

  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Next" }));
  await waitFor(() => expect(screen.getByText("Page 2 of 3 (25 total)")).toBeInTheDocument());

  mockedGet.mockClear();
  await user.selectOptions(screen.getByLabelText("Filter by status"), "pending");

  await waitFor(() =>
    expect(mockedGet).toHaveBeenCalledWith("/api/tickets", {
      params: { sortBy: "createdAt", sortOrder: "desc", status: "pending", page: 1, pageSize: 10 },
    }),
  );
});
