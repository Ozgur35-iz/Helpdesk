import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { Field } from "@ark-ui/react/field";
import { authClient } from "../lib/auth-client";

const loginSchema = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

function shake(el: HTMLElement | null) {
  if (!el) return;
  el.classList.remove("shake");
  void el.offsetWidth;
  el.classList.add("shake");
}

export function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, submitCount },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  const emailRef = useRef<HTMLInputElement | null>(null);
  const passwordRef = useRef<HTMLInputElement | null>(null);
  const { ref: emailFormRef, ...emailField } = register("email");
  const { ref: passwordFormRef, ...passwordField } = register("password");

  const emailInvalid = Boolean(errors.email) || Boolean(error);
  const passwordInvalid = Boolean(errors.password) || Boolean(error);

  useEffect(() => {
    if (emailInvalid) shake(emailRef.current);
  }, [emailInvalid, submitCount]);

  useEffect(() => {
    if (passwordInvalid) shake(passwordRef.current);
  }, [passwordInvalid, submitCount]);

  const onSubmit = async (values: LoginFormValues) => {
    setError(null);

    await authClient.signIn.email(values, {
      onSuccess: () => navigate("/", { replace: true }),
      onError: (ctx) => setError(ctx.error.message ?? "Invalid email or password"),
    });
  };

  return (
    <div className="login-page">
      <form onSubmit={handleSubmit(onSubmit)} className="login-form" noValidate>
        <h1>Log in</h1>
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        <Field.Root className="login-field" invalid={emailInvalid}>
          <Field.Label>Email</Field.Label>
          <Field.Input
            type="email"
            {...emailField}
            ref={(el) => {
              emailFormRef(el);
              emailRef.current = el;
            }}
            className={emailInvalid ? "field-invalid" : undefined}
          />
          {errors.email && (
            <Field.ErrorText className="login-error">{errors.email.message}</Field.ErrorText>
          )}
        </Field.Root>
        <Field.Root className="login-field" invalid={passwordInvalid}>
          <Field.Label>Password</Field.Label>
          <Field.Input
            type="password"
            {...passwordField}
            ref={(el) => {
              passwordFormRef(el);
              passwordRef.current = el;
            }}
            className={passwordInvalid ? "field-invalid" : undefined}
          />
          {errors.password && (
            <Field.ErrorText className="login-error">{errors.password.message}</Field.ErrorText>
          )}
        </Field.Root>
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Logging in..." : "Log in"}
        </button>
      </form>
    </div>
  );
}
