import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

type TicketDetail = {
  id: number;
  subject: string;
  body: string;
  requesterEmail: string;
  senderName: string;
  status: string;
  category: string | null;
  createdAt: string;
  updatedAt: string;
};

export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();

  const {
    data: ticket,
    error,
    isLoading,
  } = useQuery({
    queryKey: ["ticket", id],
    queryFn: async () => (await axios.get<TicketDetail>(`/api/tickets/${id}`)).data,
  });

  if (error)
    return (
      <div className="ticket-detail-page">
        <Link to="/tickets">&larr; Back to tickets</Link>
        <p className="auth-error">
          {axios.isAxiosError(error)
            ? (error.response?.data?.error ?? "Failed to load ticket")
            : error.message}
        </p>
      </div>
    );

  if (isLoading || !ticket) return <p>Loading...</p>;

  return (
    <div className="ticket-detail-page">
      <Link to="/tickets">&larr; Back to tickets</Link>
      <h1>{ticket.subject}</h1>
      <dl className="ticket-detail-fields">
        <dt>Status</dt>
        <dd>{ticket.status}</dd>
        <dt>Category</dt>
        <dd>{ticket.category ?? "—"}</dd>
        <dt>Requester</dt>
        <dd>
          {ticket.senderName} &lt;{ticket.requesterEmail}&gt;
        </dd>
        <dt>Created</dt>
        <dd>{new Date(ticket.createdAt).toLocaleString()}</dd>
        <dt>Updated</dt>
        <dd>{new Date(ticket.updatedAt).toLocaleString()}</dd>
      </dl>
      <p className="ticket-detail-body">{ticket.body}</p>
    </div>
  );
}
