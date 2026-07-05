import { authClient } from "../lib/auth-client";

export function Navbar() {
  const { data: session } = authClient.useSession();

  return (
    <nav className="navbar">
      <span className="navbar-user">{session?.user.name}</span>
      <button onClick={() => authClient.signOut()}>Log out</button>
    </nav>
  );
}
