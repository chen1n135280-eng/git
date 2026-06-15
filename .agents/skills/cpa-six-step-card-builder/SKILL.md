---
name: cpa-six-step-card-builder
description: Convert CPA textbook knowledge cards into six-step, switch-based interactive learning flows. Use when creating or revising CPA theory cards so learners must judge before seeing answers, receive causal feedback, study a worked numerical example, complete a faded independent task, and finish with a comparison question.
---

# CPA Six-Step Card Builder

Build one active-learning flow per minimal CPA knowledge point. Preserve textbook accuracy and page traceability.

## Workflow

1. Read the card's textbook rule, plain explanation, numerical teaching case, mistakes, prerequisites, and journal entries.
2. Select the card pattern from [references/card-patterns.md](references/card-patterns.md).
3. Produce exactly six switch-based modules:
   1. prior-knowledge judgment;
   2. one-sentence rule, causal explanation, and collapsible textbook wording;
   3. case-first questions with the answer hidden;
   4. answer, error-specific feedback, teaching case, and balanced entries;
   5. complete example followed by a replacement independent task; hide the example after advancing;
   6. comparison or boundary question.
4. Show one module at a time. Preserve answers when moving backward.
5. Require an answer before advancing from modules 1, 3, and 5.
6. Provide `上一步` and `下一步` navigation. Do not add a seventh module.
7. Keep source and review metadata outside the six learning modules.

## Content Rules

- Make every question specific to the knowledge point. Never use generic filler such as “哪项说法正确”.
- Delay answers until the learner submits or advances to the feedback module.
- Preserve recognition conditions, exceptions, measurement bases, and accounting timing.
- Label invented cases with `教学案例：`.
- Include concrete numbers in each teaching case.
- Explain why each distractor is wrong.
- For journal entries, balance every entry independently.
- In module 5, change both the numbers and at least one surface detail. Do not merely repeat the worked example.
- Use comparison questions to test the nearest confusable rule, prerequisite, exception, or accounting stage.

## Validation

Reject a flow when:

- any module is missing or a seventh module exists;
- the case reveals its answer before submission;
- an independent task remains visible beside its worked example;
- a distractor is implausible or unrelated;
- a numerical answer conflicts with the displayed entry;
- debit and credit totals differ;
- the flow weakens or changes the textbook rule.

