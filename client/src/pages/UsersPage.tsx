import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
};

const MIN_SKELETON_MS = 2000;

export function UsersPage() {
  const {
    data: users = [],
    error,
    isLoading,
  } = useQuery({
    queryKey: ["users"],
    queryFn: async () => (await axios.get<User[]>("/api/users")).data,
  });

  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMinTimeElapsed(true), MIN_SKELETON_MS);
    return () => clearTimeout(timer);
  }, []);

  const showSkeleton = isLoading || !minTimeElapsed;

  if (error)
    return (
      <p className="auth-error">
        {axios.isAxiosError(error)
          ? (error.response?.data?.error ?? "Failed to load users")
          : error.message}
      </p>
    );

  return (
    <div className="users-page">
      <h1>Users</h1>
      <table className="users-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {showSkeleton
            ? Array.from({ length: 5 }, (_, i) => (
                <tr key={i}>
                  <td>
                    <span className="skeleton" />
                  </td>
                  <td>
                    <span className="skeleton" />
                  </td>
                  <td>
                    <span className="skeleton skeleton-short" />
                  </td>
                  <td>
                    <span className="skeleton skeleton-short" />
                  </td>
                </tr>
              ))
            : users.map((user) => (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>{user.role}</td>
                  <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}
