import { useState } from "react";
import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Field } from "@ark-ui/react/field";

type Agent = {
  id: string;
  name: string;
  email: string;
};

type TicketDetail = {
  id: number;
  subject: string;
  body: string;
  requesterEmail: string;
  senderName: string;
  status: string;
  category: string | null;
  assignee: Agent | null;
  createdAt: string;
  updatedAt: string;
};

type ReplyAuthor = {
  id: string;
  name: string;
  email: string;
};

type TicketReply = {
  id: number;
  body: string;
  author: ReplyAuthor;
  createdAt: string;
};

const replySchema = z.object({ body: z.string().trim().min(1, "Reply cannot be empty") });
type ReplyFormValues = z.infer<typeof replySchema>;

const statusValues = ["open", "pending", "resolved", "closed"] as const;
const categoryValues = ["billing", "technical", "account", "refund"] as const;

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function SparklesIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M11 2l1.6 4.9L17.5 8.5l-4.9 1.6L11 15l-1.6-4.9L4.5 8.5l4.9-1.6L11 2zM18.5 13l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9.9-2.6z" />
    </svg>
  );
}

export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [assignError, setAssignError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [polishError, setPolishError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [summarizeError, setSummarizeError] = useState<string | null>(null);

  const {
    data: ticket,
    error,
    isLoading,
  } = useQuery({
    queryKey: ["ticket", id],
    queryFn: async () => (await axios.get<TicketDetail>(`/api/tickets/${id}`)).data,
  });

  const { data: agents = [] } = useQuery({
    queryKey: ["users", "agents"],
    queryFn: async () => (await axios.get<Agent[]>("/api/users/agents")).data,
  });

  const { data: replies = [] } = useQuery({
    queryKey: ["ticket", id, "replies"],
    queryFn: async () => (await axios.get<TicketReply[]>(`/api/tickets/${id}/replies`)).data,
  });

  const {
    register,
    handleSubmit,
    reset,
    getValues,
    setValue,
    formState: { errors: replyErrors, isSubmitting: isSubmittingReply },
  } = useForm<ReplyFormValues>({ resolver: zodResolver(replySchema) });

  const assignMutation = useMutation({
    mutationFn: (assigneeId: string | null) =>
      axios.patch<TicketDetail>(`/api/tickets/${id}/assign`, { assigneeId }),
    onSuccess: () => {
      setAssignError(null);
      queryClient.invalidateQueries({ queryKey: ["ticket", id] });
    },
    onError: (err) => {
      setAssignError(
        axios.isAxiosError(err) ? (err.response?.data?.error ?? "Failed to assign ticket") : err.message,
      );
    },
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => axios.patch<TicketDetail>(`/api/tickets/${id}/status`, { status }),
    onSuccess: () => {
      setStatusError(null);
      queryClient.invalidateQueries({ queryKey: ["ticket", id] });
    },
    onError: (err) => {
      setStatusError(
        axios.isAxiosError(err) ? (err.response?.data?.error ?? "Failed to update status") : err.message,
      );
    },
  });

  const categoryMutation = useMutation({
    mutationFn: (category: string | null) =>
      axios.patch<TicketDetail>(`/api/tickets/${id}/category`, { category }),
    onSuccess: () => {
      setCategoryError(null);
      queryClient.invalidateQueries({ queryKey: ["ticket", id] });
    },
    onError: (err) => {
      setCategoryError(
        axios.isAxiosError(err) ? (err.response?.data?.error ?? "Failed to update category") : err.message,
      );
    },
  });

  const replyMutation = useMutation({
    mutationFn: (body: string) => axios.post<TicketReply>(`/api/tickets/${id}/replies`, { body }),
    onSuccess: () => {
      setReplyError(null);
      reset();
      queryClient.invalidateQueries({ queryKey: ["ticket", id, "replies"] });
    },
    onError: (err) => {
      setReplyError(
        axios.isAxiosError(err) ? (err.response?.data?.error ?? "Failed to post reply") : err.message,
      );
    },
  });

  const polishMutation = useMutation({
    mutationFn: (body: string) =>
      axios.post<{ text: string }>(`/api/tickets/${id}/polish-reply`, { body }),
    onSuccess: (res) => {
      setPolishError(null);
      setValue("body", res.data.text, { shouldValidate: true, shouldDirty: true });
    },
    onError: (err) => {
      setPolishError(
        axios.isAxiosError(err) ? (err.response?.data?.error ?? "Failed to polish reply") : err.message,
      );
    },
  });

  const summarizeMutation = useMutation({
    mutationFn: () => axios.post<{ text: string }>(`/api/tickets/${id}/summarize`),
    onSuccess: (res) => {
      setSummarizeError(null);
      setSummary(res.data.text);
    },
    onError: (err) => {
      setSummarizeError(
        axios.isAxiosError(err) ? (err.response?.data?.error ?? "Failed to summarize ticket") : err.message,
      );
    },
  });

  const onSubmitReply = (values: ReplyFormValues) => replyMutation.mutateAsync(values.body).catch(() => {});
  const onPolishReply = () => {
    const body = getValues("body")?.trim();
    if (!body) {
      setPolishError("Write a reply before polishing it");
      return;
    }
    polishMutation.mutate(body);
  };

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
      <div className="ticket-detail-header">
        <h1>{ticket.subject}</h1>
        <button
          type="button"
          className="summarize-button"
          onClick={() => summarizeMutation.mutate()}
          disabled={summarizeMutation.isPending}
        >
          <SparklesIcon />
          {summarizeMutation.isPending ? "Summarizing..." : "Summarize"}
        </button>
      </div>
      {summarizeError && (
        <p className="auth-error" role="alert">
          {summarizeError}
        </p>
      )}
      {summary && (
        <div className="ticket-summary">
          <h2>
            <SparklesIcon /> Summary
          </h2>
          <p>{summary}</p>
        </div>
      )}
      <div className="ticket-detail-columns">
        <dl className="ticket-detail-fields">
          <dt>Requester</dt>
          <dd>
            {ticket.senderName} &lt;{ticket.requesterEmail}&gt;
          </dd>
          <dt>Created</dt>
          <dd>{new Date(ticket.createdAt).toLocaleString()}</dd>
          <dt>Updated</dt>
          <dd>{new Date(ticket.updatedAt).toLocaleString()}</dd>
        </dl>
        <dl className="ticket-detail-fields">
          <dt>Status</dt>
          <dd>
            <select
              aria-label="Status"
              value={ticket.status}
              disabled={statusMutation.isPending}
              onChange={(e) => statusMutation.mutate(e.target.value)}
            >
              {statusValues.map((status) => (
                <option key={status} value={status}>
                  {titleCase(status)}
                </option>
              ))}
            </select>
            {statusError && (
              <p className="auth-error" role="alert">
                {statusError}
              </p>
            )}
          </dd>
          <dt>Category</dt>
          <dd>
            <select
              aria-label="Category"
              value={ticket.category ?? ""}
              disabled={categoryMutation.isPending}
              onChange={(e) => categoryMutation.mutate(e.target.value || null)}
            >
              <option value="">None</option>
              {categoryValues.map((category) => (
                <option key={category} value={category}>
                  {titleCase(category)}
                </option>
              ))}
            </select>
            {categoryError && (
              <p className="auth-error" role="alert">
                {categoryError}
              </p>
            )}
          </dd>
          <dt>Assignee</dt>
          <dd>
            <select
              aria-label="Assignee"
              value={ticket.assignee?.id ?? ""}
              disabled={assignMutation.isPending}
              onChange={(e) => assignMutation.mutate(e.target.value || null)}
            >
              <option value="">Unassigned</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
            {assignError && (
              <p className="auth-error" role="alert">
                {assignError}
              </p>
            )}
          </dd>
        </dl>
      </div>
      <p className="ticket-detail-body">{ticket.body}</p>
      <section className="ticket-replies">
        <h2>Replies</h2>
        <ul className="ticket-replies-list">
          {replies.map((reply) => (
            <li key={reply.id} className="ticket-reply">
              <p className="ticket-reply-meta">
                {reply.author.name} &middot; {new Date(reply.createdAt).toLocaleString()}
              </p>
              <p className="ticket-reply-body">{reply.body}</p>
            </li>
          ))}
        </ul>
        <form onSubmit={handleSubmit(onSubmitReply)} noValidate className="ticket-reply-form">
          <Field.Root className="ticket-reply-field" invalid={Boolean(replyErrors.body)}>
            <Field.Label>Add a reply</Field.Label>
            <Field.Textarea rows={4} {...register("body")} />
            {replyErrors.body && <Field.ErrorText>{replyErrors.body.message}</Field.ErrorText>}
          </Field.Root>
          {polishError && (
            <p className="auth-error" role="alert">
              {polishError}
            </p>
          )}
          {replyError && (
            <p className="auth-error" role="alert">
              {replyError}
            </p>
          )}
          <button type="button" onClick={onPolishReply} disabled={polishMutation.isPending}>
            {polishMutation.isPending ? "Polishing..." : "Polish"}
          </button>
          <button type="submit" disabled={isSubmittingReply}>
            {isSubmittingReply ? "Posting..." : "Post reply"}
          </button>
        </form>
      </section>
    </div>
  );
}
