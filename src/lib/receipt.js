import { EXPENSE_CATEGORIES, round2 } from "./travel.js";

export const RECEIPT_MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const RECEIPT_SUPPORTED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

const CATEGORY_ALIASES = [
  { category: "餐饮", aliases: ["餐饮", "吃饭", "餐厅", "饭店", "咖啡", "饮品", "外卖", "食品", "restaurant", "food", "coffee"] },
  { category: "住宿", aliases: ["住宿", "酒店", "宾馆", "民宿", "房费", "hotel", "hostel", "lodging"] },
  { category: "交通", aliases: ["交通", "打车", "出租", "地铁", "公交", "火车", "高铁", "机票", "停车", "taxi", "metro", "train", "flight"] },
  { category: "门票", aliases: ["门票", "景点", "票务", "入场", "展览", "ticket", "museum", "park"] },
  { category: "购物", aliases: ["购物", "商店", "超市", "便利店", "礼品", "souvenir", "market", "store", "shop"] },
  { category: "其他", aliases: ["其他", "杂项", "other"] }
];

export function getApiUrl(path) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const baseUrl = String(import.meta.env?.VITE_API_BASE_URL || "").trim().replace(/\/$/, "");
  return baseUrl ? `${baseUrl}${normalizedPath}` : normalizedPath;
}

export function validateReceiptImage(file) {
  if (!file) throw new Error("请选择一张账单截图。");
  if (!RECEIPT_SUPPORTED_MIME_TYPES.includes(file.type)) {
    throw new Error("仅支持 JPG、PNG 或 WebP 图片。");
  }
  if (file.size > RECEIPT_MAX_IMAGE_BYTES) {
    throw new Error("图片不能超过 5MB。");
  }
}

export function readFileAsDataUrl(file) {
  validateReceiptImage(file);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("读取图片失败，请重新选择。"));
    reader.readAsDataURL(file);
  });
}

export function normalizeReceiptDraft(rawDraft = {}, allowedCategories = EXPENSE_CATEGORIES) {
  const amount = normalizeAmount(rawDraft.amount ?? rawDraft.total ?? rawDraft.price);
  const merchant = cleanText(rawDraft.merchant || rawDraft.shop || rawDraft.vendor, 40);
  const note = cleanText(rawDraft.note || rawDraft.purpose || rawDraft.description || merchant, 30);
  const category = normalizeReceiptCategory(
    rawDraft.category || rawDraft.type || note || merchant,
    allowedCategories
  );
  const customCategory = category === "其他"
    ? cleanText(rawDraft.customCategory || rawDraft.category || "", 16)
    : "";
  const time = normalizeDatetimeLocal(rawDraft.time || rawDraft.date || rawDraft.datetime);
  const confidence = normalizeConfidence(rawDraft.confidence);
  const warnings = Array.isArray(rawDraft.warnings)
    ? rawDraft.warnings.map((item) => cleanText(item, 80)).filter(Boolean).slice(0, 4)
    : [];

  if (amount <= 0) warnings.push("未识别到有效金额，请手动确认。");
  if (!note && merchant) warnings.push("已识别商户，但用途备注仍建议确认。");

  return {
    amount,
    currency: cleanText(rawDraft.currency || "CNY", 8) || "CNY",
    merchant,
    note,
    category,
    customCategory,
    time,
    confidence,
    warnings: [...new Set(warnings)]
  };
}

export async function parseReceiptImageFile(file, {
  endpoint = getApiUrl("/api/receipt-parse"),
  allowedCategories = EXPENSE_CATEGORIES
} = {}) {
  const image = await readFileAsDataUrl(file);
  const response = await safeFetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image,
      mimeType: file.type,
      allowedCategories
    })
  }, "账单识别需要可访问的 AI 后端，请确认 API 地址后再试。");
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || "账单识别失败，请稍后重试。");
  }
  return normalizeReceiptDraft(payload, allowedCategories);
}

export async function requestDecisionAdvice(input, {
  endpoint = getApiUrl("/api/decision-advice")
} = {}) {
  const response = await safeFetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input || {})
  }, "水豚拍板需要可访问的 AI 后端，请确认 API 地址后再试。");
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || "水豚拍板暂时不可用，请稍后再试。");
  }
  return {
    advice: cleanText(payload.advice || "", 160) || "先选更省心的一项，把精力留给真正想体验的部分。",
    confidence: normalizeConfidence(payload.confidence),
    warnings: Array.isArray(payload.warnings)
      ? payload.warnings.map((item) => cleanText(item, 80)).filter(Boolean).slice(0, 3)
      : []
  };
}

async function safeFetch(endpoint, options, networkMessage) {
  try {
    return await fetch(endpoint, options);
  } catch {
    throw new Error(networkMessage);
  }
}

export function normalizeReceiptCategory(value, allowedCategories = EXPENSE_CATEGORIES) {
  const source = cleanText(value, 80).toLowerCase();
  const allowed = allowedCategories.length ? allowedCategories : EXPENSE_CATEGORIES;
  for (const category of allowed) {
    if (source === category.toLowerCase()) return category;
  }
  for (const category of allowed) {
    const aliases = CATEGORY_ALIASES.find((item) => item.category === category)?.aliases || [category];
    if (aliases.some((alias) => source.includes(alias.toLowerCase()))) return category;
  }
  return allowed.includes("其他") ? "其他" : allowed[0] || "其他";
}

export function normalizeDatetimeLocal(value) {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return value;
  const normalized = String(value).trim().replace(/\//g, "-").replace(" ", "T");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (item) => String(item).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function cleanText(value, maxLength) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizeAmount(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? round2(value) : 0;
  }
  const parsed = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? round2(parsed) : 0;
}

function normalizeConfidence(value) {
  const confidence = Number(value);
  if (!Number.isFinite(confidence)) return 0;
  if (confidence > 1) return round2(Math.min(confidence, 100) / 100);
  return round2(Math.max(0, Math.min(confidence, 1)));
}
