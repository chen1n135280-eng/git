from collections.abc import Iterable
import json

from openai import OpenAI

from .config import get_settings
from .schemas import KnowledgePointBatch, VideoEnrichmentBatch, VideoInsightBatch


TEXTBOOK_SYSTEM_PROMPT = """
你是严谨的中国CPA会计教材编辑。教材片段是事实主来源。
将内容拆为最小可学习知识单元，分类只能从给定枚举中选择。
难度按以下量表评定：
1星定义或事实；2星单一规则；3星多步骤、分录或常见例外；
4星多个条件、综合判断或高频混淆；5星跨知识点综合应用或复杂职业判断。
3星及以上必须提供大白话解释、明确标为“教学案例”的分步骤案例和易错点。
不要编造准则条文、页码或教材结论。source_page_start/end 必须来自输入页码。
如片段不足以支持结论，省略该知识点。
""".strip()


VIDEO_SYSTEM_PROMPT = """
你只分析老师的讲解方式，不把视频作为会计规则的最终依据。
提取大白话解释、案例思路、强调重点和易错点。
如发现讲解可能与教材冲突，写入 conflicts_with_textbook，不要自行裁决。
不要输出时间戳、逐字稿或视频元数据。
""".strip()


VIDEO_ENRICHMENT_PROMPT = """
教材知识卡是事实权威，视频要点只能改善教学表达。
只处理难度3星及以上且视频确实覆盖的知识点。
不得修改标准解释、难度、教材来源或会计结论。
可重写大白话解释、生成明确标注“教学案例：”的案例并补充易错点。
视频与知识卡存在冲突时，不要采纳冲突内容，将问题写入 conflict_note。
knowledge_point_id 必须使用输入中的真实ID。
""".strip()


def configured() -> bool:
    return bool(get_settings().openai_api_key)


def client() -> OpenAI:
    settings = get_settings()
    if not settings.openai_api_key:
        raise RuntimeError("未配置 OPENAI_API_KEY")
    return OpenAI(api_key=settings.openai_api_key)


def extract_knowledge_points(pages: Iterable[tuple[int, str]]) -> KnowledgePointBatch:
    settings = get_settings()
    payload = "\n\n".join(
        f"--- 教材PDF第 {page_number} 页 ---\n{text}"
        for page_number, text in pages
    )
    response = client().responses.parse(
        model=settings.openai_text_model,
        input=[
            {"role": "system", "content": TEXTBOOK_SYSTEM_PROMPT},
            {"role": "user", "content": payload},
        ],
        text_format=KnowledgePointBatch,
    )
    return response.output_parsed


def extract_video_insights(transcript: str) -> VideoInsightBatch:
    settings = get_settings()
    response = client().responses.parse(
        model=settings.openai_text_model,
        input=[
            {"role": "system", "content": VIDEO_SYSTEM_PROMPT},
            {"role": "user", "content": transcript},
        ],
        text_format=VideoInsightBatch,
    )
    return response.output_parsed


def enrich_knowledge_points(points: list[dict], insights: list[dict]) -> VideoEnrichmentBatch:
    settings = get_settings()
    response = client().responses.parse(
        model=settings.openai_text_model,
        input=[
            {"role": "system", "content": VIDEO_ENRICHMENT_PROMPT},
            {
                "role": "user",
                "content": (
                    "教材知识卡：\n"
                    f"{json.dumps(points, ensure_ascii=False)}\n\n"
                    "教学视频结构化要点：\n"
                    f"{json.dumps(insights, ensure_ascii=False)}"
                ),
            },
        ],
        text_format=VideoEnrichmentBatch,
    )
    return response.output_parsed


def transcribe_audio(path: str) -> str:
    settings = get_settings()
    with open(path, "rb") as audio:
        result = client().audio.transcriptions.create(
            model=settings.openai_transcribe_model,
            file=audio,
            response_format="text",
        )
    return result if isinstance(result, str) else result.text
