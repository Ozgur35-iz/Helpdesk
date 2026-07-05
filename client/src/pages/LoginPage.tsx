import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { authClient } from "../lib/auth-client";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    await authClient.signIn.email(
      { email, password },
      {
        onSuccess: () => navigate("/", { replace: true }),
        onError: (ctx) => setError(ctx.error.message ?? "Invalid email or password"),
      },
    );

    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="login-form">
      <h1>Log in</h1>
      {error && (
        <p className="login-error" role="alert">
          {error}
        </p>
      )}
      <label>
        Email
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </label>
      <label>
        Password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </label>
      <button type="submit" disabled={loading}>
        {loading ? "Logging in..." : "Log in"}
      </button>
    </form>
  );
}
