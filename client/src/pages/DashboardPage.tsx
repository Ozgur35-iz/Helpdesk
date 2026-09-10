import { authClient } from "../lib/auth-client";

export function HomePage() {
  const { data: session } = authClient.useSession();

  return (
    <div className="home-page">
      <h1>Welcome, {session?.user.name}</h1>
      <p>Ticket System</p>
    </div>
  );
}
