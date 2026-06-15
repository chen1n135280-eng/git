from app.audit import audit_knowledge_point


def valid_point():
    return {
        "standard_explanation": "标准解释",
        "difficulty": 2,
        "difficulty_reason": "单一规则",
        "plain_explanation": "大白话解释",
        "teaching_case": "教学案例：甲公司投入100万元。",
        "mistakes": ["易错点"],
        "source_id": 1,
        "source_page_start": 10,
        "journal_entries": [
            {
                "label": "示例",
                "lines": [
                    {"direction": "debit", "amount": 100},
                    {"direction": "credit", "amount": 100},
                ],
            }
        ],
    }


def test_valid_beginner_point_passes():
    assert audit_knowledge_point(valid_point()) == []


def test_every_point_requires_teaching_content():
    point = valid_point()
    point["plain_explanation"] = ""
    point["mistakes"] = []
    errors = audit_knowledge_point(point)
    assert "缺少面向初学者的大白话解释" in errors
    assert "缺少易错点" in errors


def test_teaching_case_must_contain_a_number():
    point = valid_point()
    point["teaching_case"] = "教学案例：甲公司收到股东投入。"
    assert "教学案例必须包含具体数字" in audit_knowledge_point(point)


def test_unbalanced_journal_entry_is_rejected():
    point = valid_point()
    point["journal_entries"][0]["lines"][1]["amount"] = 90
    assert "示例借贷不平衡" in audit_knowledge_point(point)

