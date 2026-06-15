---
name: cpa-source-ingest
description: Parse CPA Chinese textbooks and private teaching videos into traceable internal source material. Use when importing PDF textbooks, locating chapter pages, extracting OCR text or tables, or privately analyzing teaching videos without exposing playback, transcripts, or timestamps in the learning product.
---

# CPA Source Ingest

Treat the textbook as the primary factual source. Treat teaching videos only as private support for explanation style, examples, emphasis, and mistakes.

## Workflow

1. Record the source type, edition, exam year, filename, and processing status.
2. For textbooks, preserve PDF page numbers while extracting headings, paragraphs, tables, examples, and entries.
3. Prefer embedded OCR text. Use Docling for layout recovery and PaddleOCR only for pages with unusable text.
4. Locate chapter boundaries before sending chunks to an AI model.
5. For videos, extract audio and transcribe in private storage. Convert transcripts into structured teaching insights, then discard audio chunks.
6. Never return video transcripts, timestamps, playback URLs, or private storage paths through the product API.
7. Flag conflicts between teaching material and textbook content for human review. Do not let video content override the textbook.

Read [references/source-policy.md](references/source-policy.md) before changing source precedence or privacy behavior.

## Output

Produce textbook page chunks with exact PDF page numbers, or private video insights containing only related topic, plain-language approach, case idea, emphasis, mistakes, and possible conflicts.

