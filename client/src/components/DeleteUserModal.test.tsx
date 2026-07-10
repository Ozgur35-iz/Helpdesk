import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import { DeleteUserModal } from "./DeleteUserModal";
import { renderWithQuery } from "../test/renderWithQuery";

vi.mock("axios", () => ({
  default: {
    delete: vi.fn(),
    isAxiosError: vi.fn(),
  },
}));

const mockedDelete = vi.mocked(axios.delete);
const mockedIsAxiosError = vi.mocked(axios.isAxiosError);

const user = { id: "2", name: "Alan Turing" };

function renderModal(onClose = vi.fn()) {
  renderWithQuery(<DeleteUserModal user={user} onClose={onClose} />);
  return { onClose };
}

beforeEach(() => {
  mockedDelete.mockReset();
  mockedIsAxiosError.mockReset();
});

it("shows a confirmation prompt naming the user", () => {
  renderModal();

  expect(screen.getByRole("heading", { name: "Delete User" })).toBeInTheDocument();
  expect(screen.getByText("Are you sure you want to delete Alan Turing? This cannot be undone.")).toBeInTheDocument();
});

it("calls the delete API and closes when confirmed", async () => {
  mockedDelete.mockResolvedValue({ data: { id: "2" } });
  const editor = userEvent.setup();
  const { onClose } = renderModal();

  await editor.click(screen.getByRole("button", { name: "Delete" }));

  expect(mockedDelete).toHaveBeenCalledWith("/api/users/2");
  await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
});

it("closes without calling the API when cancelled", async () => {
  const editor = userEvent.setup();
  const { onClose } = renderModal();

  await editor.click(screen.getByRole("button", { name: "Cancel" }));

  expect(mockedDelete).not.toHaveBeenCalled();
  expect(onClose).toHaveBeenCalled();
});

it("shows the server error and keeps the modal open when deletion fails", async () => {
  mockedIsAxiosError.mockReturnValue(true);
  mockedDelete.mockRejectedValue({
    response: { data: { error: "Admins cannot be deleted" } },
  });
  const editor = userEvent.setup();
  const { onClose } = renderModal();

  await editor.click(screen.getByRole("button", { name: "Delete" }));

  expect(await screen.findByText("Admins cannot be deleted")).toBeInTheDocument();
  expect(onClose).not.toHaveBeenCalled();
});
