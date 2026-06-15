from pathlib import Path

from fastapi.testclient import TestClient

from app.config import get_settings
from app.db import transaction, utc_now
from app.main import app


def test_card_moves_from_draft_to_review_to_confirmed(tmp_path: Path):
    settings = get_settings()
    original_database = settings.database_path
    original_storage = settings.storage_path
    original_materials = settings.materials_path
    settings.database_path = tmp_path / "workflow.db"
    settings.storage_path = tmp_path / "data"
    settings.materials_path = tmp_path / "materials"
    settings.materials_path.mkdir()

    try:
        with TestClient(app) as client:
            now = utc_now()
            with transaction() as connection:
                cursor = connection.execute(
                    """
                    INSERT INTO sources(name, kind, file_path, status, created_at, updated_at)
                    VALUES ('textbook.pdf', 'textbook', 'textbook.pdf', 'completed', ?, ?)
                    """,
                    (now, now),
                )
                source_id = cursor.lastrowid
                point_id = connection.execute(
                    "SELECT id FROM knowledge_points ORDER BY id LIMIT 1"
                ).fetchone()["id"]
                connection.execute(
                    """
                    UPDATE knowledge_points
                    SET source_id = ?, source_page_start = 10, source_page_end = 10
                    WHERE id = ?
                    """,
                    (source_id, point_id),
                )

            submitted = client.post(f"/api/knowledge-points/{point_id}/submit-review")
            assert submitted.status_code == 200
            assert submitted.json()["status"] == "pending_review"

            confirmed = client.post(f"/api/knowledge-points/{point_id}/confirm")
            assert confirmed.status_code == 200
            assert confirmed.json()["status"] == "confirmed"
    finally:
        settings.database_path = original_database
        settings.storage_path = original_storage
        settings.materials_path = original_materials

