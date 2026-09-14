import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import { EditUserModal } from "./EditUserModal";
import { renderWithQuery } from "../test/renderWithQuery";

vi.mock("axios", () => ({
  default: {
    patch: vi.fn(),
    isAxiosError: vi.fn(),
  },
}));

const mockedPatch = vi.mocked(axios.patch);
const mockedIsAxiosError = vi.mocked(axios.isAxiosError);

const user = { id: "1", name: "Ada Lovelace", email: "ada@example.com" };

function renderModal(onClose = vi.fn()) {
  renderWithQuery(<EditUserModal user={user} onClose={onClose} />);
  return { onClose };
}

beforeEach(() => {
  mockedPatch.mockReset();
  mockedIsAxiosError.mockReset();
});

it("pre-fills name and email, leaving password blank", () => {
  renderModal();

  expect(screen.getByRole("heading", { name: "Edit User" })).toBeInTheDocument();
  expect(screen.getByLabelText("Name")).toHaveValue("Ada Lovelace");
  expect(screen.getByLabelText("Email")).toHaveValue("ada@example.com");
  expect(screen.getByLabelText("Password")).toHaveValue("");
});

it("shows validation errors and does not submit when fields are invalid", async () => {
  const editor = userEvent.setup();
  renderModal();

  await editor.clear(screen.getByLabelText("Email"));
  await editor.type(screen.getByLabelText("Email"), "not-an-email");
  await editor.type(screen.getByLabelText("Password"), "1234");
  await editor.click(screen.getByRole("button", { name: "Save" }));

  expect(await screen.findByText("Enter a valid email")).toBeInTheDocument();
  expect(screen.getByText("Password must be at least 12 characters")).toBeInTheDocument();
  expect(mockedPatch).not.toHaveBeenCalled();
});

it("submits with an empty password when left untouched", async () => {
  mockedPatch.mockResolvedValue({
    data: { id: "1", name: "Ada Lovelace", email: "ada@example.com", role: "admin", createdAt: "2024-01-01T00:00:00.000Z" },
  });
  const editor = userEvent.setup();
  const { onClose } = renderModal();

  await editor.click(screen.getByRole("button", { name: "Save" }));

  expect(mockedPatch).toHaveBeenCalledWith("/api/users/1", {
    name: "Ada Lovelace",
    email: "ada@example.com",
    password: "",
  });
  await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
});

it("submits a new password when provided", async () => {
  mockedPatch.mockResolvedValue({
    data: { id: "1", name: "Ada Lovelace", email: "ada@example.com", role: "admin", createdAt: "2024-01-01T00:00:00.000Z" },
  });
  const editor = userEvent.setup();
  renderModal();

  await editor.type(screen.getByLabelText("Password"), "newpass123456");
  await editor.click(screen.getByRole("button", { name: "Save" }));

  expect(mockedPatch).toHaveBeenCalledWith("/api/users/1", {
    name: "Ada Lovelace",
    email: "ada@example.com",
    password: "newpass123456",
  });
});

it("shows the server error and keeps the modal open when the email is already taken", async () => {
  mockedIsAxiosError.mockReturnValue(true);
  mockedPatch.mockRejectedValue({
    response: { data: { error: "A user with this email already exists" } },
  });
  const editor = userEvent.setup();
  const { onClose } = renderModal();

  await editor.click(screen.getByRole("button", { name: "Save" }));

  expect(await screen.findByText("A user with this email already exists")).toBeInTheDocument();
  expect(onClose).not.toHaveBeenCalled();
});
