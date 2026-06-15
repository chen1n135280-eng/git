---
name: cpa-content-auditor
description: Audit CPA theory cards before human review or publication. Use when checking textbook traceability, high-difficulty teaching completeness, journal-entry balance, source conflicts, status transitions, or whether a card is ready to move from AI draft to pending review and confirmed.
---

# CPA Content Auditor

Block publication when evidence or teaching content is incomplete.

## Audit

1. Require a standard explanation and difficulty reason.
2. Require a textbook source ID and PDF page number.
3. For 3-star or higher points, require a plain-language explanation, teaching case, and at least one mistake.
4. Validate each journal entry independently: total debits must equal total credits.
5. Ensure generated cases are labeled `教学案例`.
6. Flag unresolved textbook/video conflicts.
7. Allow only `AI草稿 → 待审核 → 已确认`.
8. Return a concrete error list. Do not silently repair factual content during audit.

