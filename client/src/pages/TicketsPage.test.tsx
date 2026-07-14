import { act, screen } from "@testing-library/react";
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
  mockedGet.mockResolvedValue({ data: tickets });

  renderTicketsPage();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });

  expect(screen.getByText("Can't reset my password")).toBeInTheDocument();
  expect(screen.getByText("Bob Smith <bob@example.com>")).toBeInTheDocument();
  expect(screen.getByText("—")).toBeInTheDocument();
  expect(screen.getByText("billing")).toBeInTheDocument();
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
