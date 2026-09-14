import { useState } from "react";
import axios from "axios";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog } from "@ark-ui/react/dialog";
import { Field } from "@ark-ui/react/field";

const editUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.email("Enter a valid email"),
  password: z.union([z.literal(""), z.string().min(12, "Password must be at least 12 characters")]),
});

type EditUserFormValues = z.infer<typeof editUserSchema>;

type EditUserModalProps = {
  user: { id: string; name: string; email: string };
  onClose: () => void;
};

export function EditUserModal({ user, onClose }: EditUserModalProps) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserSchema),
    defaultValues: { name: user.name, email: user.email, password: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: EditUserFormValues) => axios.patch(`/api/users/${user.id}`, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      onClose();
    },
    onError: (err) => {
      setServerError(
        axios.isAxiosError(err) ? (err.response?.data?.error ?? "Failed to update user") : err.message,
      );
    },
  });

  const onSubmit = (values: EditUserFormValues) => {
    setServerError(null);
    mutation.mutate(values);
  };

  return (
    <Dialog.Root open={true} onOpenChange={(d) => { if (!d.open) onClose(); }}>
      <Dialog.Backdrop className="modal-backdrop" />
      <Dialog.Positioner className="modal-positioner">
        <Dialog.Content className="modal-content">
          <Dialog.Title>Edit User</Dialog.Title>
          <form onSubmit={handleSubmit(onSubmit)} className="login-form" autoComplete="off" noValidate>
            {serverError && (
              <p className="auth-error" role="alert">
                {serverError}
              </p>
            )}
            <Field.Root className="login-field" invalid={Boolean(errors.name)}>
              <Field.Label>Name</Field.Label>
              <Field.Input
                type="text"
                autoComplete="off"
                {...register("name")}
                className={errors.name ? "field-invalid" : undefined}
              />
              {errors.name && <Field.ErrorText className="login-error">{errors.name.message}</Field.ErrorText>}
            </Field.Root>
            <Field.Root className="login-field" invalid={Boolean(errors.email)}>
              <Field.Label>Email</Field.Label>
              <Field.Input
                type="email"
                autoComplete="off"
                {...register("email")}
                className={errors.email ? "field-invalid" : undefined}
              />
              {errors.email && <Field.ErrorText className="login-error">{errors.email.message}</Field.ErrorText>}
            </Field.Root>
            <Field.Root className="login-field" invalid={Boolean(errors.password)}>
              <Field.Label>Password</Field.Label>
              <Field.Input
                type="password"
                autoComplete="new-password"
                placeholder="Leave blank to keep current password"
                {...register("password")}
                className={errors.password ? "field-invalid" : undefined}
              />
              {errors.password && (
                <Field.ErrorText className="login-error">{errors.password.message}</Field.ErrorText>
              )}
            </Field.Root>
            <button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving..." : "Save"}
            </button>
          </form>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
