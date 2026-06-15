import json
import re
import shutil
import subprocess
from pathlib import Path

import imageio_ffmpeg
from pypdf import PdfReader

from . import ai
from .config import get_settings
from .db import connect, dump_json, transaction, utc_now


CHAPTER_PATTERN = re.compile(r"第\s*十六\s*章|第\s*16\s*章")


def is_chapter_16_start(compact_text: str) -> bool:
    page_heading = compact_text[:80]
    return page_heading.startswith(("第十六章所有者权益", "第16章所有者权益"))


def is_chapter_17_start(compact_text: str) -> bool:
    return re.search(r"第\s*(十七|17)\s*章", compact_text[:80]) is not None


def update_job(job_id: int, *, status: str | None = None, stage: str | None = None,
               progress: int | None = None, error: str | None = None) -> None:
    fields: list[str] = ["updated_at = ?"]
    values: list[object] = [utc_now()]
    for key, value in (
        ("status", status),
        ("stage", stage),
        ("progress", progress),
        ("error", error),
    ):
        if value is not None:
            fields.append(f"{key} = ?")
            values.append(value)
    values.append(job_id)
    with transaction() as connection:
        connection.execute(
            f"UPDATE processing_jobs SET {', '.join(fields)} WHERE id = ?",
            values,
        )


def process_source(job_id: int, source_id: int) -> None:
    connection = connect()
    source = connection.execute("SELECT * FROM sources WHERE id = ?", (source_id,)).fetchone()
    connection.close()
    if not source:
        update_job(job_id, status="failed", error="资料不存在")
        return

    try:
        update_job(job_id, status="running", stage="读取资料", progress=5)
        if source["kind"] == "textbook":
            process_pdf(job_id, dict(source))
        else:
            process_video(job_id, dict(source))
        update_job(job_id, status="completed", stage="处理完成", progress=100)
        with transaction() as connection:
            connection.execute(
                "UPDATE sources SET status = 'completed', error = NULL, updated_at = ? WHERE id = ?",
                (utc_now(), source_id),
            )
    except Exception as exc:
        update_job(job_id, status="failed", stage="处理失败", error=str(exc))
        with transaction() as connection:
            connection.execute(
                "UPDATE sources SET status = 'failed', error = ?, updated_at = ? WHERE id = ?",
                (str(exc), utc_now(), source_id),
            )


def process_pdf(job_id: int, source: dict) -> None:
    path = Path(source["file_path"])
    reader = PdfReader(path)
    if reader.is_encrypted:
        reader.decrypt("")

    private_dir = get_settings().storage_path / "private" / "textbooks"
    private_dir.mkdir(parents=True, exist_ok=True)
    output_path = private_dir / f"{source['id']}.jsonl"
    chapter_pages: list[tuple[int, str]] = []
    inside_chapter = False
    total = len(reader.pages)

    with output_path.open("w", encoding="utf-8") as output:
        for index, page in enumerate(reader.pages, start=1):
            text = page.extract_text() or ""
            output.write(json.dumps({"page": index, "text": text}, ensure_ascii=False) + "\n")

            compact = re.sub(r"\s+", "", text)
            if is_chapter_16_start(compact):
                inside_chapter = True
            elif inside_chapter and is_chapter_17_start(compact):
                inside_chapter = False
            if inside_chapter:
                chapter_pages.append((index, text))

            if index % 25 == 0:
                update_job(
                    job_id,
                    stage=f"解析教材第 {index}/{total} 页",
                    progress=min(55, 5 + int(index / max(total, 1) * 50)),
                )

    metadata = {
        "private_text_path": str(output_path),
        "chapter_16_pages": [page for page, _ in chapter_pages],
    }
    with transaction() as connection:
        connection.execute(
            """
            UPDATE sources SET page_count = ?, internal_metadata = ?, status = 'processing',
            updated_at = ? WHERE id = ?
            """,
            (total, dump_json(metadata), utc_now(), source["id"]),
        )

    if not chapter_pages:
        raise RuntimeError("未能在教材中定位第十六章，请在资料页检查OCR文本")

    if not ai.configured():
        update_job(job_id, stage="教材已解析，等待配置AI生成知识点", progress=90)
        attach_textbook_pages_to_seed(source["id"], chapter_pages)
        return

    update_job(job_id, stage="AI拆解第十六章知识点", progress=65)
    batches = chunk_pages(chapter_pages, 15000)
    for batch_index, batch in enumerate(batches, start=1):
        result = ai.extract_knowledge_points(batch)
        upsert_knowledge_points(source["id"], result.points)
        update_job(
            job_id,
            stage=f"生成知识卡 {batch_index}/{len(batches)}",
            progress=65 + int(batch_index / len(batches) * 30),
        )


def attach_textbook_pages_to_seed(source_id: int, chapter_pages: list[tuple[int, str]]) -> None:
    from .seed import DEMO_POINTS

    chapter_page_numbers = {page_number for page_number, _ in chapter_pages}
    canonical_pages = {
        point["title"]: (
            point["source_page_start"],
            point.get("source_page_end", point["source_page_start"]),
        )
        for point in DEMO_POINTS
    }
    with transaction() as connection:
        points = connection.execute(
            """
            SELECT id, title FROM knowledge_points
            WHERE status = 'ai_draft'
              AND chapter_id = (SELECT id FROM chapters WHERE number = 16 AND subject = '会计')
            """
        ).fetchall()
        for point in points:
            page_start, page_end = canonical_pages.get(
                point["title"],
                (chapter_pages[0][0], chapter_pages[-1][0]),
            )
            if page_start not in chapter_page_numbers or page_end not in chapter_page_numbers:
                raise RuntimeError(f"知识点“{point['title']}”的教材页码不在第十六章范围内")
            connection.execute(
                """
                UPDATE knowledge_points
                SET source_id = ?, source_page_start = ?, source_page_end = ?, updated_at = ?
                WHERE id = ?
                """,
                (source_id, page_start, page_end, utc_now(), point["id"]),
            )


def chunk_pages(pages: list[tuple[int, str]], max_chars: int) -> list[list[tuple[int, str]]]:
    batches: list[list[tuple[int, str]]] = []
    current: list[tuple[int, str]] = []
    size = 0
    for page in pages:
        if current and size + len(page[1]) > max_chars:
            batches.append(current)
            current = []
            size = 0
        current.append(page)
        size += len(page[1])
    if current:
        batches.append(current)
    return batches


def upsert_knowledge_points(source_id: int, points: list) -> None:
    with transaction() as connection:
        chapter = connection.execute(
            "SELECT id FROM chapters WHERE number = 16 AND subject = '会计'"
        ).fetchone()
        for point in points:
            data = point.model_dump()
            connection.execute(
                """
                INSERT INTO knowledge_points(
                    chapter_id, title, category, standard_explanation, difficulty,
                    difficulty_reason, plain_explanation, teaching_case, mistakes,
                    prerequisites, journal_entries, source_id, source_page_start,
                    source_page_end, status, conflict_note, confidence, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ai_draft', ?, ?, ?, ?)
                ON CONFLICT(chapter_id, title) DO UPDATE SET
                    category=excluded.category,
                    standard_explanation=excluded.standard_explanation,
                    difficulty=excluded.difficulty,
                    difficulty_reason=excluded.difficulty_reason,
                    plain_explanation=excluded.plain_explanation,
                    teaching_case=excluded.teaching_case,
                    mistakes=excluded.mistakes,
                    prerequisites=excluded.prerequisites,
                    journal_entries=excluded.journal_entries,
                    source_id=excluded.source_id,
                    source_page_start=excluded.source_page_start,
                    source_page_end=excluded.source_page_end,
                    conflict_note=excluded.conflict_note,
                    confidence=excluded.confidence,
                    status='ai_draft',
                    updated_at=excluded.updated_at
                """,
                (
                    chapter["id"], data["title"], data["category"],
                    data["standard_explanation"], data["difficulty"],
                    data["difficulty_reason"], data["plain_explanation"],
                    data["teaching_case"], dump_json(data["mistakes"]),
                    dump_json(data["prerequisites"]), dump_json(data["journal_entries"]),
                    source_id, data["source_page_start"], data["source_page_end"],
                    data["conflict_note"], data["confidence"], utc_now(), utc_now(),
                ),
            )


def process_video(job_id: int, source: dict) -> None:
    if not ai.configured():
        raise RuntimeError("视频后台学习需要配置 OPENAI_API_KEY")

    private_dir = get_settings().storage_path / "private" / "video-insights" / str(source["id"])
    private_dir.mkdir(parents=True, exist_ok=True)
    pattern = private_dir / "audio-%03d.mp3"
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    update_job(job_id, stage="提取并切分音频", progress=15)
    subprocess.run(
        [
            ffmpeg, "-y", "-i", source["file_path"], "-vn", "-ac", "1", "-ar", "16000",
            "-b:a", "48k", "-f", "segment", "-segment_time", "900", str(pattern),
        ],
        check=True,
        capture_output=True,
    )

    audio_files = sorted(private_dir.glob("audio-*.mp3"))
    if not audio_files:
        raise RuntimeError("未能从教学素材中提取音频")

    insights = []
    for index, audio_path in enumerate(audio_files, start=1):
        transcript = ai.transcribe_audio(str(audio_path))
        batch = ai.extract_video_insights(transcript)
        insights.extend(item.model_dump() for item in batch.insights)
        update_job(
            job_id,
            stage=f"后台理解教学素材 {index}/{len(audio_files)}",
            progress=20 + int(index / len(audio_files) * 70),
        )

    insight_path = private_dir / "insights.json"
    insight_path.write_text(json.dumps(insights, ensure_ascii=False, indent=2), encoding="utf-8")
    apply_video_insights(insights)
    for audio_path in audio_files:
        audio_path.unlink(missing_ok=True)

    metadata = {"private_insights_path": str(insight_path), "insight_count": len(insights)}
    with transaction() as connection:
        connection.execute(
            """
            UPDATE sources SET internal_metadata = ?, status = 'processing', updated_at = ?
            WHERE id = ?
            """,
            (dump_json(metadata), utc_now(), source["id"]),
        )


def apply_video_insights(insights: list[dict]) -> None:
    if not insights:
        return
    connection = connect()
    rows = connection.execute(
        """
        SELECT id, title, standard_explanation, difficulty, difficulty_reason,
               plain_explanation, teaching_case, mistakes, prerequisites
        FROM knowledge_points
        WHERE difficulty >= 3
          AND chapter_id = (SELECT id FROM chapters WHERE number = 16 AND subject = '会计')
        ORDER BY id
        """
    ).fetchall()
    connection.close()
    points = []
    for row in rows:
        point = dict(row)
        point["mistakes"] = json.loads(point["mistakes"] or "[]")
        point["prerequisites"] = json.loads(point["prerequisites"] or "[]")
        points.append(point)

    batch = ai.enrich_knowledge_points(points, insights)
    allowed_ids = {point["id"] for point in points}
    with transaction() as connection:
        for enrichment in batch.enrichments:
            if enrichment.knowledge_point_id not in allowed_ids:
                continue
            current = connection.execute(
                "SELECT mistakes, conflict_note FROM knowledge_points WHERE id = ?",
                (enrichment.knowledge_point_id,),
            ).fetchone()
            mistakes = list(dict.fromkeys(
                json.loads(current["mistakes"] or "[]") + enrichment.mistakes
            ))
            conflict_parts = [
                part for part in (current["conflict_note"], enrichment.conflict_note) if part
            ]
            connection.execute(
                """
                UPDATE knowledge_points
                SET plain_explanation = ?, teaching_case = ?, mistakes = ?,
                    conflict_note = ?, status = 'ai_draft', updated_at = ?
                WHERE id = ?
                """,
                (
                    enrichment.plain_explanation,
                    enrichment.teaching_case,
                    dump_json(mistakes),
                    "\n".join(dict.fromkeys(conflict_parts)) or None,
                    utc_now(),
                    enrichment.knowledge_point_id,
                ),
            )


def copy_upload(source_path: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    with source_path.open("rb") as source, destination.open("wb") as target:
        shutil.copyfileobj(source, target, length=1024 * 1024)
