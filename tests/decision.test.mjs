import assert from "node:assert/strict";
import test from "node:test";
import { getDecisionAdvice } from "../server/decisionService.mjs";

test("rejects empty decision prompts", async () => {
  await assert.rejects(
    () => getDecisionAdvice({ prompt: "" }, {
      fetchImpl: async () => new Response("{}")
    }),
    /先把问题写下来/
  );
});

test("returns normalized decision advice from Ollama JSON", async () => {
  let requestBody = null;
  const advice = await getDecisionAdvice({
    prompt: "今晚吃火锅还是烧烤？",
    tripTitle: "重庆周末",
    people: ["qq", "ww"],
    category: "餐饮",
    amount: "120"
  }, {
    provider: "ollama",
    fetchImpl: async (_url, init) => {
      requestBody = JSON.parse(init.body);
      return new Response(JSON.stringify({
        message: {
          content: JSON.stringify({
            advice: "选火锅，距离近又更符合这趟重庆行程。",
            confidence: 0.82,
            warnings: ["记得确认排队时间。"]
          })
        }
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
  });

  assert.equal(requestBody.model, "gemma4:e4b");
  assert.equal(advice.advice, "选火锅，距离近又更符合这趟重庆行程。");
  assert.equal(advice.confidence, 0.82);
  assert.deepEqual(advice.warnings, ["记得确认排队时间。"]);
});

test("times out slow decision advice requests", async () => {
  await assert.rejects(
    () => getDecisionAdvice({ prompt: "打车还是地铁？" }, {
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
