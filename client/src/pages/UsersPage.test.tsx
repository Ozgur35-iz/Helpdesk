import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import { UsersPage } from "./UsersPage";
import { renderWithQuery } from "../test/renderWithQuery";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    isAxiosError: vi.fn(),
  },
}));

const mockedGet = vi.mocked(axios.get);
const mockedPost = vi.mocked(axios.post);
const mockedPatch = vi.mocked(axios.patch);
const mockedDelete = vi.mocked(axios.delete);
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
  mockedPatch.mockReset();
  mockedDelete.mockReset();
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
  await user.type(screen.getByLabelText("Password"), "hunter2secret");
  await user.click(screen.getByRole("button", { name: "Create" }));

  expect(await screen.findByText("Grace Hopper")).toBeInTheDocument();
  expect(mockedPost).toHaveBeenCalledWith("/api/users", {
    name: newUser.name,
    email: newUser.email,
    password: "hunter2secret",
  });
  expect(screen.queryByRole("heading", { name: "Create User" })).not.toBeInTheDocument();
});

it("gives each row's Edit button a distinct accessible name", async () => {
  vi.useFakeTimers();
  mockedGet.mockResolvedValue({ data: users });

  renderUsersPage();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });
  vi.useRealTimers();

  expect(screen.getByRole("button", { name: "Edit Ada Lovelace" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Edit Alan Turing" })).toBeInTheDocument();
});

it("opens the edit modal pre-filled with the row's data and updates the list on save", async () => {
  vi.useFakeTimers();
  mockedGet.mockResolvedValueOnce({ data: users });

  renderUsersPage();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });
  vi.useRealTimers();

  const editor = userEvent.setup();
  await editor.click(screen.getByRole("button", { name: "Edit Ada Lovelace" }));

  expect(await screen.findByRole("heading", { name: "Edit User" })).toBeInTheDocument();
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByLabelText("Name")).toHaveValue("Ada Lovelace");
  expect(within(dialog).getByLabelText("Email")).toHaveValue("ada@example.com");

  const updatedUser = { ...users[0], name: "Ada King" };
  mockedPatch.mockResolvedValue({ data: updatedUser });
  mockedGet.mockResolvedValueOnce({ data: [updatedUser, users[1]] });

  await editor.clear(within(dialog).getByLabelText("Name"));
  await editor.type(within(dialog).getByLabelText("Name"), "Ada King");
  await editor.click(within(dialog).getByRole("button", { name: "Save" }));

  expect(await screen.findByText("Ada King")).toBeInTheDocument();
  expect(mockedPatch).toHaveBeenCalledWith("/api/users/1", {
    name: "Ada King",
    email: "ada@example.com",
    password: "",
  });
  expect(screen.queryByRole("heading", { name: "Edit User" })).not.toBeInTheDocument();
});

it("gives each row's Delete button a distinct accessible name", async () => {
  vi.useFakeTimers();
  mockedGet.mockResolvedValue({ data: users });

  renderUsersPage();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });
  vi.useRealTimers();

  expect(screen.getByRole("button", { name: "Delete Ada Lovelace" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Delete Alan Turing" })).toBeInTheDocument();
});

it("disables the Delete button for admin rows and enables it for agent rows", async () => {
  vi.useFakeTimers();
  mockedGet.mockResolvedValue({ data: users });

  renderUsersPage();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });
  vi.useRealTimers();

  expect(screen.getByRole("button", { name: "Delete Ada Lovelace" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Delete Alan Turing" })).toBeEnabled();
});

it("deletes a user via the confirmation modal and refreshes the list", async () => {
  vi.useFakeTimers();
  mockedGet.mockResolvedValueOnce({ data: users });

  renderUsersPage();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });
  vi.useRealTimers();

  const editor = userEvent.setup();
  await editor.click(screen.getByRole("button", { name: "Delete Alan Turing" }));

  expect(await screen.findByRole("heading", { name: "Delete User" })).toBeInTheDocument();

  mockedDelete.mockResolvedValue({ data: { id: "2" } });
  mockedGet.mockResolvedValueOnce({ data: [users[0]] });

  const dialog = screen.getByRole("dialog");
  await editor.click(within(dialog).getByRole("button", { name: "Delete" }));

  expect(mockedDelete).toHaveBeenCalledWith("/api/users/2");
  await screen.findByText("Ada Lovelace");
  expect(screen.queryByText("Alan Turing")).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Delete User" })).not.toBeInTheDocument();
});
