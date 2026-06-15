import json
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated, Literal
from uuid import uuid4

from fastapi import BackgroundTasks, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .audit import audit_knowledge_point
from .config import get_settings
from .db import connect, dump_json, init_db, row_to_dict, rows_to_dicts, transaction, utc_now
from .pipeline import process_source
from .schemas import KnowledgePointUpdate


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings = get_settings()
    settings.storage_path.mkdir(parents=True, exist_ok=True)
    (settings.storage_path / "uploads").mkdir(parents=True, exist_ok=True)
    init_db()
    discover_workspace_materials()
    yield


app = FastAPI(title="CPA 理论学习 API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def discover_workspace_materials() -> None:
    root = get_settings().materials_path.resolve()
    if not root.exists():
        return
    now = utc_now()
    with transaction() as connection:
        for path in list(root.glob("*.pdf")) + list(root.glob("*.mp4")):
            kind = "textbook" if path.suffix.lower() == ".pdf" else "teaching_video"
            connection.execute(
                """
                INSERT OR IGNORE INTO sources(name, kind, file_path, status, created_at, updated_at)
                VALUES (?, ?, ?, 'pending', ?, ?)
                """,
                (path.name, kind, str(path.resolve()), now, now),
            )


def get_point_or_404(point_id: int) -> dict:
    connection = connect()
    row = connection.execute(
        """
        SELECT kp.*, c.title AS chapter_title, s.name AS source_name
        FROM knowledge_points kp
        JOIN chapters c ON c.id = kp.chapter_id
        LEFT JOIN sources s ON s.id = kp.source_id
        WHERE kp.id = ?
        """,
        (point_id,),
    ).fetchone()
    connection.close()
    if not row:
        raise HTTPException(status_code=404, detail="知识点不存在")
    point = row_to_dict(row)
    point["audit_errors"] = audit_knowledge_point(point)
    return point


@app.get("/health")
def health():
    return {"status": "ok", "ai_configured": bool(get_settings().openai_api_key)}


@app.get("/api/dashboard")
def dashboard():
    connection = connect()
    counts = connection.execute(
        """
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN status = 'ai_draft' THEN 1 ELSE 0 END) AS drafts,
          SUM(CASE WHEN status = 'pending_review' THEN 1 ELSE 0 END) AS pending,
          SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) AS confirmed,
          SUM(CASE WHEN difficulty >= 3 THEN 1 ELSE 0 END) AS complex
        FROM knowledge_points
        """
    ).fetchone()
    chapters = connection.execute(
        """
        SELECT c.*, COUNT(kp.id) AS point_count,
          SUM(CASE WHEN kp.status = 'confirmed' THEN 1 ELSE 0 END) AS confirmed_count
        FROM chapters c
        LEFT JOIN knowledge_points kp ON kp.chapter_id = c.id
        GROUP BY c.id ORDER BY c.sort_order
        """
    ).fetchall()
    jobs = connection.execute(
        """
        SELECT j.id, j.status, j.stage, j.progress, j.error, j.updated_at,
               s.kind, s.name AS source_name
        FROM processing_jobs j JOIN sources s ON s.id = j.source_id
        ORDER BY j.id DESC LIMIT 5
        """
    ).fetchall()
    connection.close()
    return {
        "counts": dict(counts),
        "chapters": rows_to_dicts(chapters),
        "recent_jobs": rows_to_dicts(jobs),
        "ai_configured": bool(get_settings().openai_api_key),
    }


@app.get("/api/chapters")
def chapters():
    connection = connect()
    rows = connection.execute(
        """
        SELECT c.*, COUNT(kp.id) AS point_count
        FROM chapters c LEFT JOIN knowledge_points kp ON kp.chapter_id = c.id
        GROUP BY c.id ORDER BY c.sort_order
        """
    ).fetchall()
    connection.close()
    return rows_to_dicts(rows)


@app.get("/api/chapters/{chapter_id}/knowledge-points")
def chapter_points(
    chapter_id: int,
    status: Literal["ai_draft", "pending_review", "confirmed"] | None = None,
    difficulty: Annotated[int | None, Query(ge=1, le=5)] = None,
):
    clauses = ["kp.chapter_id = ?"]
    values: list[object] = [chapter_id]
    if status:
        clauses.append("kp.status = ?")
        values.append(status)
    if difficulty:
        clauses.append("kp.difficulty = ?")
        values.append(difficulty)
    connection = connect()
    rows = connection.execute(
        f"""
        SELECT kp.*, s.name AS source_name
        FROM knowledge_points kp
        LEFT JOIN sources s ON s.id = kp.source_id
        WHERE {' AND '.join(clauses)}
        ORDER BY kp.framework_section_order, kp.framework_topic_order,
                 kp.source_page_start, kp.id
        """,
        values,
    ).fetchall()
    connection.close()
    points = rows_to_dicts(rows)
    for point in points:
        point["audit_errors"] = audit_knowledge_point(point)
    return points


@app.get("/api/knowledge-points/{point_id}")
def knowledge_point(point_id: int):
    return get_point_or_404(point_id)


@app.patch("/api/knowledge-points/{point_id}")
def update_knowledge_point(point_id: int, payload: KnowledgePointUpdate):
    get_point_or_404(point_id)
    data = payload.model_dump(exclude_unset=True)
    if not data:
        return get_point_or_404(point_id)
    json_fields = {"mistakes", "prerequisites", "journal_entries"}
    fields = []
    values = []
    for key, value in data.items():
        fields.append(f"{key} = ?")
        if key in json_fields:
            value = dump_json(
                [item.model_dump() if hasattr(item, "model_dump") else item for item in value]
            )
        values.append(value)
    fields.extend(["status = 'ai_draft'", "updated_at = ?"])
    values.extend([utc_now(), point_id])
    with transaction() as connection:
        connection.execute(
            f"UPDATE knowledge_points SET {', '.join(fields)} WHERE id = ?",
            values,
        )
        connection.execute(
            """
            INSERT INTO review_events(knowledge_point_id, action, details, created_at)
            VALUES (?, 'edited', ?, ?)
            """,
            (point_id, dump_json({"fields": list(data)}), utc_now()),
        )
    return get_point_or_404(point_id)


@app.post("/api/knowledge-points/{point_id}/submit-review")
def submit_review(point_id: int):
    point = get_point_or_404(point_id)
    errors = audit_knowledge_point(point)
    if errors:
        raise HTTPException(status_code=422, detail={"message": "知识卡尚未满足审核条件", "errors": errors})
    with transaction() as connection:
        connection.execute(
            "UPDATE knowledge_points SET status = 'pending_review', updated_at = ? WHERE id = ?",
            (utc_now(), point_id),
        )
        connection.execute(
            "INSERT INTO review_events(knowledge_point_id, action, created_at) VALUES (?, 'submitted', ?)",
            (point_id, utc_now()),
        )
    return get_point_or_404(point_id)


@app.post("/api/knowledge-points/{point_id}/confirm")
def confirm_point(point_id: int):
    point = get_point_or_404(point_id)
    if point["status"] != "pending_review":
        raise HTTPException(status_code=409, detail="只有待审核知识卡可以确认")
    errors = audit_knowledge_point(point)
    if errors:
        raise HTTPException(status_code=422, detail={"message": "知识卡未通过审校", "errors": errors})
    with transaction() as connection:
        connection.execute(
            "UPDATE knowledge_points SET status = 'confirmed', updated_at = ? WHERE id = ?",
            (utc_now(), point_id),
        )
        connection.execute(
            "INSERT INTO review_events(knowledge_point_id, action, created_at) VALUES (?, 'confirmed', ?)",
            (point_id, utc_now()),
        )
    return get_point_or_404(point_id)


@app.get("/api/sources")
def sources():
    connection = connect()
    rows = connection.execute(
        """
        SELECT s.id, s.name, s.kind, s.status, s.page_count, s.error,
               s.created_at, s.updated_at,
               (SELECT COUNT(*) FROM processing_jobs j WHERE j.source_id = s.id) AS job_count
        FROM sources s ORDER BY s.kind, s.id
        """
    ).fetchall()
    connection.close()
    return rows_to_dicts(rows)


@app.post("/api/sources/upload")
async def upload_source(
    file: Annotated[UploadFile, File()],
    kind: Annotated[Literal["textbook", "teaching_video"], Query()],
):
    suffix = Path(file.filename or "").suffix.lower()
    allowed = {".pdf"} if kind == "textbook" else {".mp4", ".mov", ".m4v", ".webm"}
    if suffix not in allowed:
        raise HTTPException(status_code=415, detail=f"不支持的文件类型：{suffix}")

    safe_name = Path(file.filename or f"upload{suffix}").name
    destination = get_settings().storage_path / "uploads" / f"{uuid4().hex[:8]}-{safe_name}"
    size = 0
    with destination.open("wb") as output:
        while chunk := await file.read(1024 * 1024):
            size += len(chunk)
            if size > get_settings().max_upload_mb * 1024 * 1024:
                output.close()
                destination.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail="文件超过上传大小限制")
            output.write(chunk)

    now = utc_now()
    with transaction() as connection:
        cursor = connection.execute(
            """
            INSERT INTO sources(name, kind, file_path, status, created_at, updated_at)
            VALUES (?, ?, ?, 'pending', ?, ?)
            """,
            (safe_name, kind, str(destination.resolve()), now, now),
        )
        source_id = cursor.lastrowid
    return {"id": source_id, "name": safe_name, "kind": kind, "status": "pending"}


@app.post("/api/sources/{source_id}/process")
def start_processing(source_id: int, background_tasks: BackgroundTasks):
    connection = connect()
    source = connection.execute("SELECT id FROM sources WHERE id = ?", (source_id,)).fetchone()
    connection.close()
    if not source:
        raise HTTPException(status_code=404, detail="资料不存在")
    now = utc_now()
    with transaction() as connection:
        running = connection.execute(
            """
            SELECT id FROM processing_jobs
            WHERE source_id = ? AND status IN ('queued', 'running')
            """,
            (source_id,),
        ).fetchone()
        if running:
            raise HTTPException(status_code=409, detail="该资料正在处理中")
        cursor = connection.execute(
            """
            INSERT INTO processing_jobs(source_id, status, stage, progress, created_at, updated_at)
            VALUES (?, 'queued', '等待处理', 0, ?, ?)
            """,
            (source_id, now, now),
        )
        job_id = cursor.lastrowid
        connection.execute(
            "UPDATE sources SET status = 'processing', error = NULL, updated_at = ? WHERE id = ?",
            (now, source_id),
        )
    background_tasks.add_task(process_source, job_id, source_id)
    return {"job_id": job_id, "status": "queued"}


@app.get("/api/jobs")
def jobs():
    connection = connect()
    rows = connection.execute(
        """
        SELECT j.*, s.name AS source_name, s.kind
        FROM processing_jobs j JOIN sources s ON s.id = j.source_id
        ORDER BY j.id DESC
        """
    ).fetchall()
    connection.close()
    return rows_to_dicts(rows)
