import type { ReactNode } from "react";

type StatCardProps = {
  label: string;
  value: string | number;
  detail?: string;
  icon: ReactNode;
  tone?: "blue" | "green" | "amber" | "red" | "neutral";
};

export default function StatCard({ label, value, detail, icon, tone = "blue" }: StatCardProps) {
  return (
    <div className="stat-card group">
      <div className="flex items-start justify-between gap-3">
        <p className="stat-label">{label}</p>
        <span className={`stat-icon stat-icon-${tone}`}>{icon}</span>
      </div>
      <p className="stat-value">{value}</p>
      {detail ? <p className="stat-detail">{detail}</p> : null}
    </div>
  );
}
