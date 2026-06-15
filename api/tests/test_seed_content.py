import re

from app.seed import DEMO_POINTS, FRAMEWORK


def test_chapter_16_seed_is_detailed_and_page_aligned():
    assert len(DEMO_POINTS) >= 30
    assert all(158 <= point["source_page_start"] <= 169 for point in DEMO_POINTS)
    assert all(point["plain_explanation"] for point in DEMO_POINTS)
    assert all(point["mistakes"] for point in DEMO_POINTS)
    assert all(re.search(r"\d", point["teaching_case"]) for point in DEMO_POINTS)


def test_seed_does_not_use_misplaced_chapter_13_topics():
    titles = {point["title"] for point in DEMO_POINTS}
    assert "其他权益工具与金融负债的区分" not in titles
    assert "复合金融工具的拆分" not in titles
    assert "复合金融工具交易费用的分摊" in titles


def test_chapter_16_seed_follows_page_157_framework():
    topics = [
        topic
        for section in FRAMEWORK
        for topic in section["topics"]
    ]
    framework_titles = [
        title
        for topic in topics
        for title in topic["titles"]
    ]

    assert len(FRAMEWORK) == 3
    assert len(topics) == 8
    assert len(framework_titles) == len(set(framework_titles)) == len(DEMO_POINTS)
    assert set(framework_titles) == {point["title"] for point in DEMO_POINTS}
    assert [topic["difficulty"] for topic in topics] == [
        "易",
        "易",
        "易",
        "易",
        "中",
        "易",
        "中",
        "易",
    ]
    assert all(point["framework_section"] for point in DEMO_POINTS)
    assert all(point["framework_topic"] for point in DEMO_POINTS)


def test_share_repurchase_card_contains_instructor_revisions():
    point = next(
        item
        for item in DEMO_POINTS
        if item["title"] == "股份有限公司回购本公司股票"
    )

    assert point["difficulty"] == 2
    assert "回购与注销两个会计时点" in point["difficulty_reason"]
    assert "实际支付的价款" in point["standard_explanation"]
    assert "不作为资产确认" in point["standard_explanation"]
    assert "只有后续注销" in point["standard_explanation"]
    assert point["teaching_case"].startswith("教学案例：")
    assert "300万元" in point["teaching_case"]
    assert "100万元" in point["teaching_case"]
    assert len(point["mistakes"]) == 3
    assert all("：" in mistake for mistake in point["mistakes"])
