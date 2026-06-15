"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import type { KnowledgePoint } from "@/lib/types";
import { EmptyState, Loading, Stars, StatusBadge } from "@/components/ui";

interface FrameworkTopic {
  name: string;
  difficulty: string;
  points: KnowledgePoint[];
}

interface FrameworkSection {
  name: string;
  topics: FrameworkTopic[];
}

export default function ChapterPage() {
  const params = useParams<{ id: string }>();
  const [points, setPoints] = useState<KnowledgePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [difficulty, setDifficulty] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    api<KnowledgePoint[]>(`/api/chapters/${params.id}/knowledge-points`)
      .then((result) => {
        setPoints(result);
        setSelected(result[0]?.id ?? null);
      })
      .finally(() => setLoading(false));
  }, [params.id]);

  const framework = useMemo(() => buildFramework(points), [points]);
  const filtered = useMemo(
    () =>
      points.filter(
        (point) =>
          (!activeTopic || point.framework_topic === activeTopic) &&
          (!difficulty || point.difficulty === difficulty) &&
          (!query ||
            `${point.title}${point.standard_explanation}${point.plain_explanation ?? ""}`.includes(query))
      ),
    [activeTopic, difficulty, points, query]
  );
  const current = filtered.find((point) => point.id === selected) ?? filtered[0];

  function chooseTopic(topic: FrameworkTopic) {
    setActiveTopic(topic.name);
    setDifficulty(0);
    setQuery("");
    setSelected(topic.points[0]?.id ?? null);
    window.setTimeout(
      () => document.getElementById("knowledge-detail")?.scrollIntoView({ behavior: "smooth" }),
      0
    );
  }

  function showAll() {
    setActiveTopic(null);
    setDifficulty(0);
    setQuery("");
    setSelected(points[0]?.id ?? null);
  }

  if (loading) return <Loading />;

  return (
    <div className="page chapter-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">会计 · 理论学习</span>
          <h1>第十六章 所有者权益</h1>
          <p>先建立教材框架，再进入每个考点下的详细知识卡。</p>
        </div>
        <div className="header-stat">
          <strong>{points.length}</strong>
          <span>个详细知识点</span>
        </div>
      </header>

      <section className="framework-panel">
        <div className="framework-heading">
          <div>
            <span className="eyebrow">教材第157页 · 考点框架</span>
            <h2>所有者权益知识框架</h2>
            <p>三大板块、八个教材考点。点击考点进入对应的详细讲解。</p>
          </div>
          <button className={!activeTopic ? "framework-all active" : "framework-all"} onClick={showAll}>
            查看全部知识点
          </button>
        </div>

        <div className="framework-table">
          {framework.map((section) => (
            <div className="framework-section" key={section.name}>
              <div className="framework-section-name">
                <strong>{section.name}</strong>
                <span>{section.topics.reduce((total, topic) => total + topic.points.length, 0)} 个知识点</span>
              </div>
              <div className="framework-topic-list">
                {section.topics.map((topic) => (
                  <button
                    className={activeTopic === topic.name ? "framework-topic active" : "framework-topic"}
                    key={topic.name}
                    onClick={() => chooseTopic(topic)}
                  >
                    <span className="framework-topic-name">{topic.name}</span>
                    <span className="framework-topic-count">{topic.points.length} 个</span>
                    <TextbookDifficulty value={topic.difficulty} />
                    <span className="framework-arrow">→</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="framework-legend">
          <span>教材难度：</span>
          <TextbookDifficulty value="易" />
          <TextbookDifficulty value="中" />
          <span className="legend-note">教材难度用于考点整体；知识卡星级用于具体内容复杂度。</span>
        </div>
      </section>

      <section id="knowledge-detail" className="knowledge-detail">
        <div className="detail-heading">
          <div>
            <span className="eyebrow">框架下钻</span>
            <h2>{activeTopic ?? "全部详细知识点"}</h2>
            <p>
              {activeTopic
                ? `本考点包含 ${points.filter((point) => point.framework_topic === activeTopic).length} 张知识卡`
                : "按照教材框架顺序展示全部知识卡"}
            </p>
          </div>
          {activeTopic && <button className="clear-topic" onClick={showAll}>返回完整框架</button>}
        </div>

        <div className="filter-bar">
          <input
            aria-label="搜索知识点"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="在当前考点中搜索概念、规则或会计处理"
            value={query}
          />
          <div className="difficulty-filter">
            <button className={!difficulty ? "active" : ""} onClick={() => setDifficulty(0)}>全部</button>
            {[1, 2, 3, 4, 5].map((value) => (
              <button className={difficulty === value ? "active" : ""} key={value} onClick={() => setDifficulty(value)}>
                {value}星
              </button>
            ))}
          </div>
        </div>

        {!filtered.length ? (
          <EmptyState title="没有匹配的知识点" detail="试试更换难度或搜索词。" />
        ) : (
          <div className="learning-layout">
            <aside className="knowledge-index">
              {filtered.map((point, index) => (
                <button
                  className={current?.id === point.id ? "knowledge-index-item active" : "knowledge-index-item"}
                  key={point.id}
                  onClick={() => setSelected(point.id)}
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <strong>{point.title}</strong>
                    <small>{point.framework_topic} · {point.difficulty}星</small>
                  </div>
                </button>
              ))}
            </aside>
            {current && <KnowledgeCard point={current} />}
          </div>
        )}
      </section>
    </div>
  );
}

function buildFramework(points: KnowledgePoint[]): FrameworkSection[] {
  const sections = new Map<string, Map<string, FrameworkTopic>>();
  for (const point of points) {
    const sectionName = point.framework_section ?? "未归类板块";
    const topicName = point.framework_topic ?? "未归类考点";
    if (!sections.has(sectionName)) sections.set(sectionName, new Map());
    const topics = sections.get(sectionName)!;
    if (!topics.has(topicName)) {
      topics.set(topicName, {
        name: topicName,
        difficulty: point.textbook_difficulty ?? "易",
        points: [],
      });
    }
    topics.get(topicName)!.points.push(point);
  }
  return Array.from(sections, ([name, topics]) => ({
    name,
    topics: Array.from(topics.values()),
  }));
}

function TextbookDifficulty({ value }: { value: string }) {
  const filled = value === "难" ? 3 : value === "中" ? 2 : 1;
  return (
    <span className="textbook-difficulty" aria-label={`教材难度${value}`}>
      <span className="difficulty-dots">
        {[0, 1, 2].map((index) => (
          <i className={index < filled ? "filled" : ""} key={index} />
        ))}
      </span>
      <strong>{value}</strong>
    </span>
  );
}

function KnowledgeCard({ point }: { point: KnowledgePoint }) {
  const isRepurchaseCard = point.title === "股份有限公司回购本公司股票";

  return (
    <article className="knowledge-card">
      <div className="card-topline">
        <div className="card-labels">
          <span className="category">{point.category}</span>
          <span className="framework-chip">{point.framework_section} / {point.framework_topic}</span>
          <span className="page-chip">教材 PDF 第 {point.source_page_start ?? "待定"} 页</span>
        </div>
        <StatusBadge status={point.status} />
      </div>
      <h2>{point.title}</h2>
      <div className="difficulty-line">
        <Stars value={point.difficulty} />
        <span>{point.difficulty_reason}</span>
      </div>

      {isRepurchaseCard
        ? <RepurchaseLearningFlow point={point} />
        : <DefaultKnowledgeContent point={point} />}

      <footer className="source-foot">
        <span>教材依据</span>
        <strong>
          {point.source_page_start
            ? `PDF第 ${point.source_page_start}${point.source_page_end !== point.source_page_start ? `–${point.source_page_end}` : ""} 页`
            : "等待定位教材页码"}
        </strong>
      </footer>
    </article>
  );
}

function DefaultKnowledgeContent({ point }: { point: KnowledgePoint }) {
  return <GenericSixStepLearningFlow point={point} />;
}

interface LearningOption {
  value: string;
  label: string;
}

interface LearningModel {
  attention: string;
  wrongAttention: string;
  coreRule: string;
  caseTitle: string;
  caseQuestion: string;
  caseOptions: LearningOption[];
  caseCorrectValue: string;
  independent:
    | {
        type: "entry";
        prompt: string;
        expectedAccount: string;
        expectedAmount: number;
        answerEntries: KnowledgePoint["journal_entries"];
      }
    | {
        type: "choice";
        prompt: string;
        options: LearningOption[];
        correctValue: string;
      };
  comparisonQuestion: string;
  comparisonOptions: LearningOption[];
  comparisonCorrectValue: string;
}

function GenericSixStepLearningFlow({ point }: { point: KnowledgePoint }) {
  const model = useMemo(() => buildGenericLearningModel(point), [point]);
  const [currentStep, setCurrentStep] = useState(1);
  const [warmupAnswer, setWarmupAnswer] = useState("");
  const [caseAnswer, setCaseAnswer] = useState("");
  const [showIndependentPractice, setShowIndependentPractice] = useState(false);
  const [independentAccount, setIndependentAccount] = useState("");
  const [independentAmount, setIndependentAmount] = useState("");
  const [independentChoice, setIndependentChoice] = useState("");
  const [independentChecked, setIndependentChecked] = useState(false);
  const [comparisonAnswer, setComparisonAnswer] = useState("");
  const warmupCorrect = warmupAnswer === "attention";
  const caseCorrect = caseAnswer === model.caseCorrectValue;
  const independentCorrect = model.independent.type === "entry"
    ? normalizeAnswer(independentAccount) === normalizeAnswer(model.independent.expectedAccount) &&
      Number(independentAmount) === model.independent.expectedAmount
    : independentChoice === model.independent.correctValue;

  return (
    <div className="active-learning-flow">
      <LearningProgress currentStep={currentStep} />

      <div className="learning-step-stage" key={currentStep}>
        {currentStep === 1 && (
          <section className="learning-step warmup-step">
            <span className="step-kicker">01 · 旧知识唤醒 · 约10秒</span>
            <h3>学习“{point.title}”前，第一步最应关注什么？</h3>
            <p>先判断解题入口，不急着背最终结论。</p>
            <div className="choice-row">
              <ChoiceButton active={warmupAnswer === "attention"} onClick={() => setWarmupAnswer("attention")}>
                {model.attention}
              </ChoiceButton>
              <ChoiceButton active={warmupAnswer === "shortcut"} onClick={() => setWarmupAnswer("shortcut")}>
                {model.wrongAttention}
              </ChoiceButton>
            </div>
            {warmupAnswer && (
              <Feedback correct={warmupCorrect}>
                {warmupCorrect
                  ? `正确。${model.attention}，可以避免被业务名称或表面金额带偏。`
                  : `需要修正：${model.wrongAttention}容易忽略教材规定的条件、时点或计量基础。`}
              </Feedback>
            )}
            <StepNavigation nextDisabled={!warmupAnswer} onNext={() => setCurrentStep(2)} step={1} />
          </section>
        )}

        {currentStep === 2 && (
          <section className="learning-step core-rule">
            <span className="step-kicker">02 · 一句话核心规则</span>
            <h3>{model.coreRule}</h3>
            <div className="rule-tags">
              <span>{point.category}</span>
              <span>{point.journal_entries.length ? "核对借贷方向" : "核对适用边界"}</span>
            </div>
            <div className="why-chain">
              <strong>为什么？</strong>
              <p>{point.plain_explanation}</p>
            </div>
            <details className="standard-details">
              <summary>查看教材规则的完整表述</summary>
              <p>{point.standard_explanation}</p>
            </details>
            <StepNavigation onBack={() => setCurrentStep(1)} onNext={() => setCurrentStep(3)} step={2} />
          </section>
        )}

        {currentStep === 3 && (
          <section className="learning-step attempt-step">
            <span className="step-kicker">03 · 案例先做后看</span>
            <h3>{model.caseTitle}</h3>
            <QuestionChoices
              label={model.caseQuestion}
              value={caseAnswer}
              options={model.caseOptions.map((option) => [option.value, option.label])}
              onChange={setCaseAnswer}
            />
            <StepNavigation
              nextDisabled={!caseAnswer}
              nextLabel="提交并查看解析"
              onBack={() => setCurrentStep(2)}
              onNext={() => setCurrentStep(4)}
              step={3}
            />
          </section>
        )}

        {currentStep === 4 && (
          <section className="learning-step answer-step">
            <span className="step-kicker">04 · 完整解析与错误反馈</span>
            <Feedback correct={caseCorrect}>
              {caseCorrect
                ? "判断正确。下面把教材规则、数字案例和会计后果连起来。"
                : `需要修正。正确处理应为：“${model.coreRule}”`}
            </Feedback>
            <p className="case-conclusion">{point.teaching_case}</p>
            <JournalEntries entries={point.journal_entries} />
            <ul className="error-feedback">
              {point.mistakes.map((mistake) => (
                <li className="incorrect" key={mistake}>易错原因：{mistake}</li>
              ))}
            </ul>
            <StepNavigation onBack={() => setCurrentStep(3)} onNext={() => setCurrentStep(5)} step={4} />
          </section>
        )}

        {currentStep === 5 && (
          <section className="learning-step fading-step">
            <span className="step-kicker">05 · 示例逐步淡出</span>
            <h3>{showIndependentPractice ? "换一个主体和数字，独立完成判断" : "先完整看懂一次，再进入独立作答"}</h3>
            {!showIndependentPractice ? (
              <div className="practice-card complete-example">
                <span>第一次 · 完整示例</span>
                <p>{point.teaching_case}</p>
                <JournalEntries entries={point.journal_entries} />
                <button
                  className="practice-next-button"
                  onClick={() => {
                    setShowIndependentPractice(true);
                    setIndependentChecked(false);
                  }}
                >
                  下一步：隐藏示例并独立作答
                </button>
              </div>
            ) : (
              <div className="practice-card independent-practice">
                <span>第二次 · 变化案例独立作答</span>
                <p>{model.independent.prompt}</p>
                {model.independent.type === "entry" ? (
                  <>
                    <label>关键借方科目：<input value={independentAccount} onChange={(event) => setIndependentAccount(event.target.value)} /></label>
                    <label>该借方金额：<input inputMode="numeric" value={independentAmount} onChange={(event) => setIndependentAmount(event.target.value)} /> 万元</label>
                  </>
                ) : (
                  <div className="choice-row">
                    {model.independent.options.map((option) => (
                      <ChoiceButton
                        active={independentChoice === option.value}
                        key={option.value}
                        onClick={() => {
                          setIndependentChoice(option.value);
                          setIndependentChecked(false);
                        }}
                      >
                        {option.label}
                      </ChoiceButton>
                    ))}
                  </div>
                )}
                <button onClick={() => setIndependentChecked(true)}>检查答案</button>
                {independentChecked && (
                  <Feedback correct={independentCorrect}>
                    {model.independent.type === "entry"
                      ? independentCorrect
                        ? `正确：关键借方为“${model.independent.expectedAccount}”${formatAmount(model.independent.expectedAmount)}万元。`
                        : `请重新核对科目和计量基础。答案为“${model.independent.expectedAccount}”${formatAmount(model.independent.expectedAmount)}万元。`
                      : independentCorrect
                        ? "正确。主体和金额变化不会自动改变该知识点的核心规则。"
                        : "需要修正。变化案例仍应先满足本知识点的确认、计量或列报条件。"}
                  </Feedback>
                )}
                {independentChecked && independentCorrect && model.independent.type === "entry" && (
                  <JournalEntries entries={model.independent.answerEntries} />
                )}
              </div>
            )}
            <StepNavigation
              nextDisabled={!showIndependentPractice || !independentChecked}
              onBack={() => setCurrentStep(4)}
              onNext={() => setCurrentStep(6)}
              step={5}
            />
          </section>
        )}

        {currentStep === 6 && (
          <section className="learning-step comparison-step">
            <span className="step-kicker">06 · 对比与边界辨析</span>
            <h3>{model.comparisonQuestion}</h3>
            <div className="choice-row">
              {model.comparisonOptions.map((option) => (
                <ChoiceButton
                  active={comparisonAnswer === option.value}
                  key={option.value}
                  onClick={() => setComparisonAnswer(option.value)}
                >
                  {option.label}
                </ChoiceButton>
              ))}
            </div>
            {comparisonAnswer && (
              <Feedback correct={comparisonAnswer === model.comparisonCorrectValue}>
                {comparisonAnswer === model.comparisonCorrectValue
                  ? `正确。应坚持：“${model.coreRule}”`
                  : "不正确。该选项属于本知识点列出的常见混淆，不能替代教材规则。"}
              </Feedback>
            )}
            <StepNavigation onBack={() => setCurrentStep(5)} step={6} />
          </section>
        )}
      </div>
    </div>
  );
}

function LearningProgress({ currentStep }: { currentStep: number }) {
  return (
    <div className="learning-progress" aria-label={`当前为第${currentStep}步，共6步`}>
      <span>六步主动学习路径</span>
      <div className="progress-dots">
        {[1, 2, 3, 4, 5, 6].map((step) => (
          <i className={step === currentStep ? "active" : step < currentStep ? "complete" : ""} key={step}>
            {step}
          </i>
        ))}
      </div>
      <strong>{currentStep} / 6</strong>
    </div>
  );
}

function buildGenericLearningModel(point: KnowledgePoint): LearningModel {
  const coreRule = firstSentence(point.standard_explanation);
  const attention = categoryAttention(point.category);
  const wrongAttention = categoryWrongAttention(point.category);
  const mistake = point.mistakes[0] ?? "只看业务名称，不核对适用条件";
  const secondMistake = point.mistakes[1] ?? mistake;
  const numbers = extractNumbers(point.teaching_case ?? "");
  const numberText = numbers.length ? `，涉及${numbers.slice(0, 3).join("、")}` : "";
  const firstEntry = point.journal_entries[0];
  const scaledEntries = firstEntry ? scaleEntries([firstEntry], 1.5) : [];
  const scaledDebit = scaledEntries[0]?.lines.find((line) => line.direction === "debit");
  const prerequisite = point.prerequisites[0];

  return {
    attention,
    wrongAttention,
    coreRule,
    caseTitle: `某企业发生“${point.title}”相关业务${numberText}。先判断处理原则，再查看完整答案。`,
    caseQuestion: categoryCaseQuestion(point.category, point.title),
    caseOptions: [
      { value: "rule", label: coreRule },
      { value: "mistake", label: mistake },
    ],
    caseCorrectValue: "rule",
    independent: scaledDebit
      ? {
          type: "entry",
          prompt: "乙公司发生同类业务，相关金额统一调整为完整示例的1.5倍。请填写第一笔关键借方科目和金额。",
          expectedAccount: scaledDebit.account,
          expectedAmount: scaledDebit.amount,
          answerEntries: scaledEntries,
        }
      : {
          type: "choice",
          prompt: `乙公司发生与“${point.title}”同类的业务，主体和金额均发生变化。应继续采用哪项核心判断？`,
          options: [
            { value: "rule", label: coreRule },
            { value: "mistake", label: mistake },
          ],
          correctValue: "rule",
        },
    comparisonQuestion: prerequisite
      ? `与前置知识“${prerequisite}”联系学习时，“${point.title}”应保留哪项处理边界？`
      : `面对“${point.title}”的常见混淆时，应坚持哪项教材边界？`,
    comparisonOptions: [
      { value: "rule", label: coreRule },
      { value: "mistake", label: secondMistake },
    ],
    comparisonCorrectValue: "rule",
  };
}

function firstSentence(text: string) {
  const match = text.trim().match(/^.*?[。；]/);
  return match?.[0] ?? text.trim();
}

function categoryAttention(category: string) {
  const values: Record<string, string> = {
    概念: "先判断业务是否落入该概念的核算范围",
    确认条件: "先核对确认条件以及确认时点",
    计量规则: "先确定计量基础和参与计算的金额",
    会计处理: "先判断业务性质和所处会计阶段",
    会计分录: "先判断业务阶段、使用科目和借贷方向",
    列报: "先判断列报类别以及以后能否重分类",
    例外情况: "先确认一般规则，再核对例外条件",
    易错点: "先找出容易混淆的规则边界",
  };
  return values[category] ?? "先核对适用条件和会计后果";
}

function categoryWrongAttention(category: string) {
  const values: Record<string, string> = {
    概念: "只根据业务名称直接归类",
    确认条件: "先计算金额，再补看确认条件",
    计量规则: "看到最大金额就直接入账",
    会计处理: "不区分业务阶段，直接套用最终分录",
    会计分录: "只记科目名称，不判断业务发生时点",
    列报: "只看当前列报，不考虑以后期间处理",
    例外情况: "忽略一般规则，直接背诵例外",
    易错点: "只记答案，不理解错误原因",
  };
  return values[category] ?? "只按表面名称直接作出结论";
}

function categoryCaseQuestion(category: string, title: string) {
  const values: Record<string, string> = {
    概念: `面对上述业务，“${title}”的核算范围应如何判断？`,
    确认条件: `上述业务应在什么条件或时点确认“${title}”？`,
    计量规则: `上述业务应采用哪项“${title}”计量基础？`,
    会计处理: `上述业务在当前阶段应采用哪项“${title}”会计处理？`,
    会计分录: `上述业务在当前阶段应采用哪项科目与金额处理？`,
    列报: `上述项目应按哪项“${title}”列报及后续处理规则判断？`,
    例外情况: `上述业务是否满足“${title}”的例外条件？`,
    易错点: `上述业务应如何避开“${title}”中的混淆？`,
  };
  return values[category] ?? `上述业务应如何应用“${title}”的教材规则？`;
}

function extractNumbers(text: string) {
  return Array.from(new Set(text.match(/\d+(?:\.\d+)?(?:万|亿)?元?/g) ?? []));
}

function scaleEntries(entries: KnowledgePoint["journal_entries"], factor: number) {
  return entries.map((entry) => ({
    ...entry,
    label: `变化案例：${entry.label}`,
    lines: entry.lines.map((line) => ({
      ...line,
      amount: Number((line.amount * factor).toFixed(2)),
    })),
  }));
}

function formatAmount(amount: number) {
  return amount.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
}

function RepurchaseLearningFlow({ point }: { point: KnowledgePoint }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [warmupAnswer, setWarmupAnswer] = useState<string | null>(null);
  const [caseAnswers, setCaseAnswers] = useState({ account: "", amount: "", shareCapital: "" });
  const [showIndependentPractice, setShowIndependentPractice] = useState(false);
  const [independentAccount, setIndependentAccount] = useState("");
  const [independentAmount, setIndependentAmount] = useState("");
  const [independentChecked, setIndependentChecked] = useState(false);
  const [comparisonAnswer, setComparisonAnswer] = useState<string | null>(null);
  const warmupCorrect = warmupAnswer === "equity";
  const caseComplete = Object.values(caseAnswers).every(Boolean);
  const caseCorrect =
    caseAnswers.account === "inventory" &&
    caseAnswers.amount === "300" &&
    caseAnswers.shareCapital === "no";
  const independentCorrect =
    normalizeAnswer(independentAccount) === "库存股" &&
    Number(independentAmount) === 480;

  return (
    <div className="active-learning-flow">
      <div className="learning-progress" aria-label={`当前为第${currentStep}步，共6步`}>
        <span>知识点11学习路径</span>
        <div className="progress-dots">
          {[1, 2, 3, 4, 5, 6].map((step) => (
            <i className={step === currentStep ? "active" : step < currentStep ? "complete" : ""} key={step}>
              {step}
            </i>
          ))}
        </div>
        <strong>{currentStep} / 6</strong>
      </div>

      <div className="learning-step-stage" key={currentStep}>
        {currentStep === 1 && (
          <section className="learning-step warmup-step">
            <span className="step-kicker">01 · 旧知识唤醒 · 约10秒</span>
            <h3>回购本公司股票，实质上发生了什么？</h3>
            <p>先凭已有理解选择，再看规则。此处不要求你会写分录。</p>
            <div className="choice-row">
              <ChoiceButton
                active={warmupAnswer === "asset"}
                onClick={() => setWarmupAnswer("asset")}
              >
                公司取得一项资产
              </ChoiceButton>
              <ChoiceButton
                active={warmupAnswer === "equity"}
                onClick={() => setWarmupAnswer("equity")}
              >
                公司减少所有者权益
              </ChoiceButton>
            </div>
            {warmupAnswer && (
              <Feedback correct={warmupCorrect}>
                {warmupCorrect
                  ? "正确。库存股不是公司的一项资产，而是所有者权益的备抵项目。"
                  : "需要修正：公司不能把自己的股份作为自身资产确认，回购形成的库存股会抵减所有者权益。"}
              </Feedback>
            )}
            <StepNavigation
              nextDisabled={!warmupAnswer}
              onNext={() => setCurrentStep(2)}
              step={1}
            />
          </section>
        )}

        {currentStep === 2 && (
          <section className="learning-step core-rule">
            <span className="step-kicker">02 · 一句话核心规则</span>
            <h3>回购时，按实际支付金额借记“库存股”，暂不直接冲减股本。</h3>
            <div className="rule-tags">
              <span>库存股＝所有者权益备抵项目</span>
              <span>回购≠注销</span>
            </div>
            <div className="why-chain">
              <strong>为什么？</strong>
              <p>{point.plain_explanation}</p>
            </div>
            <details className="standard-details">
              <summary>查看教材规则的完整表述</summary>
              <p>{point.standard_explanation}</p>
            </details>
            <StepNavigation
              onBack={() => setCurrentStep(1)}
              onNext={() => setCurrentStep(3)}
              step={2}
            />
          </section>
        )}

        {currentStep === 3 && (
          <section className="learning-step attempt-step">
            <span className="step-kicker">03 · 案例先做后看</span>
            <h3>甲公司支付300万元，回购面值合计100万元的本公司股票。</h3>
            <QuestionChoices
              label="① 借记什么科目？"
              value={caseAnswers.account}
              options={[
                ["inventory", "库存股"],
                ["share-capital", "股本"],
              ]}
              onChange={(value) => {
                setCaseAnswers((answers) => ({ ...answers, account: value }));
              }}
            />
            <QuestionChoices
              label="② 确认金额是多少？"
              value={caseAnswers.amount}
              options={[
                ["300", "实际支付价款300万元"],
                ["100", "股票面值100万元"],
              ]}
              onChange={(value) => {
                setCaseAnswers((answers) => ({ ...answers, amount: value }));
              }}
            />
            <QuestionChoices
              label="③ 回购日是否冲减股本？"
              value={caseAnswers.shareCapital}
              options={[
                ["no", "否，注销时再处理"],
                ["yes", "是，回购时立即处理"],
              ]}
              onChange={(value) => {
                setCaseAnswers((answers) => ({ ...answers, shareCapital: value }));
              }}
            />
            <StepNavigation
              nextDisabled={!caseComplete}
              nextLabel="提交并查看解析"
              onBack={() => setCurrentStep(2)}
              onNext={() => setCurrentStep(4)}
              step={3}
            />
          </section>
        )}

        {currentStep === 4 && (
          <section className="learning-step answer-step">
            <span className="step-kicker">04 · 分录示范与错误反馈</span>
            <Feedback correct={caseCorrect}>
              {caseCorrect ? "三项判断全部正确。" : "这次还没有全部答对，请对照下面的原因检查。"}
            </Feedback>
            <ul className="error-feedback">
              <li className={caseAnswers.account === "inventory" ? "correct" : "incorrect"}>
                科目：应借记“库存股”。选择“股本”是混淆了回购和注销。
              </li>
              <li className={caseAnswers.amount === "300" ? "correct" : "incorrect"}>
                金额：应按实际支付价款300万元确认，不按面值100万元计量。
              </li>
              <li className={caseAnswers.shareCapital === "no" ? "correct" : "incorrect"}>
                时点：回购时不处理股本，后续注销时才处理。
              </li>
            </ul>
            <p className="case-conclusion">{point.teaching_case}</p>
            <JournalEntries entries={point.journal_entries} />
            <StepNavigation
              onBack={() => setCurrentStep(3)}
              onNext={() => setCurrentStep(5)}
              step={4}
            />
          </section>
        )}

        {currentStep === 5 && (
          <section className="learning-step fading-step">
            <span className="step-kicker">05 · 示例逐步淡出</span>
            <h3>{showIndependentPractice ? "换一组数字，独立写出关键分录" : "先完整看懂一次，再进入独立作答"}</h3>
            {!showIndependentPractice ? (
              <div className="practice-card complete-example">
                <span>第一次 · 完整示例</span>
                <p>借：库存股 300万元</p>
                <p>贷：银行存款 300万元</p>
                <small>库存股增加记借方，银行存款减少记贷方。</small>
                <button
                  className="practice-next-button"
                  onClick={() => {
                    setShowIndependentPractice(true);
                    setIndependentChecked(false);
                  }}
                >
                  下一步：换数字独立作答
                </button>
              </div>
            ) : (
              <div className="practice-card independent-practice">
                <span>第二次 · 换数字独立作答</span>
                <p>乙公司支付480万元回购面值200万元的股票。填写借方科目和金额。</p>
                <label>借：<input value={independentAccount} onChange={(event) => setIndependentAccount(event.target.value)} /></label>
                <label>金额：<input inputMode="numeric" value={independentAmount} onChange={(event) => setIndependentAmount(event.target.value)} /> 万元</label>
                <button onClick={() => setIndependentChecked(true)}>检查答案</button>
                {independentChecked && (
                  <Feedback correct={independentCorrect}>
                    {independentCorrect
                      ? "正确：借记库存股480万元。面值200万元在回购阶段不参与计量。"
                      : "再想一次：回购按实际支付价款计量，不按股票面值计量。"}
                  </Feedback>
                )}
              </div>
            )}
            <StepNavigation
              nextDisabled={!showIndependentPractice || !independentChecked}
              onBack={() => setCurrentStep(4)}
              onNext={() => setCurrentStep(6)}
              step={5}
            />
          </section>
        )}

        {currentStep === 6 && (
          <section className="learning-step comparison-step">
            <span className="step-kicker">06 · 回购与注销对比</span>
            <h3>下列哪项发生在注销阶段，而不是回购阶段？</h3>
            <div className="choice-row">
              {[
                ["A", "A. 确认库存股"],
                ["B", "B. 冲减股本"],
                ["C", "C. 贷记银行存款"],
              ].map(([value, label]) => (
                <ChoiceButton
                  active={comparisonAnswer === value}
                  key={value}
                  onClick={() => setComparisonAnswer(value)}
                >
                  {label}
                </ChoiceButton>
              ))}
            </div>
            {comparisonAnswer && (
              <Feedback correct={comparisonAnswer === "B"}>
                {comparisonAnswer === "B"
                  ? "正确。回购先确认库存股，只有注销时才冲减股本。"
                  : "不正确。确认库存股和支付银行存款都发生在回购阶段。"}
              </Feedback>
            )}
            <StepNavigation
              onBack={() => setCurrentStep(5)}
              step={6}
            />
          </section>
        )}
      </div>
    </div>
  );
}

function StepNavigation({
  nextDisabled = false,
  nextLabel = "下一步",
  onBack,
  onNext,
  step,
}: {
  nextDisabled?: boolean;
  nextLabel?: string;
  onBack?: () => void;
  onNext?: () => void;
  step: number;
}) {
  return (
    <div className="step-navigation">
      {step > 1 && (
        <button className="step-back-button" onClick={onBack}>
          上一步
        </button>
      )}
      {step < 6 && (
        <button className="step-next-button" disabled={nextDisabled} onClick={onNext}>
          {nextLabel}
        </button>
      )}
    </div>
  );
}

function ChoiceButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button className={active ? "learning-choice active" : "learning-choice"} onClick={onClick}>
      {children}
    </button>
  );
}

function QuestionChoices({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: string[][];
  value: string;
}) {
  return (
    <div className="case-question">
      <strong>{label}</strong>
      <div className="choice-row">
        {options.map(([optionValue, optionLabel]) => (
          <ChoiceButton
            active={value === optionValue}
            key={optionValue}
            onClick={() => onChange(optionValue)}
          >
            {optionLabel}
          </ChoiceButton>
        ))}
      </div>
    </div>
  );
}

function Feedback({ children, correct }: { children: React.ReactNode; correct: boolean }) {
  return <div className={correct ? "learning-feedback correct" : "learning-feedback incorrect"}>{children}</div>;
}

function JournalEntries({ entries }: { entries: KnowledgePoint["journal_entries"] }) {
  return (
    <>
      {entries.map((entry) => (
        <section className="journal-entry" key={entry.label}>
          <h3>{entry.label}</h3>
          {entry.lines.map((line, index) => (
            <div className="journal-line" key={`${line.account}-${index}`}>
              <span>{line.direction === "debit" ? "借" : "贷"}：{line.account}</span>
              <strong>{line.amount.toLocaleString("zh-CN")}</strong>
            </div>
          ))}
        </section>
      ))}
    </>
  );
}

function KnowledgeMeta({ point }: { point: KnowledgePoint }) {
  return (
    <div className="knowledge-columns">
      <section>
        <h3>易错点</h3>
        <ul>{point.mistakes.map((item) => <li key={item}>{item}</li>)}</ul>
      </section>
      <section>
        <h3>前置知识</h3>
        <div className="tags">
          {point.prerequisites.length
            ? point.prerequisites.map((item) => <span key={item}>{item}</span>)
            : <em>无需额外前置知识</em>}
        </div>
      </section>
    </div>
  );
}

function normalizeAnswer(value: string) {
  return value.trim().replace(/[“”]/g, "").replace(/\s+/g, "");
}
