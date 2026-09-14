import { useEffect, useState } from "react";
import axios from "axios";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog } from "@ark-ui/react/dialog";
import { Field } from "@ark-ui/react/field";

const createUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.email("Enter a valid email"),
  password: z.string().min(12, "Password must be at least 12 characters"),
});

type CreateUserFormValues = z.infer<typeof createUserSchema>;

type CreateUserModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreateUserModal({ open, onOpenChange }: CreateUserModalProps) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateUserFormValues>({ resolver: zodResolver(createUserSchema) });

  useEffect(() => {
    if (!open) {
      reset();
      setServerError(null);
    }
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: (values: CreateUserFormValues) => axios.post("/api/users", values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      onOpenChange(false);
    },
    onError: (err) => {
      setServerError(
        axios.isAxiosError(err) ? (err.response?.data?.error ?? "Failed to create user") : err.message,
      );
    },
  });

  const onSubmit = (values: CreateUserFormValues) => {
    setServerError(null);
    mutation.mutate(values);
  };

  return (
    <Dialog.Root open={open} onOpenChange={(d) => onOpenChange(d.open)} unmountOnExit>
      <Dialog.Backdrop className="modal-backdrop" />
      <Dialog.Positioner className="modal-positioner">
        <Dialog.Content className="modal-content">
          <Dialog.Title>Create User</Dialog.Title>
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
                {...register("password")}
                className={errors.password ? "field-invalid" : undefined}
              />
              {errors.password && (
                <Field.ErrorText className="login-error">{errors.password.message}</Field.ErrorText>
              )}
            </Field.Root>
            <button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Creating..." : "Create"}
            </button>
          </form>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
