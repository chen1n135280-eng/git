"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Job, Source } from "@/lib/types";
import { Loading, StatusBadge } from "@/components/ui";

export default function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function load() {
    const [sourceData, jobData] = await Promise.all([
      api<Source[]>("/api/sources"),
      api<Job[]>("/api/jobs"),
    ]);
    setSources(sourceData);
    setJobs(jobData);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 4000);
    return () => window.clearInterval(timer);
  }, []);

  async function process(source: Source) {
    try {
      await api(`/api/sources/${source.id}/process`, { method: "POST" });
      setMessage("处理任务已启动");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "启动失败");
    }
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("file");
    const kind = data.get("kind");
    if (!(file instanceof File) || !file.size) return;
    try {
      await api(`/api/sources/upload?kind=${kind}`, { method: "POST", body: data });
      form.reset();
      setMessage("资料已导入");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "导入失败");
    }
  }

  if (loading) return <Loading />;

  return (
    <div className="page sources-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">内容生产后台</span>
          <h1>资料处理</h1>
          <p>教材提供事实依据，教学素材仅用于后台理解讲解思路。</p>
        </div>
      </header>

      {message && <button className="toast" onClick={() => setMessage("")}>{message}</button>}

      <div className="privacy-note">
        <strong>教学素材隔离规则</strong>
        <p>系统不提供播放、转写稿查看或时间定位功能。后台只保留结构化讲解要点，教材始终是知识结论的主来源。</p>
      </div>

      <section className="panel upload-panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">新增资料</span>
            <h2>导入本地文件</h2>
          </div>
        </div>
        <form className="upload-form" onSubmit={upload}>
          <select name="kind" aria-label="资料类型">
            <option value="textbook">CPA教材（PDF）</option>
            <option value="teaching_video">后台教学素材（视频）</option>
          </select>
          <input name="file" type="file" accept=".pdf,.mp4,.mov,.m4v,.webm" required />
          <button className="primary" type="submit">导入资料</button>
        </form>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">资料库</span>
            <h2>已发现的文件</h2>
          </div>
          <span className="count-label">{sources.length} 项</span>
        </div>
        <div className="source-list">
          {sources.map((source) => {
            const latestJob = jobs.find((job) => job.source_name === source.name);
            return (
              <div className="source-row" key={source.id}>
                <div className={`source-icon ${source.kind === "textbook" ? "pdf" : "video"}`}>
                  {source.kind === "textbook" ? "PDF" : "AI"}
                </div>
                <div className="source-main">
                  <strong>{source.name}</strong>
                  <span>{source.kind === "textbook" ? "教材主来源" : "仅后台理解讲解思路"}</span>
                  {latestJob && latestJob.status !== "completed" && (
                    <div className="job-inline">
                      <div className="progress-track slim"><i style={{ width: `${latestJob.progress}%` }} /></div>
                      <small>{latestJob.stage}</small>
                    </div>
                  )}
                  {source.error && <small className="source-error">{source.error}</small>}
                </div>
                <div className="source-meta">
                  <StatusBadge status={source.status} />
                  {source.page_count && <span>{source.page_count} 页</span>}
                </div>
                <button
                  className="outline-button"
                  disabled={source.status === "processing"}
                  onClick={() => process(source)}
                >
                  {source.status === "completed" ? "重新处理" : "开始处理"}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

