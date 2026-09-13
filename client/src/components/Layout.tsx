import { Outlet } from "react-router-dom";
import { Navbar } from "./Navbar";

export function Layout() {
  return (
    <div className="app-shell">
      <Navbar />
      <main>
        <Outlet />
      </main>
    </div>
  );
}
