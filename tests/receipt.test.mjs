import assert from "node:assert/strict";
import test from "node:test";
import { normalizeReceiptDraft } from "../src/lib/receipt.js";
import { parseReceiptImage } from "../server/receiptService.mjs";

const tinyPng = "data:image/png;base64,iVBORw0KGgo=";
const categories = ["餐饮", "住宿", "交通", "门票", "购物", "其他"];

test("normalizes amount, category, time and confidence", () => {
  const draft = normalizeReceiptDraft({
    amount: "￥88.50",
    merchant: "山城火锅",
    category: "餐厅",
    time: "2026/05/11 18:30",
    confidence: 86
  }, categories);

  assert.equal(draft.amount, 88.5);
  assert.equal(draft.category, "餐饮");
  assert.equal(draft.note, "山城火锅");
  assert.equal(draft.time, "2026-05-11T18:30");
  assert.equal(draft.confidence, 0.86);
});

test("parses a valid Ollama JSON response", async () => {
  const draft = await parseReceiptImage({
    image: tinyPng,
    mimeType: "image/png",
    allowedCategories: categories
  }, {
    fetchImpl: async () => new Response(JSON.stringify({
      message: {
        content: JSON.stringify({
          amount: 42,
          merchant: "Metro",
          category: "地铁",
          confidence: 0.9
        })
      }
    }), { status: 200, headers: { "Content-Type": "application/json" } })
  });

  assert.equal(draft.amount, 42);
  assert.equal(draft.category, "交通");
  assert.equal(draft.confidence, 0.9);
});

test("rejects invalid model JSON", async () => {
  await assert.rejects(
    () => parseReceiptImage({ image: tinyPng, mimeType: "image/png" }, {
      fetchImpl: async () => new Response(JSON.stringify({ message: { content: "not json" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    }),
    /模型返回格式无效/
  );
});

test("keeps no-amount responses as drafts with warning", async () => {
  const draft = await parseReceiptImage({ image: tinyPng, mimeType: "image/png" }, {
    fetchImpl: async () => new Response(JSON.stringify({
      message: { content: JSON.stringify({ merchant: "Unknown", category: "其他" }) }
    }), { status: 200, headers: { "Content-Type": "application/json" } })
  });

  assert.equal(draft.amount, 0);
  assert.match(draft.warnings.join(" "), /金额/);
});

test("times out slow model requests", async () => {
  await assert.rejects(
    () => parseReceiptImage({ image: tinyPng, mimeType: "image/png" }, {
      timeoutMs: 10,
      fetchImpl: (_url, init) => new Promise((resolve, reject) => {
        init.signal.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
        setTimeout(() => resolve(new Response("{}")), 100);
      })
    }),
    /超时/
  );
});
