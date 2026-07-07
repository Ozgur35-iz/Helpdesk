import { useEffect, useState } from "react";

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
};

export function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/users")
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error ?? "Failed to load users");
        return res.json();
      })
      .then(setUsers)
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) return <p>Loading...</p>;
  if (error) return <p className="auth-error">{error}</p>;

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
          {users.map((user) => (
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
