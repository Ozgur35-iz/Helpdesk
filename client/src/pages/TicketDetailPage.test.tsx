import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import { TicketDetailPage } from "./TicketDetailPage";
import { renderWithQuery } from "../test/renderWithQuery";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    patch: vi.fn(),
    isAxiosError: vi.fn(),
  },
}));

const mockedGet = vi.mocked(axios.get);
const mockedPatch = vi.mocked(axios.patch);
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
  assignee: null,
  createdAt: "2024-03-15T09:30:00.000Z",
  updatedAt: "2024-03-16T10:00:00.000Z",
};

const agents = [{ id: "agent-1", name: "Grace Hopper", email: "grace@example.com" }];

function mockTicketGet(handler: (url: string) => Promise<{ data: unknown }>) {
  mockedGet.mockImplementation((url: string) =>
    url === "/api/users/agents" ? Promise.resolve({ data: agents }) : handler(url),
  );
}

beforeEach(() => {
  mockedGet.mockReset();
  mockedPatch.mockReset();
  mockedIsAxiosError.mockReset();
});

it("shows a loading state while the request is in flight", async () => {
  mockTicketGet(() => new Promise(() => {}));

  renderTicketDetailPage();

  expect(await screen.findByText("Loading...")).toBeInTheDocument();
});

it("renders the fetched ticket's fields", async () => {
  mockTicketGet(() => Promise.resolve({ data: ticket }));

  renderTicketDetailPage();

  expect(await screen.findByRole("heading", { name: "Billing question" })).toBeInTheDocument();
  expect(mockedGet).toHaveBeenCalledWith("/api/tickets/1");
  expect(screen.getByText("open")).toBeInTheDocument();
  expect(screen.getByText("billing")).toBeInTheDocument();
  expect(screen.getByText("Ada Lovelace <ada@example.com>")).toBeInTheDocument();
  expect(screen.getByLabelText("Assignee")).toHaveValue("");
  expect(await screen.findByRole("option", { name: "Grace Hopper" })).toBeInTheDocument();
  expect(screen.getByText(new Date(ticket.createdAt).toLocaleString())).toBeInTheDocument();
  expect(screen.getByText(new Date(ticket.updatedAt).toLocaleString())).toBeInTheDocument();
  expect(screen.getByText(ticket.body)).toBeInTheDocument();
  expect(screen.getByText("← Back to tickets")).toBeInTheDocument();
});

it("shows the '—' placeholder when the ticket has no category", async () => {
  mockTicketGet(() => Promise.resolve({ data: { ...ticket, category: null } }));

  renderTicketDetailPage();

  expect(await screen.findByText("—")).toBeInTheDocument();
});

it("shows the server-provided error message when the request fails with an axios error", async () => {
  mockedIsAxiosError.mockReturnValue(true);
  mockTicketGet(() => Promise.reject({ response: { data: { error: "Ticket not found" } } }));

  renderTicketDetailPage();

  expect(await screen.findByText("Ticket not found")).toBeInTheDocument();
});

it("falls back to the generic error message when the failure isn't an axios error", async () => {
  mockedIsAxiosError.mockReturnValue(false);
  mockTicketGet(() => Promise.reject(new Error("Network down")));

  renderTicketDetailPage();

  expect(await screen.findByText("Network down")).toBeInTheDocument();
});

it("assigns the ticket to the selected agent", async () => {
  mockTicketGet(() => Promise.resolve({ data: ticket }));
  mockedPatch.mockResolvedValue({ data: { ...ticket, assignee: agents[0] } });
  const editor = userEvent.setup();

  renderTicketDetailPage();

  await screen.findByRole("heading", { name: "Billing question" });
  await editor.selectOptions(screen.getByLabelText("Assignee"), "agent-1");

  expect(mockedPatch).toHaveBeenCalledWith("/api/tickets/1/assign", { assigneeId: "agent-1" });
});

it("shows the assign error message when assignment fails", async () => {
  mockTicketGet(() => Promise.resolve({ data: ticket }));
  mockedIsAxiosError.mockReturnValue(true);
  mockedPatch.mockRejectedValue({ response: { data: { error: "Assignee not found" } } });
  const editor = userEvent.setup();

  renderTicketDetailPage();

  await screen.findByRole("heading", { name: "Billing question" });
  await editor.selectOptions(screen.getByLabelText("Assignee"), "agent-1");

  expect(await screen.findByText("Assignee not found")).toBeInTheDocument();
});
