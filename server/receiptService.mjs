import {
  RECEIPT_MAX_IMAGE_BYTES,
  RECEIPT_SUPPORTED_MIME_TYPES,
  normalizeReceiptDraft
} from "../src/lib/receipt.js";
import { EXPENSE_CATEGORIES } from "../src/lib/travel.js";

const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";
const DEFAULT_OLLAMA_MODEL = "gemma4:e4b";
const DEFAULT_TIMEOUT_MS = 120000;

export async function parseReceiptImage(input, {
  fetchImpl = globalThis.fetch,
  ollamaBaseUrl = process.env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_BASE_URL,
  ollamaModel = process.env.OLLAMA_MODEL || DEFAULT_OLLAMA_MODEL,
  timeoutMs = Number(process.env.RECEIPT_PARSE_TIMEOUT_MS || DEFAULT_TIMEOUT_MS)
} = {}) {
  if (typeof fetchImpl !== "function") throw new Error("当前 Node 版本不支持 fetch。");
  const allowedCategories = Array.isArray(input?.allowedCategories) && input.allowedCategories.length
    ? input.allowedCategories
    : EXPENSE_CATEGORIES;
  const image = extractImagePayload(input?.image, input?.mimeType);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(`${ollamaBaseUrl.replace(/\/$/, "")}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: ollamaModel,
        stream: false,
        options: { temperature: 0 },
        messages: [{
          role: "user",
          content: buildReceiptPrompt(allowedCategories),
          images: [image.base64]
        }]
      })
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new ReceiptParseError(payload?.error || `Ollama 请求失败：${response.status}`, 502);
    }
    const rawText = payload?.message?.content || payload?.response || "";
    const parsed = parseModelJson(rawText);
    return normalizeReceiptDraft(parsed, allowedCategories);
  } catch (error) {
    if (error.name === "AbortError") {
      throw new ReceiptParseError("账单识别超时，请稍后重试或手动录入。", 504);
    }
    if (error instanceof ReceiptParseError) throw error;
    throw new ReceiptParseError(error.message || "账单识别服务不可用。", 502);
  } finally {
    clearTimeout(timeout);
  }
}

export class ReceiptParseError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "ReceiptParseError";
    this.status = status;
  }
}

export function extractImagePayload(dataUrl, mimeType) {
  const value = String(dataUrl || "");
  const match = value.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  const finalMimeType = match?.[1] || String(mimeType || "");
  const base64 = match?.[2] || value;
  if (!RECEIPT_SUPPORTED_MIME_TYPES.includes(finalMimeType)) {
    throw new ReceiptParseError("仅支持 JPG、PNG 或 WebP 图片。", 415);
  }
  if (!/^[A-Za-z0-9+/=]+$/.test(base64)) {
    throw new ReceiptParseError("图片数据格式无效。", 400);
  }
  const byteLength = Buffer.byteLength(base64, "base64");
  if (byteLength <= 0) throw new ReceiptParseError("图片数据为空。", 400);
  if (byteLength > RECEIPT_MAX_IMAGE_BYTES) {
    throw new ReceiptParseError("图片不能超过 5MB。", 413);
  }
  return { mimeType: finalMimeType, base64, byteLength };
}

export function parseModelJson(text) {
  const source = String(text || "").trim();
  if (!source) throw new ReceiptParseError("模型未返回可识别内容。", 502);
  const fenced = source.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced || source.match(/\{[\s\S]*\}/)?.[0] || source;
  try {
    return JSON.parse(candidate);
  } catch {
    throw new ReceiptParseError("模型返回格式无效，请重试。", 502);
  }
}

function buildReceiptPrompt(allowedCategories) {
  return [
    "你是旅行记账产品的账单截图识别器。",
    "请从图片中提取单笔账单的总金额、币种、商户、用途备注、分类、时间和置信度。",
    "如果图片中有多笔商品，只提取账单总金额，不要拆分多条记录。",
    `分类只能从这些值中选择：${allowedCategories.join("、")}。无法确定时选择“其他”。`,
    "付款人和参与人不要识别，也不要输出。",
    "只返回 JSON，不要 Markdown，不要解释。",
    "JSON 字段固定为：amount, currency, merchant, note, category, customCategory, time, confidence, warnings。",
    "time 使用 YYYY-MM-DDTHH:mm 格式；confidence 使用 0 到 1 的数字；warnings 是字符串数组。"
  ].join("\n");
}
