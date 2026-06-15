from collections import defaultdict
import re
from typing import Any


def audit_knowledge_point(point: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    difficulty = int(point.get("difficulty") or 0)

    if not point.get("standard_explanation", "").strip():
        errors.append("缺少标准解释")
    if not point.get("difficulty_reason", "").strip():
        errors.append("缺少难度理由")
    if not point.get("source_id") or not point.get("source_page_start"):
        errors.append("缺少教材来源页码")
    if not (point.get("plain_explanation") or "").strip():
        errors.append("缺少面向初学者的大白话解释")
    teaching_case = (point.get("teaching_case") or "").strip()
    if not teaching_case:
        errors.append("缺少教学案例")
    elif not re.search(r"\d", teaching_case):
        errors.append("教学案例必须包含具体数字")
    if not point.get("mistakes"):
        errors.append("缺少易错点")

    for entry in point.get("journal_entries") or []:
        totals: dict[str, float] = defaultdict(float)
        for line in entry.get("lines", []):
            totals[line.get("direction", "")] += float(line.get("amount") or 0)
        if round(totals["debit"], 2) != round(totals["credit"], 2):
            label = entry.get("label") or "会计分录"
            errors.append(f"{label}借贷不平衡")

    return errors
