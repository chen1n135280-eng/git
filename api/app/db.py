import json
import sqlite3
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Iterator

from .config import get_settings


def utc_now() -> str:
    return datetime.now(UTC).isoformat()


def database_path() -> Path:
    path = get_settings().database_path
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def connect() -> sqlite3.Connection:
    connection = sqlite3.connect(database_path(), check_same_thread=False)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA journal_mode = WAL")
    return connection


@contextmanager
def transaction() -> Iterator[sqlite3.Connection]:
    connection = connect()
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


SCHEMA = """
CREATE TABLE IF NOT EXISTS sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    kind TEXT NOT NULL CHECK(kind IN ('textbook', 'teaching_video')),
    file_path TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending',
    page_count INTEGER,
    error TEXT,
    internal_metadata TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS processing_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'queued',
    stage TEXT NOT NULL DEFAULT '等待处理',
    progress INTEGER NOT NULL DEFAULT 0 CHECK(progress BETWEEN 0 AND 100),
    error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chapters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject TEXT NOT NULL DEFAULT '会计',
    title TEXT NOT NULL,
    number INTEGER NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL,
    UNIQUE(subject, number)
);

CREATE TABLE IF NOT EXISTS knowledge_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chapter_id INTEGER NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    standard_explanation TEXT NOT NULL,
    difficulty INTEGER NOT NULL CHECK(difficulty BETWEEN 1 AND 5),
    difficulty_reason TEXT NOT NULL,
    plain_explanation TEXT,
    teaching_case TEXT,
    mistakes TEXT NOT NULL DEFAULT '[]',
    prerequisites TEXT NOT NULL DEFAULT '[]',
    journal_entries TEXT NOT NULL DEFAULT '[]',
    source_id INTEGER REFERENCES sources(id) ON DELETE SET NULL,
    source_page_start INTEGER,
    source_page_end INTEGER,
    status TEXT NOT NULL DEFAULT 'ai_draft'
        CHECK(status IN ('ai_draft', 'pending_review', 'confirmed')),
    conflict_note TEXT,
    confidence REAL NOT NULL DEFAULT 0.0,
    framework_section TEXT,
    framework_topic TEXT,
    framework_section_order INTEGER,
    framework_topic_order INTEGER,
    textbook_difficulty TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(chapter_id, title)
);

CREATE TABLE IF NOT EXISTS review_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    knowledge_point_id INTEGER NOT NULL REFERENCES knowledge_points(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    details TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_points_chapter ON knowledge_points(chapter_id);
CREATE INDEX IF NOT EXISTS idx_points_status ON knowledge_points(status);
CREATE INDEX IF NOT EXISTS idx_jobs_source ON processing_jobs(source_id);
"""


JSON_FIELDS = {"mistakes", "prerequisites", "journal_entries", "internal_metadata"}


def init_db() -> None:
    with transaction() as connection:
        connection.executescript(SCHEMA)
        migrate_schema(connection)
    seed_database()


def migrate_schema(connection: sqlite3.Connection) -> None:
    columns = {
        row["name"]
        for row in connection.execute("PRAGMA table_info(knowledge_points)").fetchall()
    }
    additions = {
        "framework_section": "TEXT",
        "framework_topic": "TEXT",
        "framework_section_order": "INTEGER",
        "framework_topic_order": "INTEGER",
        "textbook_difficulty": "TEXT",
    }
    for name, definition in additions.items():
        if name not in columns:
            connection.execute(
                f"ALTER TABLE knowledge_points ADD COLUMN {name} {definition}"
            )


def rows_to_dicts(rows: list[sqlite3.Row]) -> list[dict[str, Any]]:
    return [row_to_dict(row) for row in rows]


def row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    result = dict(row)
    for field in JSON_FIELDS:
        if field in result:
            try:
                result[field] = json.loads(result[field] or "[]" if field != "internal_metadata" else result[field] or "{}")
            except json.JSONDecodeError:
                result[field] = {} if field == "internal_metadata" else []
    return result


def dump_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False)


def seed_database() -> None:
    from .seed import CHAPTER, DEMO_POINTS, SEED_VERSION

    now = utc_now()
    with transaction() as connection:
        connection.execute(
            """
            INSERT OR IGNORE INTO chapters(subject, title, number, summary, sort_order)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                CHAPTER["subject"],
                CHAPTER["title"],
                CHAPTER["number"],
                CHAPTER["summary"],
                CHAPTER["sort_order"],
            ),
        )
        chapter = connection.execute(
            "SELECT id FROM chapters WHERE subject = ? AND number = ?",
            (CHAPTER["subject"], CHAPTER["number"]),
        ).fetchone()
        current_version = connection.execute(
            "SELECT value FROM app_metadata WHERE key = 'chapter_16_seed_version'"
        ).fetchone()
        seed_version = int(current_version["value"]) if current_version else 0
        if 0 < seed_version < 3:
            connection.execute(
                "DELETE FROM knowledge_points WHERE chapter_id = ? AND status = 'ai_draft'",
                (chapter["id"],),
            )
        elif seed_version == 3:
            repurchase_point = next(
                point
                for point in DEMO_POINTS
                if point["title"] == "股份有限公司回购本公司股票"
            )
            connection.execute(
                """
                UPDATE knowledge_points
                SET category = ?, standard_explanation = ?, difficulty = ?,
                    difficulty_reason = ?, plain_explanation = ?, teaching_case = ?,
                    mistakes = ?, prerequisites = ?, journal_entries = ?,
                    source_page_start = ?, source_page_end = ?, confidence = ?,
                    updated_at = ?
                WHERE chapter_id = ? AND title = ? AND status = 'ai_draft'
                """,
                (
                    repurchase_point["category"],
                    repurchase_point["standard_explanation"],
                    repurchase_point["difficulty"],
                    repurchase_point["difficulty_reason"],
                    repurchase_point.get("plain_explanation"),
                    repurchase_point.get("teaching_case"),
                    dump_json(repurchase_point.get("mistakes", [])),
                    dump_json(repurchase_point.get("prerequisites", [])),
                    dump_json(repurchase_point.get("journal_entries", [])),
                    repurchase_point.get("source_page_start"),
                    repurchase_point.get("source_page_end"),
                    repurchase_point.get("confidence", 0.68),
                    now,
                    chapter["id"],
                    repurchase_point["title"],
                ),
            )

        textbook = connection.execute(
            "SELECT id FROM sources WHERE kind = 'textbook' ORDER BY id LIMIT 1"
        ).fetchone()
        for point in DEMO_POINTS:
            connection.execute(
                """
                INSERT OR IGNORE INTO knowledge_points(
                    chapter_id, title, category, standard_explanation, difficulty,
                    difficulty_reason, plain_explanation, teaching_case, mistakes,
                    prerequisites, journal_entries, source_id, source_page_start,
                    source_page_end, status, confidence, framework_section,
                    framework_topic, framework_section_order, framework_topic_order,
                    textbook_difficulty, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ai_draft', ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    chapter["id"],
                    point["title"],
                    point["category"],
                    point["standard_explanation"],
                    point["difficulty"],
                    point["difficulty_reason"],
                    point.get("plain_explanation"),
                    point.get("teaching_case"),
                    dump_json(point.get("mistakes", [])),
                    dump_json(point.get("prerequisites", [])),
                    dump_json(point.get("journal_entries", [])),
                    textbook["id"] if textbook else None,
                    point.get("source_page_start"),
                    point.get("source_page_end"),
                    point.get("confidence", 0.68),
                    point.get("framework_section"),
                    point.get("framework_topic"),
                    point.get("framework_section_order"),
                    point.get("framework_topic_order"),
                    point.get("textbook_difficulty"),
                    now,
                    now,
                ),
            )
        connection.execute(
            """
            INSERT INTO app_metadata(key, value) VALUES ('chapter_16_seed_version', ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
            """,
            (str(SEED_VERSION),),
        )
