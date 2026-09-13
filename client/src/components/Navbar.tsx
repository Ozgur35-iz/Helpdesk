import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { authClient } from "../lib/auth-client";
import { ThemeToggle } from "./ThemeToggle";
import { DashboardIcon, LogoutIcon, TicketsIcon, UsersIcon } from "./icons";

function RailLink({ to, end, icon, label }: { to: string; end?: boolean; icon: ReactNode; label: string }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => "rail-link" + (isActive ? " active" : "")}>
      {icon}
      <span>{label}</span>
    </NavLink>
  );
}

export function Navbar() {
  const { data: session } = authClient.useSession();

  return (
    <nav className="rail" aria-label="Primary">
      <span className="rail-mark" aria-hidden="true" />
      <div className="rail-links">
        <RailLink to="/" end icon={<DashboardIcon />} label="Dashboard" />
        <RailLink to="/tickets" icon={<TicketsIcon />} label="Tickets" />
        {session?.user.role === "admin" && (
          <RailLink to="/users" icon={<UsersIcon />} label="Users" />
        )}
      </div>
      <div className="rail-footer">
        <div className="rail-user">
          <span className="rail-user-name">{session?.user.name}</span>
          <ThemeToggle />
        </div>
        <button type="button" className="rail-logout" onClick={() => authClient.signOut()}>
          <LogoutIcon />
          <span>Log out</span>
        </button>
      </div>
    </nav>
  );
}
