import { Navigate, Route, Routes } from "react-router-dom";
import "./App.css";
import { GuestOnly, RequireAdmin, RequireAuth } from "./routes/guards";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/LoginPage";
import { HomePage } from "./pages/HomePage";
import { UsersPage } from "./pages/UsersPage";
import { TicketsPage } from "./pages/TicketsPage";

function App() {
  return (
    <Routes>
      <Route element={<GuestOnly />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/tickets" element={<TicketsPage />} />
          <Route element={<RequireAdmin />}>
            <Route path="/users" element={<UsersPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
