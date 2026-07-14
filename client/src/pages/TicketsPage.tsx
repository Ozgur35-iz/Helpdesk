import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

type Ticket = {
  id: number;
  subject: string;
  requesterEmail: string;
  senderName: string;
  status: string;
  category: string | null;
  createdAt: string;
};

const MIN_SKELETON_MS = 2000;

export function TicketsPage() {
  const {
    data: tickets = [],
    error,
    isLoading,
  } = useQuery({
    queryKey: ["tickets"],
    queryFn: async () => (await axios.get<Ticket[]>("/api/tickets")).data,
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
          ? (error.response?.data?.error ?? "Failed to load tickets")
          : error.message}
      </p>
    );

  return (
    <div className="tickets-page">
      <div className="tickets-header">
        <h1>Tickets</h1>
      </div>
      <table className="tickets-table">
        <thead>
          <tr>
            <th>Subject</th>
            <th>Requester</th>
            <th>Status</th>
            <th>Category</th>
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
                  <td>
                    <span className="skeleton skeleton-short" />
                  </td>
                </tr>
              ))
            : tickets.map((ticket) => (
                <tr key={ticket.id}>
                  <td>{ticket.subject}</td>
                  <td>
                    {ticket.senderName} &lt;{ticket.requesterEmail}&gt;
                  </td>
                  <td>{ticket.status}</td>
                  <td>{ticket.category ?? "—"}</td>
                  <td>{new Date(ticket.createdAt).toLocaleString()}</td>
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}
