import { AIServiceError, generateAiText } from "./aiService.mjs";

const DEFAULT_DECISION_TIMEOUT_MS = 60000;

export class DecisionAdviceError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "DecisionAdviceError";
    this.status = status;
  }
}

export async function getDecisionAdvice(input = {}, {
  fetchImpl = globalThis.fetch,
  timeoutMs = Number(process.env.DECISION_ADVICE_TIMEOUT_MS || DEFAULT_DECISION_TIMEOUT_MS),
  provider,
  ollamaBaseUrl,
  ollamaModel,
  openAiBaseUrl,
  openAiApiKey,
  openAiModel
} = {}) {
  const prompt = cleanText(input.prompt, 120);
  if (!prompt) throw new DecisionAdviceError("先把问题写下来。", 400);

  try {
    const rawText = await generateAiText({
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content: [
            "你是水豚旅行账本里的轻量决策助手。",
            "你的任务是结合旅行记账上下文，给用户一个简短、可执行、不啰嗦的中文建议。",
            "不要替用户保存账单，不要输出长篇分析。",
            "只返回 JSON，不要 Markdown。字段固定为 advice, confidence, warnings。"
          ].join("\n")
        },
        {
          role: "user",
          content: buildDecisionPrompt(input, prompt)
        }
      ]
    }, {
      fetchImpl,
      provider,
      timeoutMs,
      ollamaBaseUrl,
      ollamaModel,
      openAiBaseUrl,
      openAiApiKey,
      openAiModel
    });
    return normalizeDecisionAdvice(parseDecisionJson(rawText), prompt);
  } catch (error) {
    if (error instanceof DecisionAdviceError) throw error;
    if (error instanceof AIServiceError) {
      throw new DecisionAdviceError(error.message || "水豚拍板暂时不可用，请稍后再试。", error.status || 502);
    }
    throw new DecisionAdviceError(error.message || "水豚拍板暂时不可用，请稍后再试。", 502);
  }
}

function buildDecisionPrompt(input, prompt) {
  return [
    `用户问题：${prompt}`,
    `行程：${cleanText(input.tripTitle, 60) || "未命名行程"}`,
    `同行人：${normalizePeople(input.people).join("、") || "未填写"}`,
    `当前分类：${cleanText(input.category, 20) || "未选择"}`,
    `当前金额：${cleanText(input.amount, 20) || "未填写"}`,
    `当前备注：${cleanText(input.note, 60) || "未填写"}`,
    `当前时间：${cleanText(input.time, 30) || "未填写"}`,
    "请给 1 句建议，最多 60 个中文字符。confidence 用 0 到 1 的数字。warnings 是字符串数组。"
  ].join("\n");
}

function parseDecisionJson(text) {
  const source = String(text || "").trim();
  if (!source) throw new DecisionAdviceError("AI 没有返回建议，请重试。", 502);
  const fenced = source.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced || source.match(/\{[\s\S]*\}/)?.[0];
  if (!candidate) return { advice: source };
  try {
    return JSON.parse(candidate);
  } catch {
    return { advice: source };
  }
}

function normalizeDecisionAdvice(rawAdvice = {}, fallbackPrompt = "") {
  const advice = cleanText(rawAdvice.advice || rawAdvice.text || rawAdvice.result, 160);
  const warnings = Array.isArray(rawAdvice.warnings)
    ? rawAdvice.warnings.map((item) => cleanText(item, 80)).filter(Boolean).slice(0, 3)
    : [];
  return {
    advice: advice || `先按更省心的方案走：${fallbackPrompt}`,
    confidence: normalizeConfidence(rawAdvice.confidence),
    warnings
  };
}

function normalizePeople(people) {
  return (Array.isArray(people) ? people : [])
    .map((name) => cleanText(name, 20))
    .filter(Boolean)
    .slice(0, 10);
}

function cleanText(value, maxLength) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizeConfidence(value) {
  const confidence = Number(value);
  if (!Number.isFinite(confidence)) return 0;
  if (confidence > 1) return Math.round(Math.min(confidence, 100)) / 100;
  return Math.round(Math.max(0, Math.min(confidence, 1)) * 100) / 100;
}
