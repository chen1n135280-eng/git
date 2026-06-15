import re
from typing import Literal

from pydantic import BaseModel, Field, model_validator


class JournalLine(BaseModel):
    account: str
    direction: Literal["debit", "credit"]
    amount: float = Field(ge=0)


class JournalEntry(BaseModel):
    label: str = "会计分录"
    lines: list[JournalLine] = Field(default_factory=list)


class KnowledgePointDraft(BaseModel):
    title: str
    category: Literal["概念", "确认条件", "计量规则", "会计处理", "会计分录", "列报", "例外情况", "易错点"]
    standard_explanation: str
    difficulty: int = Field(ge=1, le=5)
    difficulty_reason: str
    plain_explanation: str | None = None
    teaching_case: str | None = None
    mistakes: list[str] = Field(default_factory=list)
    prerequisites: list[str] = Field(default_factory=list)
    journal_entries: list[JournalEntry] = Field(default_factory=list)
    source_page_start: int | None = None
    source_page_end: int | None = None
    conflict_note: str | None = None
    confidence: float = Field(default=0.0, ge=0, le=1)

    @model_validator(mode="after")
    def require_explanation_for_complex_points(self):
        if not self.plain_explanation or not self.teaching_case or not self.mistakes:
            raise ValueError("知识点必须包含大白话解释、教学案例和易错点")
        if not re.search(r"\d", self.teaching_case):
            raise ValueError("教学案例必须包含具体数字")
        return self


class KnowledgePointBatch(BaseModel):
    chapter_title: str
    points: list[KnowledgePointDraft]


class KnowledgePointUpdate(BaseModel):
    title: str | None = None
    category: str | None = None
    standard_explanation: str | None = None
    difficulty: int | None = Field(default=None, ge=1, le=5)
    difficulty_reason: str | None = None
    plain_explanation: str | None = None
    teaching_case: str | None = None
    mistakes: list[str] | None = None
    prerequisites: list[str] | None = None
    journal_entries: list[JournalEntry] | None = None
    source_page_start: int | None = None
    source_page_end: int | None = None
    conflict_note: str | None = None


class VideoInsight(BaseModel):
    related_topic: str
    plain_explanation: str | None = None
    case_idea: str | None = None
    emphasis: list[str] = Field(default_factory=list)
    mistakes: list[str] = Field(default_factory=list)
    conflicts_with_textbook: list[str] = Field(default_factory=list)


class VideoInsightBatch(BaseModel):
    insights: list[VideoInsight]


class VideoEnrichment(BaseModel):
    knowledge_point_id: int
    plain_explanation: str
    teaching_case: str
    mistakes: list[str] = Field(default_factory=list)
    conflict_note: str | None = None

    @model_validator(mode="after")
    def label_generated_case(self):
        if not self.teaching_case.startswith("教学案例："):
            self.teaching_case = f"教学案例：{self.teaching_case}"
        if not re.search(r"\d", self.teaching_case):
            raise ValueError("教学案例必须包含具体数字")
        return self


class VideoEnrichmentBatch(BaseModel):
    enrichments: list[VideoEnrichment]
