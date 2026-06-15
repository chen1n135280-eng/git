"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { KnowledgePoint } from "@/lib/types";
import { Loading, Stars, StatusBadge } from "@/components/ui";

export default function ReviewPage() {
  const [points, setPoints] = useState<KnowledgePoint[]>([]);
  const [selected, setSelected] = useState<KnowledgePoint | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const load = () =>
    api<KnowledgePoint[]>("/api/chapters/1/knowledge-points")
      .then((data) => {
        setPoints(data);
        if (selected) setSelected(data.find((item) => item.id === selected.id) ?? null);
      })
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function transition(action: "submit-review" | "confirm", point: KnowledgePoint) {
    try {
      await api(`/api/knowledge-points/${point.id}/${action}`, { method: "POST" });
      setMessage(action === "confirm" ? "知识卡已确认" : "已提交人工审核");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作失败");
    }
  }

  if (loading) return <Loading />;

  return (
    <div className="page review-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">人工把关</span>
          <h1>内容审核台</h1>
          <p>AI负责初稿，最终内容由你确认。</p>
        </div>
        <div className="review-legend">
          <span><i className="dot draft" /> AI草稿</span>
          <span><i className="dot pending" /> 待审核</span>
          <span><i className="dot confirmed" /> 已确认</span>
        </div>
      </header>

      {message && <button className="toast" onClick={() => setMessage("")}>{message}</button>}

      <div className="review-table-wrap">
        <table className="review-table">
          <thead>
            <tr>
              <th>知识点</th>
              <th>分类</th>
              <th>难度</th>
              <th>教材来源</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.id}>
                <td>
                  <strong>{point.title}</strong>
                  {point.audit_errors.length > 0 && <small>{point.audit_errors.length} 项待完善</small>}
                </td>
                <td>{point.category}</td>
                <td><Stars value={point.difficulty} /></td>
                <td>{point.source_page_start ? `第 ${point.source_page_start} 页` : "未定位"}</td>
                <td><StatusBadge status={point.status} /></td>
                <td className="table-actions">
                  <button onClick={() => setSelected(point)}>编辑</button>
                  {point.status === "ai_draft" && (
                    <button disabled={point.audit_errors.length > 0} onClick={() => transition("submit-review", point)}>
                      提交
                    </button>
                  )}
                  {point.status === "pending_review" && (
                    <button className="primary-mini" onClick={() => transition("confirm", point)}>确认</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <EditDrawer
          point={selected}
          onClose={() => setSelected(null)}
          onSaved={async () => {
            setSelected(null);
            setMessage("修改已保存，状态回到AI草稿");
            await load();
          }}
        />
      )}
    </div>
  );
}

function EditDrawer({
  point,
  onClose,
  onSaved,
}: {
  point: KnowledgePoint;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const payload = {
      title: form.get("title"),
      category: form.get("category"),
      difficulty: Number(form.get("difficulty")),
      difficulty_reason: form.get("difficulty_reason"),
      standard_explanation: form.get("standard_explanation"),
      plain_explanation: form.get("plain_explanation"),
      teaching_case: form.get("teaching_case"),
      mistakes: String(form.get("mistakes") ?? "").split("\n").map((item) => item.trim()).filter(Boolean),
      prerequisites: String(form.get("prerequisites") ?? "").split("\n").map((item) => item.trim()).filter(Boolean),
      source_page_start: Number(form.get("source_page_start")) || null,
      source_page_end: Number(form.get("source_page_end")) || null,
      conflict_note: form.get("conflict_note") || null,
    };
    try {
      await api(`/api/knowledge-points/${point.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      await onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="drawer-backdrop" onMouseDown={onClose}>
      <aside className="edit-drawer" onMouseDown={(event) => event.stopPropagation()}>
        <div className="drawer-heading">
          <div>
            <span className="eyebrow">编辑知识卡</span>
            <h2>{point.title}</h2>
          </div>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        <form onSubmit={submit}>
          <label>知识点标题<input defaultValue={point.title} name="title" required /></label>
          <div className="form-row">
            <label>分类
              <select defaultValue={point.category} name="category">
                {["概念", "确认条件", "计量规则", "会计处理", "会计分录", "列报", "例外情况", "易错点"].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label>难度
              <select defaultValue={point.difficulty} name="difficulty">
                {[1, 2, 3, 4, 5].map((item) => <option key={item} value={item}>{item} 星</option>)}
              </select>
            </label>
          </div>
          <label>难度理由<input defaultValue={point.difficulty_reason} name="difficulty_reason" required /></label>
          <label>标准解释<textarea defaultValue={point.standard_explanation} name="standard_explanation" required rows={5} /></label>
          <label>大白话解释<textarea defaultValue={point.plain_explanation ?? ""} name="plain_explanation" rows={4} /></label>
          <label>教学案例<textarea defaultValue={point.teaching_case ?? ""} name="teaching_case" rows={5} /></label>
          <div className="form-row">
            <label>教材起始页<input defaultValue={point.source_page_start ?? ""} name="source_page_start" type="number" /></label>
            <label>教材结束页<input defaultValue={point.source_page_end ?? ""} name="source_page_end" type="number" /></label>
          </div>
          <label>易错点（每行一项）<textarea defaultValue={point.mistakes.join("\n")} name="mistakes" rows={4} /></label>
          <label>前置知识（每行一项）<textarea defaultValue={point.prerequisites.join("\n")} name="prerequisites" rows={3} /></label>
          <label>冲突或审核备注<textarea defaultValue={point.conflict_note ?? ""} name="conflict_note" rows={3} /></label>
          {error && <p className="form-error">{error}</p>}
          <div className="drawer-actions">
            <button type="button" onClick={onClose}>取消</button>
            <button className="primary" disabled={saving} type="submit">{saving ? "保存中…" : "保存修改"}</button>
          </div>
        </form>
      </aside>
    </div>
  );
}

