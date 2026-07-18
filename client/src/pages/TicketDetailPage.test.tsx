import { screen } from "@testing-library/react";
import axios from "axios";
import { TicketDetailPage } from "./TicketDetailPage";
import { renderWithQuery } from "../test/renderWithQuery";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    isAxiosError: vi.fn(),
  },
}));

const mockedGet = vi.mocked(axios.get);
const mockedIsAxiosError = vi.mocked(axios.isAxiosError);

function renderTicketDetailPage() {
  return renderWithQuery(<TicketDetailPage />, { route: "/tickets/1", path: "/tickets/:id" });
}

const ticket = {
  id: 1,
  subject: "Billing question",
  body: "I was charged twice for my subscription this month.",
  requesterEmail: "ada@example.com",
  senderName: "Ada Lovelace",
  status: "open",
  category: "billing",
  createdAt: "2024-03-15T09:30:00.000Z",
  updatedAt: "2024-03-16T10:00:00.000Z",
};

beforeEach(() => {
  mockedGet.mockReset();
  mockedIsAxiosError.mockReset();
});

it("shows a loading state while the request is in flight", async () => {
  mockedGet.mockReturnValue(new Promise(() => {}));

  renderTicketDetailPage();

  expect(await screen.findByText("Loading...")).toBeInTheDocument();
});

it("renders the fetched ticket's fields", async () => {
  mockedGet.mockResolvedValue({ data: ticket });

  renderTicketDetailPage();

  expect(await screen.findByRole("heading", { name: "Billing question" })).toBeInTheDocument();
  expect(mockedGet).toHaveBeenCalledWith("/api/tickets/1");
  expect(screen.getByText("open")).toBeInTheDocument();
  expect(screen.getByText("billing")).toBeInTheDocument();
  expect(screen.getByText("Ada Lovelace <ada@example.com>")).toBeInTheDocument();
  expect(screen.getByText(new Date(ticket.createdAt).toLocaleString())).toBeInTheDocument();
  expect(screen.getByText(new Date(ticket.updatedAt).toLocaleString())).toBeInTheDocument();
  expect(screen.getByText(ticket.body)).toBeInTheDocument();
  expect(screen.getByText("← Back to tickets")).toBeInTheDocument();
});

it("shows the '—' placeholder when the ticket has no category", async () => {
  mockedGet.mockResolvedValue({ data: { ...ticket, category: null } });

  renderTicketDetailPage();

  expect(await screen.findByText("—")).toBeInTheDocument();
});

it("shows the server-provided error message when the request fails with an axios error", async () => {
  mockedIsAxiosError.mockReturnValue(true);
  mockedGet.mockRejectedValue({
    response: { data: { error: "Ticket not found" } },
  });

  renderTicketDetailPage();

  expect(await screen.findByText("Ticket not found")).toBeInTheDocument();
});

it("falls back to the generic error message when the failure isn't an axios error", async () => {
  mockedIsAxiosError.mockReturnValue(false);
  mockedGet.mockRejectedValue(new Error("Network down"));

  renderTicketDetailPage();

  expect(await screen.findByText("Network down")).toBeInTheDocument();
});
