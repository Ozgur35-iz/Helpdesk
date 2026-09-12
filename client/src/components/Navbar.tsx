import { Link } from "react-router-dom";
import { authClient } from "../lib/auth-client";

export function Navbar() {
  const { data: session } = authClient.useSession();

  return (
    <nav className="navbar">
      <span className="navbar-user">{session?.user.name}</span>
      <div className="navbar-actions">
        <Link to="/">Dashboard</Link>
        <Link to="/tickets">Tickets</Link>
        {session?.user.role === "admin" && <Link to="/users">Users</Link>}
        <button onClick={() => authClient.signOut()}>Log out</button>
      </div>
    </nav>
  );
}
