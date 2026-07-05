import { Navigate, Outlet } from "react-router-dom";
import { authClient } from "../lib/auth-client";

export function RequireAuth() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) return <p>Loading...</p>;
  if (!session) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export function GuestOnly() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) return <p>Loading...</p>;
  if (session) return <Navigate to="/" replace />;
  return <Outlet />;
}
