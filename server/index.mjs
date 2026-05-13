import http from "node:http";
import { DecisionAdviceError, getDecisionAdvice } from "./decisionService.mjs";
import { parseReceiptImage, ReceiptParseError } from "./receiptService.mjs";

const PORT = Number(process.env.PORT || 8787);
const MAX_BODY_BYTES = 8 * 1024 * 1024;

const server = http.createServer(async (request, response) => {
  setCorsHeaders(response);

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method === "GET" && request.url === "/api/health") {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === "POST" && request.url === "/api/receipt-parse") {
    try {
      const body = await readJsonBody(request);
      const draft = await parseReceiptImage(body);
      sendJson(response, 200, draft);
    } catch (error) {
      const status = error instanceof ReceiptParseError ? error.status : 500;
      sendJson(response, status, { error: error.message || "账单识别失败。" });
    }
    return;
  }

  if (request.method === "POST" && request.url === "/api/decision-advice") {
    try {
      const body = await readJsonBody(request);
      const advice = await getDecisionAdvice(body);
      sendJson(response, 200, advice);
    } catch (error) {
      const status = getErrorStatus(error);
      sendJson(response, status, { error: error.message || "水豚拍板暂时不可用。" });
    }
    return;
  }

  sendJson(response, 404, { error: "接口不存在。" });
});

server.listen(PORT, () => {
  console.log(`Receipt API listening on http://localhost:${PORT}`);
});

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let raw = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      raw += chunk;
      if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
        request.destroy();
        reject(new ReceiptParseError("请求体不能超过 8MB。", 413));
      }
    });
    request.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new ReceiptParseError("请求 JSON 格式无效。", 400));
      }
    });
    request.on("error", reject);
  });
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function getErrorStatus(error) {
  if (error instanceof ReceiptParseError || error instanceof DecisionAdviceError) {
    return error.status;
  }
  return 500;
}

function setCorsHeaders(response) {
  response.setHeader("Access-Control-Allow-Origin", process.env.CORS_ORIGIN || "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
}
