import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import { UsersPage } from "./UsersPage";
import { renderWithQuery } from "../test/renderWithQuery";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    isAxiosError: vi.fn(),
  },
}));

const mockedGet = vi.mocked(axios.get);
const mockedPost = vi.mocked(axios.post);
const mockedIsAxiosError = vi.mocked(axios.isAxiosError);

function renderUsersPage() {
  return renderWithQuery(<UsersPage />);
}

const users = [
  {
    id: "1",
    name: "Ada Lovelace",
    email: "ada@example.com",
    role: "admin",
    createdAt: "2024-03-15T00:00:00.000Z",
  },
  {
    id: "2",
    name: "Alan Turing",
    email: "alan@example.com",
    role: "agent",
    createdAt: "2024-06-01T00:00:00.000Z",
  },
];

beforeEach(() => {
  mockedGet.mockReset();
  mockedPost.mockReset();
  mockedIsAxiosError.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

it("shows skeleton placeholder rows while the request is in flight", async () => {
  mockedGet.mockReturnValue(new Promise(() => {}));

  renderUsersPage();

  await screen.findByRole("heading", { name: "Users" });
  const rows = screen.getAllByRole("row").slice(1); // drop header row
  expect(rows).toHaveLength(5);
  rows.forEach((row) => {
    expect(row.querySelectorAll(".skeleton").length).toBeGreaterThan(0);
  });
  expect(screen.queryByText("Ada Lovelace")).not.toBeInTheDocument();
});

it("renders the fetched users once loading finishes and the minimum skeleton time has elapsed", async () => {
  vi.useFakeTimers();
  mockedGet.mockResolvedValue({ data: users });

  renderUsersPage();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });

  expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
  expect(screen.getByText("ada@example.com")).toBeInTheDocument();
  expect(screen.getByText("admin")).toBeInTheDocument();
  expect(
    screen.getByText(new Date(users[0].createdAt).toLocaleDateString()),
  ).toBeInTheDocument();

  expect(screen.getByText("Alan Turing")).toBeInTheDocument();
  expect(document.querySelectorAll(".skeleton")).toHaveLength(0);
});

it("shows the server-provided error message when the request fails with an axios error", async () => {
  mockedIsAxiosError.mockReturnValue(true);
  mockedGet.mockRejectedValue({
    response: { data: { error: "You are not authorized to view users" } },
  });

  renderUsersPage();

  expect(
    await screen.findByText("You are not authorized to view users"),
  ).toBeInTheDocument();
});

it("falls back to the generic error message when the failure isn't an axios error", async () => {
  mockedIsAxiosError.mockReturnValue(false);
  mockedGet.mockRejectedValue(new Error("Network down"));

  renderUsersPage();

  expect(await screen.findByText("Network down")).toBeInTheDocument();
});

it("opens the create user modal when the Create User button is clicked", async () => {
  vi.useFakeTimers();
  mockedGet.mockResolvedValue({ data: users });

  renderUsersPage();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });
  vi.useRealTimers();

  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Create User" }));

  expect(await screen.findByRole("heading", { name: "Create User" })).toBeInTheDocument();
  expect(screen.getByLabelText("Name")).toBeInTheDocument();
});

it("creates a user via the modal and refreshes the list", async () => {
  vi.useFakeTimers();
  mockedGet.mockResolvedValueOnce({ data: users });

  renderUsersPage();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });
  vi.useRealTimers();

  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Create User" }));

  const newUser = {
    id: "3",
    name: "Grace Hopper",
    email: "grace@example.com",
    role: "agent",
    createdAt: "2024-07-01T00:00:00.000Z",
  };
  mockedPost.mockResolvedValue({ data: newUser });
  mockedGet.mockResolvedValueOnce({ data: [...users, newUser] });

  await user.type(await screen.findByLabelText("Name"), newUser.name);
  await user.type(screen.getByLabelText("Email"), newUser.email);
  await user.type(screen.getByLabelText("Password"), "hunter2");
  await user.click(screen.getByRole("button", { name: "Create" }));

  expect(await screen.findByText("Grace Hopper")).toBeInTheDocument();
  expect(mockedPost).toHaveBeenCalledWith("/api/users", {
    name: newUser.name,
    email: newUser.email,
    password: "hunter2",
  });
  expect(screen.queryByRole("heading", { name: "Create User" })).not.toBeInTheDocument();
});
