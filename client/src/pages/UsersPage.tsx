import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { CreateUserModal } from "../components/CreateUserModal";
import { EditUserModal } from "../components/EditUserModal";
import { DeleteUserModal } from "../components/DeleteUserModal";

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
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);

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
      <div className="users-header">
        <h1>Users</h1>
        <button type="button" onClick={() => setModalOpen(true)}>
          Create User
        </button>
      </div>
      <table className="users-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Created</th>
            <th>Actions</th>
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
                  <td>
                    <button type="button" aria-label={`Edit ${user.name}`} onClick={() => setEditingUser(user)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${user.name}`}
                      disabled={user.role === "admin"}
                      onClick={() => setDeletingUser(user)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
        </tbody>
      </table>
      <CreateUserModal open={modalOpen} onOpenChange={setModalOpen} />
      {editingUser && (
        <EditUserModal key={editingUser.id} user={editingUser} onClose={() => setEditingUser(null)} />
      )}
      {deletingUser && (
        <DeleteUserModal key={deletingUser.id} user={deletingUser} onClose={() => setDeletingUser(null)} />
      )}
    </div>
  );
}
