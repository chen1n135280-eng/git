from app.pipeline import is_chapter_16_start, is_chapter_17_start


def test_chapter_start_ignores_table_of_contents():
    toc = "2026年注册会计师考试目录第十六章所有者权益473第十七章收入、费用和利润"
    assert not is_chapter_16_start(toc)


def test_chapter_start_accepts_body_heading():
    assert is_chapter_16_start("第十六章所有者权益473考情速览")


def test_next_chapter_heading_stops_capture():
    assert is_chapter_17_start("第十七章收入、费用和利润489")

