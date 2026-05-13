const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";
const DEFAULT_OLLAMA_MODEL = "gemma4:e4b";
const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
const DEFAULT_TIMEOUT_MS = 120000;

export class AIServiceError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = "AIServiceError";
    this.status = status;
  }
}

export async function generateAiText({
  messages,
  images = [],
  temperature = 0
}, {
  fetchImpl = globalThis.fetch,
  provider = process.env.AI_PROVIDER || inferProvider(),
  timeoutMs = Number(process.env.AI_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
  ollamaBaseUrl = process.env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_BASE_URL,
  ollamaModel = process.env.OLLAMA_MODEL || DEFAULT_OLLAMA_MODEL,
  openAiBaseUrl = process.env.AI_BASE_URL || DEFAULT_OPENAI_BASE_URL,
  openAiApiKey = process.env.AI_API_KEY || "",
  openAiModel = process.env.AI_MODEL || DEFAULT_OPENAI_MODEL
} = {}) {
  if (typeof fetchImpl !== "function") throw new AIServiceError("当前 Node 版本不支持 fetch。", 500);
  const cleanMessages = normalizeMessages(messages);
  if (!cleanMessages.length) throw new AIServiceError("AI 请求内容不能为空。", 400);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    if (provider === "openai") {
      return await callOpenAiCompatible({
        fetchImpl,
        baseUrl: openAiBaseUrl,
        apiKey: openAiApiKey,
        model: openAiModel,
        messages: cleanMessages,
        images,
        temperature,
        signal: controller.signal
      });
    }

    return await callOllama({
      fetchImpl,
      baseUrl: ollamaBaseUrl,
      model: ollamaModel,
      messages: cleanMessages,
      images,
      temperature,
      signal: controller.signal
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new AIServiceError("AI 请求超时，请稍后重试。", 504);
    }
    if (error instanceof AIServiceError) throw error;
    throw new AIServiceError(error.message || "AI 服务暂时不可用。", 502);
  } finally {
    clearTimeout(timeout);
  }
}

function inferProvider() {
  return process.env.AI_API_KEY || process.env.AI_BASE_URL ? "openai" : "ollama";
}

function normalizeMessages(messages) {
  return (Array.isArray(messages) ? messages : [])
    .map((message) => ({
      role: ["system", "assistant", "user"].includes(message?.role) ? message.role : "user",
      content: String(message?.content || "").trim()
    }))
    .filter((message) => message.content);
}

async function callOllama({ fetchImpl, baseUrl, model, messages, images, temperature, signal }) {
  const ollamaMessages = messages.map((message) => ({ ...message }));
  const imagePayloads = normalizeImages(images).map((image) => image.base64);
  if (imagePayloads.length) {
    const userIndex = findLastUserMessageIndex(ollamaMessages);
    ollamaMessages[userIndex].images = imagePayloads;
  }

  const response = await fetchImpl(`${baseUrl.replace(/\/$/, "")}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      model,
      stream: false,
      options: { temperature },
      messages: ollamaMessages
    })
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new AIServiceError(payload?.error || `Ollama 请求失败：${response.status}`, 502);
  }
  return String(payload?.message?.content || payload?.response || "").trim();
}

async function callOpenAiCompatible({ fetchImpl, baseUrl, apiKey, model, messages, images, temperature, signal }) {
  if (!apiKey) throw new AIServiceError("缺少 AI_API_KEY，无法调用云端 AI。", 500);
  const finalMessages = attachImagesToMessages(messages, normalizeImages(images));
  const response = await fetchImpl(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    signal,
    body: JSON.stringify({
      model,
      temperature,
      messages: finalMessages
    })
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new AIServiceError(payload?.error?.message || `AI 请求失败：${response.status}`, 502);
  }
  return String(payload?.choices?.[0]?.message?.content || "").trim();
}

function normalizeImages(images) {
  return (Array.isArray(images) ? images : [])
    .map((image) => ({
      mimeType: String(image?.mimeType || "image/png"),
      base64: String(image?.base64 || "")
    }))
    .filter((image) => image.base64);
}

function attachImagesToMessages(messages, images) {
  if (!images.length) return messages;
  const finalMessages = messages.map((message) => ({ ...message }));
  const userIndex = findLastUserMessageIndex(finalMessages);
  finalMessages[userIndex].content = [
    { type: "text", text: finalMessages[userIndex].content },
    ...images.map((image) => ({
      type: "image_url",
      image_url: { url: `data:${image.mimeType};base64,${image.base64}` }
    }))
  ];
  return finalMessages;
}

function findLastUserMessageIndex(messages) {
  const index = messages.map((message) => message.role).lastIndexOf("user");
  if (index >= 0) return index;
  messages.push({ role: "user", content: "" });
  return messages.length - 1;
}
