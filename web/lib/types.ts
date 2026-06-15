export type Status = "ai_draft" | "pending_review" | "confirmed";

export interface DashboardData {
  counts: {
    total: number;
    drafts: number;
    pending: number;
    confirmed: number;
    complex: number;
  };
  chapters: Chapter[];
  recent_jobs: Job[];
  ai_configured: boolean;
}

export interface Chapter {
  id: number;
  subject: string;
  title: string;
  number: number;
  summary: string;
  point_count: number;
  confirmed_count?: number;
}

export interface JournalLine {
  account: string;
  direction: "debit" | "credit";
  amount: number;
}

export interface JournalEntry {
  label: string;
  lines: JournalLine[];
}

export interface KnowledgePoint {
  id: number;
  chapter_id: number;
  chapter_title?: string;
  title: string;
  category: string;
  standard_explanation: string;
  difficulty: number;
  difficulty_reason: string;
  plain_explanation: string | null;
  teaching_case: string | null;
  mistakes: string[];
  prerequisites: string[];
  journal_entries: JournalEntry[];
  source_id: number | null;
  source_name: string | null;
  source_page_start: number | null;
  source_page_end: number | null;
  status: Status;
  conflict_note: string | null;
  framework_section: string | null;
  framework_topic: string | null;
  framework_section_order: number | null;
  framework_topic_order: number | null;
  textbook_difficulty: "易" | "中" | "难" | null;
  audit_errors: string[];
}

export interface Source {
  id: number;
  name: string;
  kind: "textbook" | "teaching_video";
  status: string;
  page_count: number | null;
  error: string | null;
  job_count: number;
}

export interface Job {
  id: number;
  status: string;
  stage: string;
  progress: number;
  error: string | null;
  source_name: string;
  kind: "textbook" | "teaching_video";
}
