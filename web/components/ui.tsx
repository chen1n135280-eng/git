import type { ReactNode } from "react";
import type { Status } from "@/lib/types";

export function StatusBadge({ status }: { status: Status | string }) {
  const labels: Record<string, string> = {
    ai_draft: "AI草稿",
    pending_review: "待审核",
    confirmed: "已确认",
    pending: "待处理",
    processing: "处理中",
    completed: "已完成",
    failed: "失败",
    queued: "排队中",
    running: "处理中",
  };
  return <span className={`status status-${status}`}>{labels[status] ?? status}</span>;
}

export function Stars({ value }: { value: number }) {
  return (
    <span className="stars" aria-label={`${value}星难度`}>
      {Array.from({ length: 5 }, (_, index) => (
        <span className={index < value ? "star-on" : "star-off"} key={index}>
          ★
        </span>
      ))}
    </span>
  );
}

export function EmptyState({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-mark">知</div>
      <h3>{title}</h3>
      <p>{detail}</p>
      {action}
    </div>
  );
}

export function Loading() {
  return (
    <div className="loading">
      <span />
      <span />
      <span />
      正在整理内容
    </div>
  );
}

