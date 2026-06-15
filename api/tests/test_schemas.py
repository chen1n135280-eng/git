import pytest
from pydantic import ValidationError

from app.schemas import KnowledgePointDraft, VideoEnrichment


def test_every_point_requires_plain_language_case_and_mistakes():
    with pytest.raises(ValidationError):
        KnowledgePointDraft(
            title="简单知识点",
            category="概念",
            standard_explanation="标准解释",
            difficulty=2,
            difficulty_reason="单一规则",
            source_page_start=10,
        )


def test_teaching_case_requires_a_number():
    with pytest.raises(ValidationError):
        KnowledgePointDraft(
            title="简单知识点",
            category="概念",
            standard_explanation="标准解释",
            difficulty=2,
            difficulty_reason="单一规则",
            plain_explanation="通俗解释",
            teaching_case="教学案例：甲公司收到一笔投资。",
            mistakes=["混淆科目"],
            source_page_start=10,
        )


def test_complete_beginner_point_is_valid():
    point = KnowledgePointDraft(
        title="简单知识点",
        category="概念",
        standard_explanation="标准解释",
        difficulty=2,
        difficulty_reason="单一规则",
        plain_explanation="通俗解释",
        teaching_case="教学案例：甲公司收到投资100万元。",
        mistakes=["混淆科目"],
        source_page_start=10,
    )
    assert point.difficulty == 2


def test_video_enrichment_labels_generated_numeric_case():
    enrichment = VideoEnrichment(
        knowledge_point_id=1,
        plain_explanation="通俗解释",
        teaching_case="甲公司发行100万元的工具。",
        mistakes=["只看工具名称"],
    )
    assert enrichment.teaching_case.startswith("教学案例：")

