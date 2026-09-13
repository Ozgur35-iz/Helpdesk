import { useState } from "react";
import axios from "axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog } from "@ark-ui/react/dialog";

type DeleteUserModalProps = {
  user: { id: string; name: string };
  onClose: () => void;
};

export function DeleteUserModal({ user, onClose }: DeleteUserModalProps) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => axios.delete(`/api/users/${user.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      onClose();
    },
    onError: (err) => {
      setServerError(
        axios.isAxiosError(err) ? (err.response?.data?.error ?? "Failed to delete user") : err.message,
      );
    },
  });

  return (
    <Dialog.Root
      open={true}
      onOpenChange={(d) => {
        if (!d.open) onClose();
      }}
    >
      <Dialog.Backdrop className="modal-backdrop" />
      <Dialog.Positioner className="modal-positioner">
        <Dialog.Content className="modal-content">
          <Dialog.Title>Delete User</Dialog.Title>
          <Dialog.Description>
            Are you sure you want to delete {user.name}? This cannot be undone.
          </Dialog.Description>
          {serverError && (
            <p className="auth-error" role="alert">
              {serverError}
            </p>
          )}
          <div className="modal-actions">
            <button type="button" onClick={onClose} disabled={mutation.isPending}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-danger"
              onClick={() => {
                setServerError(null);
                mutation.mutate();
              }}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "Deleting..." : "Delete"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
