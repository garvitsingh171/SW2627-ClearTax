import Icon, { type IconName } from "@/components/ui/Icon";

export type StatusValue =
  | "MATCHED"
  | "MISMATCHED"
  | "UNMATCHED"
  | "ERROR"
  | "FAILED"
  | "PROCESSING"
  | "QUEUED"
  | "COMPLETED"
  | "COMPLETED_WITH_ERRORS"
  | "READY"
  | "PENDING";

const config: Record<StatusValue, { label: string; icon: IconName; className: string }> = {
  MATCHED: { label: "Matched", icon: "check", className: "status-success" },
  MISMATCHED: { label: "Mismatched", icon: "warning", className: "status-warning" },
  UNMATCHED: { label: "Unmatched", icon: "warning", className: "status-warning" },
  ERROR: { label: "Error", icon: "x", className: "status-error" },
  FAILED: { label: "Failed", icon: "x", className: "status-error" },
  PROCESSING: { label: "Processing", icon: "activity", className: "status-info" },
  QUEUED: { label: "Queued", icon: "activity", className: "status-neutral" },
  COMPLETED: { label: "Completed", icon: "check", className: "status-success" },
  COMPLETED_WITH_ERRORS: { label: "Completed with errors", icon: "warning", className: "status-warning" },
  READY: { label: "Ready", icon: "check", className: "status-success" },
  PENDING: { label: "Pending", icon: "activity", className: "status-neutral" },
};

export default function StatusBadge({ value, compact = false }: { value: StatusValue; compact?: boolean }) {
  const item = config[value];

  return (
    <span className={`status-badge ${item.className} ${compact ? "status-badge-compact" : ""}`}>
      <Icon name={item.icon} size={compact ? 13 : 14} />
      {item.label}
    </span>
  );
}
