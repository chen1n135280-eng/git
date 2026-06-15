"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { DashboardData } from "@/lib/types";
import { Loading, StatusBadge } from "@/components/ui";

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<DashboardData>("/api/dashboard").then(setData).catch((reason) => setError(reason.message));
  }, []);

  if (error) return <PageError message={error} />;
  if (!data) return <Loading />;

  const confirmedRatio = data.counts.total
    ? Math.round((data.counts.confirmed / data.counts.total) * 100)
    : 0;

  return (
    <div className="page dashboard-page">
      <header className="hero">
        <div>
          <span className="eyebrow">CPA · 会计</span>
          <h1>今天，把一个难点<br />真正讲明白。</h1>
          <p>教材是依据，AI负责拆解，你负责最后确认。</p>
        </div>
        <div className="hero-card">
          <span>内容确认进度</span>
          <strong>{confirmedRatio}<small>%</small></strong>
          <div className="progress-track">
            <i style={{ width: `${confirmedRatio}%` }} />
          </div>
          <p>{data.counts.confirmed} / {data.counts.total} 个知识点已确认</p>
        </div>
      </header>

      {!data.ai_configured && (
        <div className="notice">
          <span>配置提示</span>
          <p>当前未配置云模型。教材仍可解析、知识卡可浏览和编辑；自动拆解与教学素材理解暂不执行。</p>
          <Link href="/sources">查看资料处理</Link>
        </div>
      )}

      <section className="metric-grid">
        <Metric label="知识点总数" value={data.counts.total} detail="第十六章试点" tone="green" />
        <Metric label="高难知识点" value={data.counts.complex} detail="3星及以上" tone="gold" />
        <Metric label="等待人工审核" value={data.counts.pending} detail={`${data.counts.drafts} 份AI草稿`} tone="blue" />
        <Metric label="已确认" value={data.counts.confirmed} detail="可进入学习页" tone="ink" />
      </section>

      <div className="dashboard-grid">
        <section className="panel chapter-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">试点章节</span>
              <h2>理论知识地图</h2>
            </div>
            <Link className="text-link" href="/chapters/1">进入学习 →</Link>
          </div>
          {data.chapters.map((chapter) => (
            <Link className="chapter-row" href={`/chapters/${chapter.id}`} key={chapter.id}>
              <span className="chapter-number">{String(chapter.number).padStart(2, "0")}</span>
              <div>
                <h3>{chapter.title}</h3>
                <p>{chapter.summary}</p>
              </div>
              <div className="chapter-count">
                <strong>{chapter.point_count}</strong>
                <span>知识点</span>
              </div>
            </Link>
          ))}
        </section>

        <section className="panel job-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">处理动态</span>
              <h2>最近任务</h2>
            </div>
            <Link className="text-link" href="/sources">全部资料 →</Link>
          </div>
          {data.recent_jobs.length ? (
            data.recent_jobs.map((job) => (
              <div className="job-row" key={job.id}>
                <div className="job-topline">
                  <span>{job.kind === "textbook" ? "教材解析" : "后台教学素材"}</span>
                  <StatusBadge status={job.status} />
                </div>
                <p>{job.stage}</p>
                <div className="progress-track slim">
                  <i style={{ width: `${job.progress}%` }} />
                </div>
              </div>
            ))
          ) : (
            <div className="quiet-state">
              <strong>资料已经就位</strong>
              <p>前往资料处理页启动教材解析。</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Metric({ label, value, detail, tone }: { label: string; value: number; detail: string; tone: string }) {
  return (
    <div className={`metric metric-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </div>
  );
}

function PageError({ message }: { message: string }) {
  return (
    <div className="page-error">
      <strong>暂时无法连接内容服务</strong>
      <p>{message}</p>
      <code>cd api; uvicorn app.main:app --reload</code>
    </div>
  );
}

