import { useEffect, useState } from "react";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { authClient } from "../lib/auth-client";

type Metrics = {
  totalTickets: number;
  openTickets: number;
  aiResolvedTickets: number;
  aiResolvedPercent: number;
  avgResolutionSeconds: number | null;
  ticketsPerDay: { date: string; count: number; resolved: number }[];
};

const MIN_SKELETON_MS = 2000;

function formatDuration(seconds: number | null): string {
  if (seconds == null) return "—";
  const total = Math.round(seconds);
  if (total < 60) return `${total}s`;
  const minutes = Math.round(total / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  if (hours < 24) return remMinutes ? `${hours}h ${remMinutes}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours ? `${days}d ${remHours}h` : `${days}d`;
}

export function DashboardPage() {
  const { data: session } = authClient.useSession();

  const {
    data: metrics,
    error,
    isLoading,
  } = useQuery({
    queryKey: ["metrics"],
    queryFn: async () => (await axios.get<Metrics>("/api/metrics")).data,
  });

  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setMinTimeElapsed(true), MIN_SKELETON_MS);
    return () => clearTimeout(timer);
  }, []);

  const showSkeleton = isLoading || !minTimeElapsed;

  const cards: { label: string; value: string | undefined }[] = [
    { label: "Total tickets", value: metrics?.totalTickets.toLocaleString() },
    { label: "Open tickets", value: metrics?.openTickets.toLocaleString() },
    { label: "Resolved by AI", value: metrics?.aiResolvedTickets.toLocaleString() },
    {
      label: "% resolved by AI",
      value: metrics ? `${metrics.aiResolvedPercent.toFixed(1)}%` : undefined,
    },
    {
      label: "Avg resolution time",
      value: metrics ? formatDuration(metrics.avgResolutionSeconds) : undefined,
    },
  ];

  const perDay = metrics?.ticketsPerDay ?? [];
  const maxCount = perDay.reduce((max, d) => Math.max(max, d.count), 0);
  const showChart = !showSkeleton && metrics;

  return (
    <div className="dashboard-page">
      <h1>Welcome, {session?.user.name}</h1>
      {error ? (
        <p className="auth-error">
          {axios.isAxiosError(error)
            ? (error.response?.data?.error ?? "Failed to load metrics")
            : error.message}
        </p>
      ) : (
        <>
          <div className="dashboard-grid">
            {cards.map((card) => (
              <div className="stat-card" key={card.label}>
                <span className="stat-label">{card.label}</span>
                <span className="stat-value">
                  {showSkeleton ? <span className="skeleton skeleton-short" /> : card.value}
                </span>
              </div>
            ))}
          </div>

          <section className="dashboard-chart">
            <h2>Tickets per day — last 30 days</h2>
            <div className="chart-bars">
              {showChart ? (
                perDay.map((day) => (
                  <div
                    key={day.date}
                    className="chart-bar"
                    style={{ height: `${maxCount === 0 ? 0 : (day.count / maxCount) * 100}%` }}
                    title={`${day.date}: ${day.count} ticket${day.count === 1 ? "" : "s"} created, ${day.resolved} resolved`}
                  />
                ))
              ) : (
                <span className="skeleton chart-skeleton" />
              )}
            </div>
            {showChart && (
              <div className="chart-axis">
                <span>{perDay[0]?.date}</span>
                <span>{perDay[perDay.length - 1]?.date}</span>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
