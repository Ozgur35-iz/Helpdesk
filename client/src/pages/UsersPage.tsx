import axios from "axios";
import { useQuery } from "@tanstack/react-query";

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
};

export function UsersPage() {
  const {
    data: users = [],
    error,
    isLoading,
  } = useQuery({
    queryKey: ["users"],
    queryFn: async () => (await axios.get<User[]>("/api/users")).data,
  });

  if (isLoading) return <p>Loading...</p>;
  if (error) return <p className="auth-error">{axios.isAxiosError(error) ? (error.response?.data?.error ?? "Failed to load users") : error.message}</p>;

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
