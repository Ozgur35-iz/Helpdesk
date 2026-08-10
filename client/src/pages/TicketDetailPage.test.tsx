import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import { TicketDetailPage } from "./TicketDetailPage";
import { renderWithQuery } from "../test/renderWithQuery";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
    isAxiosError: vi.fn(),
  },
}));

const mockedGet = vi.mocked(axios.get);
const mockedPatch = vi.mocked(axios.patch);
const mockedPost = vi.mocked(axios.post);
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

const replies = [
  {
    id: 1,
    body: "Thanks for reaching out, looking into this now.",
    author: { id: "agent-1", name: "Grace Hopper", email: "grace@example.com" },
    createdAt: "2024-03-15T10:00:00.000Z",
  },
];

function mockTicketGet(handler: (url: string) => Promise<{ data: unknown }>) {
  mockedGet.mockImplementation((url: string) => {
    if (url === "/api/users/agents") return Promise.resolve({ data: agents });
    if (url === "/api/tickets/1/replies") return Promise.resolve({ data: [] });
    return handler(url);
  });
}

beforeEach(() => {
  mockedGet.mockReset();
  mockedPatch.mockReset();
  mockedPost.mockReset();
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
  expect(screen.getByLabelText("Status")).toHaveValue("open");
  expect(screen.getByLabelText("Category")).toHaveValue("billing");
  expect(screen.getByText("Ada Lovelace <ada@example.com>")).toBeInTheDocument();
  expect(screen.getByLabelText("Assignee")).toHaveValue("");
  expect(await screen.findByRole("option", { name: "Grace Hopper" })).toBeInTheDocument();
  expect(screen.getByText(new Date(ticket.createdAt).toLocaleString())).toBeInTheDocument();
  expect(screen.getByText(new Date(ticket.updatedAt).toLocaleString())).toBeInTheDocument();
  expect(screen.getByText(ticket.body)).toBeInTheDocument();
  expect(screen.getByText("← Back to tickets")).toBeInTheDocument();
});

it("shows the 'None' option when the ticket has no category", async () => {
  mockTicketGet(() => Promise.resolve({ data: { ...ticket, category: null } }));

  renderTicketDetailPage();

  await screen.findByRole("heading", { name: "Billing question" });
  expect(screen.getByLabelText("Category")).toHaveValue("");
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

it("updates the ticket status", async () => {
  mockTicketGet(() => Promise.resolve({ data: ticket }));
  mockedPatch.mockResolvedValue({ data: { ...ticket, status: "resolved" } });
  const editor = userEvent.setup();

  renderTicketDetailPage();

  await screen.findByRole("heading", { name: "Billing question" });
  await editor.selectOptions(screen.getByLabelText("Status"), "resolved");

  expect(mockedPatch).toHaveBeenCalledWith("/api/tickets/1/status", { status: "resolved" });
});

it("shows the status error message when the status update fails", async () => {
  mockTicketGet(() => Promise.resolve({ data: ticket }));
  mockedIsAxiosError.mockReturnValue(true);
  mockedPatch.mockRejectedValue({ response: { data: { error: "Invalid status" } } });
  const editor = userEvent.setup();

  renderTicketDetailPage();

  await screen.findByRole("heading", { name: "Billing question" });
  await editor.selectOptions(screen.getByLabelText("Status"), "resolved");

  expect(await screen.findByText("Invalid status")).toBeInTheDocument();
});

it("updates the ticket category", async () => {
  mockTicketGet(() => Promise.resolve({ data: ticket }));
  mockedPatch.mockResolvedValue({ data: { ...ticket, category: "refund" } });
  const editor = userEvent.setup();

  renderTicketDetailPage();

  await screen.findByRole("heading", { name: "Billing question" });
  await editor.selectOptions(screen.getByLabelText("Category"), "refund");

  expect(mockedPatch).toHaveBeenCalledWith("/api/tickets/1/category", { category: "refund" });
});

it("clears the ticket category when 'None' is selected", async () => {
  mockTicketGet(() => Promise.resolve({ data: ticket }));
  mockedPatch.mockResolvedValue({ data: { ...ticket, category: null } });
  const editor = userEvent.setup();

  renderTicketDetailPage();

  await screen.findByRole("heading", { name: "Billing question" });
  await editor.selectOptions(screen.getByLabelText("Category"), "None");

  expect(mockedPatch).toHaveBeenCalledWith("/api/tickets/1/category", { category: null });
});

it("renders the list of existing replies", async () => {
  mockedGet.mockImplementation((url: string) => {
    if (url === "/api/users/agents") return Promise.resolve({ data: agents });
    if (url === "/api/tickets/1/replies") return Promise.resolve({ data: replies });
    return Promise.resolve({ data: ticket });
  });

  renderTicketDetailPage();

  await screen.findByRole("heading", { name: "Billing question" });
  expect(await screen.findByText(replies[0].body)).toBeInTheDocument();
  expect(screen.getByText(/Grace Hopper/, { selector: ".ticket-reply-meta" })).toBeInTheDocument();
});

it("submits a new reply", async () => {
  mockTicketGet(() => Promise.resolve({ data: ticket }));
  mockedPost.mockResolvedValue({ data: { ...replies[0], id: 2 } });
  const editor = userEvent.setup();

  renderTicketDetailPage();

  await screen.findByRole("heading", { name: "Billing question" });
  await editor.type(screen.getByLabelText("Add a reply"), "On it, will update shortly.");
  await editor.click(screen.getByRole("button", { name: "Post reply" }));

  expect(mockedPost).toHaveBeenCalledWith("/api/tickets/1/replies", {
    body: "On it, will update shortly.",
  });
  expect(await screen.findByLabelText("Add a reply")).toHaveValue("");
});

it("shows a validation error when submitting an empty reply", async () => {
  mockTicketGet(() => Promise.resolve({ data: ticket }));
  const editor = userEvent.setup();

  renderTicketDetailPage();

  await screen.findByRole("heading", { name: "Billing question" });
  await editor.click(screen.getByRole("button", { name: "Post reply" }));

  expect(await screen.findByText("Reply cannot be empty")).toBeInTheDocument();
  expect(mockedPost).not.toHaveBeenCalled();
});

it("shows the reply error message when posting fails", async () => {
  mockTicketGet(() => Promise.resolve({ data: ticket }));
  mockedIsAxiosError.mockReturnValue(true);
  mockedPost.mockRejectedValue({ response: { data: { error: "Failed to post reply" } } });
  const editor = userEvent.setup();

  renderTicketDetailPage();

  await screen.findByRole("heading", { name: "Billing question" });
  await editor.type(screen.getByLabelText("Add a reply"), "On it, will update shortly.");
  await editor.click(screen.getByRole("button", { name: "Post reply" }));

  expect(await screen.findByText("Failed to post reply")).toBeInTheDocument();
});

it("summarizes the ticket and displays the result", async () => {
  mockTicketGet(() => Promise.resolve({ data: ticket }));
  mockedPost.mockResolvedValue({ data: { text: "Customer was double-charged; refund is in progress." } });
  const editor = userEvent.setup();

  renderTicketDetailPage();

  await screen.findByRole("heading", { name: "Billing question" });
  await editor.click(screen.getByRole("button", { name: /Summarize/ }));

  expect(mockedPost).toHaveBeenCalledWith("/api/tickets/1/summarize");
  expect(await screen.findByText("Customer was double-charged; refund is in progress.")).toBeInTheDocument();
});

it("allows summarizing the ticket more than once", async () => {
  mockTicketGet(() => Promise.resolve({ data: ticket }));
  mockedPost
    .mockResolvedValueOnce({ data: { text: "First summary." } })
    .mockResolvedValueOnce({ data: { text: "Second summary." } });
  const editor = userEvent.setup();

  renderTicketDetailPage();

  await screen.findByRole("heading", { name: "Billing question" });
  const summarizeButton = screen.getByRole("button", { name: /Summarize/ });

  await editor.click(summarizeButton);
  expect(await screen.findByText("First summary.")).toBeInTheDocument();

  await editor.click(summarizeButton);
  expect(await screen.findByText("Second summary.")).toBeInTheDocument();
  expect(screen.queryByText("First summary.")).not.toBeInTheDocument();
  expect(mockedPost).toHaveBeenCalledTimes(2);
});

it("shows the summarize error message when summarizing fails", async () => {
  mockTicketGet(() => Promise.resolve({ data: ticket }));
  mockedIsAxiosError.mockReturnValue(true);
  mockedPost.mockRejectedValue({ response: { data: { error: "Failed to summarize ticket" } } });
  const editor = userEvent.setup();

  renderTicketDetailPage();

  await screen.findByRole("heading", { name: "Billing question" });
  await editor.click(screen.getByRole("button", { name: /Summarize/ }));

  expect(await screen.findByText("Failed to summarize ticket")).toBeInTheDocument();
});

it("shows the category error message when the category update fails", async () => {
  mockTicketGet(() => Promise.resolve({ data: ticket }));
  mockedIsAxiosError.mockReturnValue(true);
  mockedPatch.mockRejectedValue({ response: { data: { error: "Invalid category" } } });
  const editor = userEvent.setup();

  renderTicketDetailPage();

  await screen.findByRole("heading", { name: "Billing question" });
  await editor.selectOptions(screen.getByLabelText("Category"), "refund");

  expect(await screen.findByText("Invalid category")).toBeInTheDocument();
});
