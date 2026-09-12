import { act, screen } from "@testing-library/react";
import axios from "axios";
import { DashboardPage } from "./DashboardPage";
import { renderWithQuery } from "../test/renderWithQuery";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    isAxiosError: vi.fn(),
  },
}));

vi.mock("../lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: { user: { name: "Ada Lovelace", role: "agent" } } }),
  },
}));

const mockedGet = vi.mocked(axios.get);
const mockedIsAxiosError = vi.mocked(axios.isAxiosError);

const ticketsPerDay = Array.from({ length: 30 }, (_, i) => ({
  date: `2026-08-${String(i + 1).padStart(2, "0")}`,
  count: i % 7,
  resolved: i % 5,
}));

const metrics = {
  totalTickets: 128,
  openTickets: 42,
  aiResolvedTickets: 30,
  aiResolvedPercent: 23.4375,
  avgResolutionSeconds: 8100, // 135 min -> "2h 15m"
  ticketsPerDay,
};

beforeEach(() => {
  mockedGet.mockReset();
  mockedIsAxiosError.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

it("shows skeleton stat tiles and a chart skeleton while the request is in flight", async () => {
  mockedGet.mockReturnValue(new Promise(() => {}));

  renderWithQuery(<DashboardPage />);

  await screen.findByRole("heading", { name: /welcome, ada lovelace/i });
  const cards = document.querySelectorAll(".stat-card");
  expect(cards).toHaveLength(5);
  cards.forEach((card) => {
    expect(card.querySelectorAll(".skeleton").length).toBeGreaterThan(0);
  });
  expect(document.querySelector(".chart-skeleton")).toBeInTheDocument();
  expect(document.querySelectorAll(".chart-bar")).toHaveLength(0);
  expect(screen.queryByText("128")).not.toBeInTheDocument();
});

it("renders the five metrics once loading finishes and the minimum skeleton time has elapsed", async () => {
  vi.useFakeTimers();
  mockedGet.mockResolvedValue({ data: metrics });

  renderWithQuery(<DashboardPage />);

  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });

  expect(mockedGet).toHaveBeenCalledWith("/api/metrics");
  expect(screen.getByText("128")).toBeInTheDocument();
  expect(screen.getByText("42")).toBeInTheDocument();
  expect(screen.getByText("30")).toBeInTheDocument();
  expect(screen.getByText("23.4%")).toBeInTheDocument();
  expect(screen.getByText("2h 15m")).toBeInTheDocument();
  expect(document.querySelectorAll(".skeleton")).toHaveLength(0);
});

it("renders one bar per day for the last 30 days with a created/resolved tooltip", async () => {
  vi.useFakeTimers();
  mockedGet.mockResolvedValue({ data: metrics });

  renderWithQuery(<DashboardPage />);

  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });

  expect(screen.getByRole("heading", { name: /tickets per day/i })).toBeInTheDocument();
  const bars = document.querySelectorAll(".chart-bar");
  expect(bars).toHaveLength(30);
  expect(bars[6]).toHaveAttribute("title", "2026-08-07: 6 tickets created, 1 resolved");
  expect(bars[1]).toHaveAttribute("title", "2026-08-02: 1 ticket created, 1 resolved");
  // axis labels: first and last day
  expect(screen.getByText("2026-08-01")).toBeInTheDocument();
  expect(screen.getByText("2026-08-30")).toBeInTheDocument();
});

it("shows an em dash for average resolution time when no tickets have been resolved yet", async () => {
  vi.useFakeTimers();
  mockedGet.mockResolvedValue({
    data: { ...metrics, avgResolutionSeconds: null },
  });

  renderWithQuery(<DashboardPage />);

  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });

  expect(screen.getByText("Avg resolution time").parentElement).toHaveTextContent("—");
});

it("shows the server-provided error message when the request fails with an axios error", async () => {
  mockedIsAxiosError.mockReturnValue(true);
  mockedGet.mockRejectedValue({
    response: { data: { error: "You are not authorized to view metrics" } },
  });

  renderWithQuery(<DashboardPage />);

  expect(
    await screen.findByText("You are not authorized to view metrics"),
  ).toBeInTheDocument();
  expect(document.querySelector(".dashboard-grid")).not.toBeInTheDocument();
  expect(document.querySelector(".dashboard-chart")).not.toBeInTheDocument();
});

it("falls back to the generic error message when the failure isn't an axios error", async () => {
  mockedIsAxiosError.mockReturnValue(false);
  mockedGet.mockRejectedValue(new Error("Network down"));

  renderWithQuery(<DashboardPage />);

  expect(await screen.findByText("Network down")).toBeInTheDocument();
});
