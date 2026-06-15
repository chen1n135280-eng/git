from pathlib import Path

from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app


def test_source_api_does_not_expose_private_video_data(tmp_path: Path):
    settings = get_settings()
    original_database = settings.database_path
    original_storage = settings.storage_path
    original_materials = settings.materials_path
    settings.database_path = tmp_path / "test.db"
    settings.storage_path = tmp_path / "data"
    settings.materials_path = tmp_path / "materials"
    settings.materials_path.mkdir()
    (settings.materials_path / "teacher.mp4").write_bytes(b"private")

    try:
        with TestClient(app) as client:
            response = client.get("/api/sources")
            assert response.status_code == 200
            payload = response.json()
            video = next(item for item in payload if item["kind"] == "teaching_video")
            assert "file_path" not in video
            assert "internal_metadata" not in video
            assert "transcript" not in video
            assert "timestamp" not in video
    finally:
        settings.database_path = original_database
        settings.storage_path = original_storage
        settings.materials_path = original_materials

