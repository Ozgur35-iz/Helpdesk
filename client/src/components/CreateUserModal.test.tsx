import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import { CreateUserModal } from "./CreateUserModal";
import { renderWithQuery } from "../test/renderWithQuery";

vi.mock("axios", () => ({
  default: {
    post: vi.fn(),
    isAxiosError: vi.fn(),
  },
}));

const mockedPost = vi.mocked(axios.post);
const mockedIsAxiosError = vi.mocked(axios.isAxiosError);

function renderModal(open: boolean, onOpenChange = vi.fn()) {
  renderWithQuery(<CreateUserModal open={open} onOpenChange={onOpenChange} />);
  return { onOpenChange };
}

beforeEach(() => {
  mockedPost.mockReset();
  mockedIsAxiosError.mockReset();
});

it("does not show the dialog content when closed", () => {
  renderModal(false);

  expect(screen.queryByRole("heading", { name: "Create User" })).not.toBeInTheDocument();
});

it("renders all fields when open", () => {
  renderModal(true);

  expect(screen.getByRole("heading", { name: "Create User" })).toBeInTheDocument();
  expect(screen.getByLabelText("Name")).toBeInTheDocument();
  expect(screen.getByLabelText("Email")).toBeInTheDocument();
  expect(screen.getByLabelText("Password")).toBeInTheDocument();
});

it("shows validation errors and does not submit when fields are invalid", async () => {
  const user = userEvent.setup();
  renderModal(true);

  await user.type(screen.getByLabelText("Email"), "not-an-email");
  await user.type(screen.getByLabelText("Password"), "1234");
  await user.click(screen.getByRole("button", { name: "Create" }));

  expect(await screen.findByText("Name is required")).toBeInTheDocument();
  expect(screen.getByText("Enter a valid email")).toBeInTheDocument();
  expect(screen.getByText("Password must be at least 12 characters")).toBeInTheDocument();
  expect(mockedPost).not.toHaveBeenCalled();
});

it("submits the form and closes the modal on success", async () => {
  mockedPost.mockResolvedValue({
    data: { id: "1", name: "Ada Lovelace", email: "ada@example.com", role: "agent", createdAt: "2024-01-01T00:00:00.000Z" },
  });
  const user = userEvent.setup();
  const { onOpenChange } = renderModal(true);

  await user.type(screen.getByLabelText("Name"), "Ada Lovelace");
  await user.type(screen.getByLabelText("Email"), "ada@example.com");
  await user.type(screen.getByLabelText("Password"), "hunter2secret");
  await user.click(screen.getByRole("button", { name: "Create" }));

  expect(mockedPost).toHaveBeenCalledWith("/api/users", {
    name: "Ada Lovelace",
    email: "ada@example.com",
    password: "hunter2secret",
  });
  await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
});

it("shows the server error and keeps the modal open when the email is already taken", async () => {
  mockedIsAxiosError.mockReturnValue(true);
  mockedPost.mockRejectedValue({
    response: { data: { error: "A user with this email already exists" } },
  });
  const user = userEvent.setup();
  const { onOpenChange } = renderModal(true);

  await user.type(screen.getByLabelText("Name"), "Ada Lovelace");
  await user.type(screen.getByLabelText("Email"), "ada@example.com");
  await user.type(screen.getByLabelText("Password"), "hunter2secret");
  await user.click(screen.getByRole("button", { name: "Create" }));

  expect(await screen.findByText("A user with this email already exists")).toBeInTheDocument();
  expect(onOpenChange).not.toHaveBeenCalledWith(false);
});
