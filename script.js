const STORAGE_KEY = "travel";
const MAX_PEOPLE = 10;
const LOW_BALANCE_RATIO = 0.8;
const EXPENSE_CATEGORIES = ["餐饮", "住宿", "交通", "门票", "购物", "其他"];
const DECISION_TAGS = [
  "今晚吃火锅还是烧烤？",
  "打车还是坐地铁？",
  "先去景点还是先吃饭？",
  "现在回酒店还是继续逛？"
];
const DECISION_REPLIES = [
  "先选更省心的方案，把精力留给拍照和休息。",
  "今天优先效率，选更近、更快的那条路。",
  "如果两边差不多，选更省钱的，把预算留给真正想吃的。",
  "别开会了，按第一个方案走，路上再微调。",
  "选大家都能接受的中间方案，少消耗一点关系。"
];

const createState = {
  mode: "parent",
  people: ["", ""]
};

const detailState = {
  tripId: "",
  selectedCategory: EXPENSE_CATEGORIES[0],
  selectedPayer: "",
  decisionTimer: null
};

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function toPositiveNumber(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return round2(parsed);
}

function formatCurrency(value) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY"
  }).format(Number(value || 0));
}

function formatDateTime(value) {
  if (!value) return "刚刚";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function formatShortDate(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "未命名行程";
  const pad = (n) => String(n).padStart(2, "0");
  return `水豚旅行-${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function createId() {
  return `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function parseQueryId() {
  return new URLSearchParams(window.location.search).get("id");
}

function tripModeLabel(mode) {
  return mode === "shared" ? "多人付款模式" : "大家长模式";
}

function getTripTitle(trip) {
  if (!trip) return "未命名行程";
  return trip.tripName || formatShortDate(trip.createdAt || trip.id);
}

function displayCategory(expense) {
  const customCategory = String(expense?.customCategory || "").trim();
  return expense?.category === "其他" && customCategory ? customCategory : expense?.category || "其他";
}

function loadTrips() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return sanitizeTrips(parsed);
    if (parsed && Array.isArray(parsed.trips)) return sanitizeTrips(parsed.trips);
    return [];
  } catch {
    return [];
  }
}

function saveTrips(trips) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeTrips(trips)));
}

function sanitizeTrips(rawTrips) {
  return (Array.isArray(rawTrips) ? rawTrips : [])
    .map(sanitizeTrip)
    .sort((left, right) => {
      const leftTime = new Date(left.createdAt || left.id).getTime();
      const rightTime = new Date(right.createdAt || right.id).getTime();
      return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
    });
}

function sanitizeTrip(rawTrip) {
  const rawPeople = Array.isArray(rawTrip?.people) ? rawTrip.people : [];
  const people = rawPeople.map((name) => String(name || "").trim()).filter(Boolean);
  const expenses = Array.isArray(rawTrip?.expenses)
    ? rawTrip.expenses.map(sanitizeExpense).filter((item) => item.amount > 0)
    : [];
  const mode = rawTrip?.mode === "shared" ? "shared" : "parent";
  const baseManager = String(rawTrip?.manager || "").trim();
  const manager = mode === "parent"
    ? (people.includes(baseManager) ? baseManager : people[0] || "")
    : (people.includes(baseManager) ? baseManager : "");
  let totalBudget = toPositiveNumber(rawTrip?.totalBudget);
  let per = toPositiveNumber(rawTrip?.per);

  if (mode === "parent") {
    if (per <= 0 && totalBudget > 0 && people.length) per = round2(totalBudget / people.length);
    if (totalBudget <= 0) totalBudget = round2(per * people.length);
  } else {
    if (totalBudget <= 0) totalBudget = round2(per * people.length);
    if (per <= 0 && people.length) per = round2(totalBudget / people.length);
  }

  return {
    id: String(rawTrip?.id || createId()),
    tripName: String(rawTrip?.tripName || rawTrip?.name || "").trim(),
    mode,
    people,
    manager,
    per,
    totalBudget,
    currentSpent: round2(expenses.reduce((sum, item) => sum + item.amount, 0)),
    expenses,
    createdAt: String(rawTrip?.createdAt || new Date().toISOString())
  };
}

function sanitizeExpense(rawExpense) {
  const participants = Array.isArray(rawExpense?.participants)
    ? rawExpense.participants.map((name) => String(name || "").trim()).filter(Boolean)
    : [];
  let category = String(rawExpense?.category || "其他").trim();
  let customCategory = String(rawExpense?.customCategory || "").trim();
  if (!EXPENSE_CATEGORIES.includes(category)) {
    customCategory = customCategory || category;
    category = "其他";
  }

  return {
    id: String(rawExpense?.id || createId()),
    amount: toPositiveNumber(rawExpense?.amount),
    category,
    customCategory: category === "其他" ? customCategory.slice(0, 16) : "",
    note: String(rawExpense?.note || rawExpense?.purpose || "").trim(),
    payer: String(rawExpense?.payer || "").trim(),
    participants,
    time: String(rawExpense?.time || "").trim()
  };
}

function getRecordById(id) {
  return loadTrips().find((trip) => String(trip.id) === String(id)) || null;
}

function updateTrip(tripId, updater) {
  const trips = loadTrips();
  const index = trips.findIndex((trip) => String(trip.id) === String(tripId));
  if (index < 0) return null;
  const updated = sanitizeTrip(typeof updater === "function" ? updater(trips[index]) : updater);
  trips[index] = updated;
  saveTrips(trips);
  return updated;
}

function deleteTrip(tripId) {
  saveTrips(loadTrips().filter((trip) => String(trip.id) !== String(tripId)));
}

function deleteExpense(tripId, expenseId) {
  return updateTrip(tripId, (trip) => ({
    ...trip,
    expenses: trip.expenses.filter((expense) => String(expense.id) !== String(expenseId))
  }));
}

function calcLedger(trip) {
  const ledger = {};
  for (const name of trip.people) ledger[name] = 0;
  for (const expense of trip.expenses) {
    const participants = (expense.participants || []).filter((name) => trip.people.includes(name));
    if (!participants.length || expense.amount <= 0) continue;
    const split = round2(expense.amount / participants.length);
    for (const name of participants) ledger[name] = round2((ledger[name] || 0) + split);
  }
  return ledger;
}

function settle(trip) {
  const ledger = calcLedger(trip);
  const totalExpense = round2(trip.expenses.reduce((sum, item) => sum + item.amount, 0));
  const totalBudget = round2(trip.per * trip.people.length);
  const balances = {};
  for (const name of trip.people) balances[name] = round2((trip.per || 0) - (ledger[name] || 0));
  if (totalExpense <= totalBudget) {
    return { mode: "refund", totalExpense, totalBudget, diff: round2(totalBudget - totalExpense), balances };
  }
  return {
    mode: "extra",
    totalExpense,
    totalBudget,
    diff: round2(totalExpense - totalBudget),
    extraPerPerson: trip.people.length ? round2((totalExpense - totalBudget) / trip.people.length) : 0,
    balances
  };
}

function toCents(value) {
  return Math.round(Number(value || 0) * 100);
}

function fromCents(value) {
  return round2(Number(value || 0) / 100);
}

function splitAmountCents(totalCents, count) {
  if (!count || count < 1) return [];
  const base = Math.floor(totalCents / count);
  const remainder = totalCents - base * count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

function settleShared(trip) {
  const balances = Object.fromEntries((trip.people || []).map((name) => [name, 0]));
  for (const expense of trip.expenses || []) {
    const payer = String(expense.payer || "").trim();
    const participants = (expense.participants || []).filter((name) => trip.people.includes(name));
    const amountCents = toCents(expense.amount);
    if (!payer || amountCents <= 0 || !participants.length) continue;
    if (!(payer in balances)) balances[payer] = 0;
    balances[payer] += amountCents;
    splitAmountCents(amountCents, participants.length).forEach((share, index) => {
      balances[participants[index]] = (balances[participants[index]] || 0) - share;
    });
  }

  const creditors = [];
  const debtors = [];
  for (const [name, cents] of Object.entries(balances)) {
    if (cents > 0) creditors.push({ name, cents });
    if (cents < 0) debtors.push({ name, cents: Math.abs(cents) });
  }

  const transfers = [];
  let creditorIndex = 0;
  let debtorIndex = 0;
  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];
    const cents = Math.min(creditor.cents, debtor.cents);
    if (cents > 0) transfers.push({ from: debtor.name, to: creditor.name, amount: fromCents(cents) });
    creditor.cents -= cents;
    debtor.cents -= cents;
    if (creditor.cents === 0) creditorIndex += 1;
    if (debtor.cents === 0) debtorIndex += 1;
  }

  return {
    totalExpense: round2(trip.expenses.reduce((sum, item) => sum + item.amount, 0)),
    net: Object.fromEntries(Object.entries(balances).map(([name, cents]) => [name, fromCents(cents)])),
    transfers
  };
}

function getCategoryTotals(trip) {
  const totals = new Map();
  for (const expense of trip.expenses || []) {
    const label = displayCategory(expense);
    totals.set(label, round2((totals.get(label) || 0) + expense.amount));
  }
  return Array.from(totals, ([category, amount]) => ({
    category,
    amount,
    percent: trip.currentSpent > 0 ? Math.round((amount / trip.currentSpent) * 100) : 0
  })).sort((left, right) => right.amount - left.amount);
}

function getBudgetProgress(trip) {
  return trip.totalBudget ? trip.currentSpent / trip.totalBudget : 0;
}

function getProgressText(trip) {
  return `${Math.round(getBudgetProgress(trip) * 100)}%`;
}

function getRemainingBudget(trip) {
  return round2(trip.totalBudget - trip.currentSpent);
}

function setMessage(element, text, type) {
  if (!element) return;
  element.textContent = text;
  element.className = `message ${type || ""}`.trim();
}

function buildReviewPosterLine(trip, parentResult, sharedResult) {
  if (trip.mode === "parent" && parentResult) {
    if (parentResult.mode === "extra") {
      const members = trip.people.filter((name) => name !== trip.manager);
      return `${members.join("、") || "各位队友"} 需要按结算结果补给 ${trip.manager || "大家长"}。`;
    }
    const refundTargets = trip.people.filter((name) => name !== trip.manager && (parentResult.balances[name] || 0) > 0);
    return `${trip.manager || "大家长"} 需要把 ${refundTargets.join("、") || "队友们"} 的剩余预算退出来。`;
  }
  if (trip.mode === "shared" && sharedResult) {
    const debtors = Array.from(new Set(sharedResult.transfers.map((item) => item.from)));
    return `${debtors.join("、") || "各位队友"} 按下面的转账路径处理就能平账。`;
  }
  return "账已经算清楚，剩下的就是转账确认。";
}

function renderCreatePeople() {
  const wrap = document.getElementById("people_fields");
  if (!wrap) return;
  wrap.innerHTML = createState.people.map((name, index) => `
    <div class="people-row">
      <input class="input person-input" type="text" maxlength="16" data-index="${index}" value="${escapeHtml(name)}" placeholder="成员 ${index + 1} 姓名" />
      ${createState.people.length > 2 ? `<button class="btn ghost remove-person-btn" type="button" data-index="${index}">删除</button>` : ""}
    </div>
  `).join("");
  syncCreateManagerOptions();
}

function syncCreateManagerOptions() {
  const managerSelect = document.getElementById("manager_select");
  if (!managerSelect) return;
  const previous = managerSelect.value;
  const names = createState.people.map((name, index) => String(name || "").trim() || `成员${index + 1}`);
  managerSelect.innerHTML = names.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
  if (names.includes(previous)) managerSelect.value = previous;
}

function renderCreateMode() {
  const modeHint = document.getElementById("mode_hint");
  const managerField = document.getElementById("manager_field");
  const budgetLabel = document.getElementById("budget_label");
  const budgetHint = document.getElementById("budget_hint");
  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === createState.mode);
  });
  if (createState.mode === "shared") {
    if (modeHint) modeHint.textContent = "多人各自付款，系统会按付款人和参与人生成最终转账路径。";
    if (managerField) managerField.hidden = true;
    if (budgetLabel) budgetLabel.textContent = "行程总预算";
    if (budgetHint) budgetHint.textContent = "多人付款模式直接使用你填写的总预算。";
  } else {
    if (modeHint) modeHint.textContent = "一个人统一管钱，其他人的分摊和补差额由系统计算。";
    if (managerField) managerField.hidden = false;
    if (budgetLabel) budgetLabel.textContent = "每人预算";
    if (budgetHint) budgetHint.textContent = "系统会按成员数自动换算总预算。";
  }
}

function initCreatePage() {
  const form = document.getElementById("create_form");
  const peopleFields = document.getElementById("people_fields");
  const addPersonButton = document.getElementById("add_person_btn");
  const modeSwitch = document.getElementById("mode_switch");
  if (!form || !peopleFields || !addPersonButton) return;

  const defaultMode = document.body?.dataset?.defaultMode;
  createState.mode = defaultMode === "shared" ? "shared" : "parent";

  renderCreatePeople();
  renderCreateMode();

  addPersonButton.addEventListener("click", () => {
    if (createState.people.length >= MAX_PEOPLE) return;
    createState.people.push("");
    renderCreatePeople();
  });

  peopleFields.addEventListener("input", (event) => {
    const input = event.target.closest(".person-input");
    if (!input) return;
    const index = Number(input.dataset.index);
    if (Number.isInteger(index)) createState.people[index] = input.value;
    syncCreateManagerOptions();
  });

  peopleFields.addEventListener("click", (event) => {
    const button = event.target.closest(".remove-person-btn");
    if (!button || createState.people.length <= 2) return;
    const index = Number(button.dataset.index);
    if (!Number.isInteger(index)) return;
    createState.people.splice(index, 1);
    renderCreatePeople();
  });

  if (modeSwitch) {
    modeSwitch.addEventListener("click", (event) => {
      const button = event.target.closest("[data-mode]");
      if (!button) return;
      createState.mode = button.dataset.mode === "shared" ? "shared" : "parent";
      renderCreateMode();
    });
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const message = document.getElementById("create_message");
    const tripName = document.getElementById("trip_name")?.value.trim() || "";
    const names = createState.people.map((name) => String(name || "").trim());
    const budget = toPositiveNumber(document.getElementById("budget_input")?.value);
    const manager = document.getElementById("manager_select")?.value || "";

    if (names.some((name) => !name)) return setMessage(message, "成员姓名不能为空。", "error");
    if (new Set(names).size !== names.length) return setMessage(message, "成员姓名不能重复。", "error");
    if (budget <= 0) return setMessage(message, "预算必须大于 0。", "error");
    if (createState.mode === "parent" && !names.includes(manager)) return setMessage(message, "大家长必须是成员之一。", "error");

    const totalBudget = createState.mode === "parent" ? round2(budget * names.length) : round2(budget);
    const trip = sanitizeTrip({
      id: createId(),
      tripName,
      mode: createState.mode,
      people: names,
      manager: createState.mode === "parent" ? manager : "",
      per: createState.mode === "parent" ? budget : round2(totalBudget / names.length),
      totalBudget,
      expenses: [],
      createdAt: new Date().toISOString()
    });
    const trips = loadTrips();
    trips.unshift(trip);
    saveTrips(trips);
    setMessage(message, "行程已创建，正在进入记账页。", "success");
    window.setTimeout(() => {
      window.location.href = `./detail.html?id=${encodeURIComponent(trip.id)}`;
    }, 240);
  });
}

function renderEmptyTrips(container, pageType) {
  container.innerHTML = `
    <div class="empty-state">
      <span class="badge">还没有行程</span>
      <h2 class="section-title">先创建一趟旅行，再回来继续记账和结算。</h2>
      <p class="meta-text">${pageType === "archive" ? "历史行程会保存在这里。" : "已有行程会显示预算、记录数和快捷操作。"}</p>
      <a class="btn primary" href="./create.html">创建行程</a>
    </div>
  `;
}

function renderTripCard(trip) {
  const progress = getBudgetProgress(trip);
  const progressWidth = Math.min(Math.max(progress, 0), 1) * 100;
  const isAlert = progress >= LOW_BALANCE_RATIO;
  return `
    <article class="trip-card">
      <div class="trip-head">
        <div>
          <h3 class="section-title">${escapeHtml(getTripTitle(trip))}</h3>
          <p class="meta-text">${tripModeLabel(trip.mode)} · ${escapeHtml(trip.people.join("、") || "暂无成员")}</p>
        </div>
        <span class="badge ${isAlert ? "alert" : ""}">${isAlert ? "预算告急" : "状态正常"}</span>
      </div>
      <div class="metrics-grid compact">
        <div class="metric"><span class="meta-text">总预算</span><strong>${formatCurrency(trip.totalBudget)}</strong></div>
        <div class="metric"><span class="meta-text">总支出</span><strong>${formatCurrency(trip.currentSpent)}</strong></div>
        <div class="metric"><span class="meta-text">记录数</span><strong>${trip.expenses.length} 笔</strong></div>
      </div>
      <div class="progress"><div class="progress-bar ${isAlert ? "alert" : ""}" style="width:${progressWidth}%"></div></div>
      <div class="stat-line"><span>剩余预算 ${formatCurrency(getRemainingBudget(trip))}</span><strong>${getProgressText(trip)}</strong></div>
      <div class="trip-actions">
        <a class="btn primary" href="./detail.html?id=${encodeURIComponent(trip.id)}">继续记账</a>
        <a class="btn secondary" href="./review.html?id=${encodeURIComponent(trip.id)}">查看结算</a>
        <button class="btn danger" type="button" data-action="delete-trip" data-id="${escapeHtml(trip.id)}">删除行程</button>
      </div>
    </article>
  `;
}

function bindTripList(containerId, pageType) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const trips = loadTrips();
  if (!trips.length) {
    renderEmptyTrips(container, pageType);
    return;
  }
  container.innerHTML = trips.map(renderTripCard).join("");
  container.onclick = (event) => {
    const button = event.target.closest("[data-action='delete-trip']");
    if (!button) return;
    const trip = getRecordById(button.dataset.id);
    if (!trip || !window.confirm(`确认删除「${getTripTitle(trip)}」吗？`)) return;
    deleteTrip(button.dataset.id);
    bindTripList(containerId, pageType);
  };
}

function renderPageNotFound(title, description) {
  const main = document.querySelector(".page-shell");
  if (!main) return;
  main.innerHTML = `
    <section class="empty-state">
      <span class="badge alert">未找到行程</span>
      <h1 class="page-title">${escapeHtml(title)}</h1>
      <p class="meta-text">${escapeHtml(description)}</p>
      <div class="hero-actions">
        <a class="btn primary" href="./create.html">创建行程</a>
        <a class="btn secondary" href="./manage.html">查看已有行程</a>
      </div>
    </section>
  `;
}

function renderCategoryButtons() {
  const container = document.getElementById("category_group");
  const customField = document.getElementById("custom_category_field");
  if (!container) return;
  container.innerHTML = EXPENSE_CATEGORIES.map((category) => `
    <button class="chip ${category === detailState.selectedCategory ? "active" : ""}" type="button" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>
  `).join("");
  if (customField) customField.hidden = detailState.selectedCategory !== "其他";
}

function renderPayerOptions(trip) {
  const payerField = document.getElementById("payer_field");
  const payerInput = document.getElementById("payer_input");
  if (!payerField || !payerInput) return;
  payerField.hidden = trip.mode !== "shared";
  if (trip.mode !== "shared") {
    payerInput.value = "";
    detailState.selectedPayer = "";
    return;
  }
  payerInput.value = detailState.selectedPayer;
}

function renderParticipantBoxes(trip) {
  const boxes = document.getElementById("participant_boxes");
  if (!boxes) return;
  boxes.innerHTML = trip.people.map((name) => `
    <label class="checkbox-pill">
      <input type="checkbox" value="${escapeHtml(name)}" checked />
      <span>${escapeHtml(name)}</span>
    </label>
  `).join("");
}

function renderExpenseList(trip) {
  const list = document.getElementById("expense_list");
  const badge = document.getElementById("expense_count_badge");
  if (!list || !badge) return;
  badge.textContent = `${trip.expenses.length} 笔`;
  if (!trip.expenses.length) {
    list.innerHTML = `<div class="expense-item">还没有任何记录，先记下第一笔共同支出。</div>`;
    return;
  }
  list.innerHTML = [...trip.expenses].reverse().map((expense) => {
    const split = expense.participants.length ? round2(expense.amount / expense.participants.length) : 0;
    const payer = expense.payer || trip.manager || "-";
    return `
      <article class="expense-item">
        <div class="expense-head">
          <div>
            <span class="badge">${escapeHtml(displayCategory(expense))}</span>
            <p class="meta-text">${formatDateTime(expense.time || expense.id)}</p>
          </div>
          <strong>${formatCurrency(expense.amount)}</strong>
        </div>
        <p class="meta-text">付款人：${escapeHtml(payer)}</p>
        <p class="meta-text">参与人：${escapeHtml(expense.participants.join("、") || "-")}</p>
        <p class="meta-text">用途备注：${escapeHtml(expense.note || "-")} · 本笔人均 ${formatCurrency(split)}</p>
        <div class="item-actions">
          <button class="btn ghost danger-text" type="button" data-action="delete-expense" data-id="${escapeHtml(expense.id)}">删除这笔支出</button>
        </div>
      </article>
    `;
  }).join("");
}

function renderLedgerView(trip) {
  const view = document.getElementById("ledger_view");
  if (!view) return;
  if (trip.mode === "shared") {
    const shared = settleShared(trip);
    const names = Object.keys(shared.net);
    view.innerHTML = names.map((name) => {
      const amount = shared.net[name] || 0;
      const status = amount > 0 ? "应收" : amount < 0 ? "应付" : "已平账";
      return `
        <article class="ledger-item">
          <div class="expense-head">
            <strong>${escapeHtml(name)}</strong>
            <span class="badge ${amount < 0 ? "alert" : ""}">${status}</span>
          </div>
          <p class="big-number">${amount > 0 ? "+" : ""}${formatCurrency(amount)}</p>
          <p class="meta-text">净额 = 实际付款 - 应承担份额</p>
        </article>
      `;
    }).join("");
    return;
  }

  const ledger = calcLedger(trip);
  view.innerHTML = trip.people.map((name) => {
    const spent = ledger[name] || 0;
    const balance = round2((trip.per || 0) - spent);
    return `
      <article class="ledger-item">
        <div class="expense-head">
          <strong>${escapeHtml(name)}</strong>
          <span class="badge ${balance < 0 ? "alert" : ""}">${balance < 0 ? "已超支" : "未超支"}</span>
        </div>
        <p class="meta-text">已分摊：${formatCurrency(spent)}</p>
        <p class="meta-text">人均预算：${formatCurrency(trip.per)}</p>
        <p class="big-number">${formatCurrency(balance)}</p>
      </article>
    `;
  }).join("");
}

function renderDetailOverview(trip) {
  const title = document.getElementById("detail_title");
  const heading = document.getElementById("detail_heading");
  const meta = document.getElementById("detail_meta");
  const badge = document.getElementById("detail_mode_badge");
  const metrics = document.getElementById("detail_metrics");
  const progressBar = document.getElementById("budget_progress_bar");
  const progressText = document.getElementById("budget_progress_text");
  const reviewLink = document.getElementById("review_link");
  const expenseLink = document.getElementById("expense_link");
  const budgetLink = document.getElementById("budget_link");
  if (!title || !heading || !meta || !badge || !metrics || !progressBar || !progressText || !reviewLink) return;

  const progress = getBudgetProgress(trip);
  const remaining = getRemainingBudget(trip);
  title.textContent = getTripTitle(trip);
  heading.textContent = getTripTitle(trip);
  meta.textContent = `${tripModeLabel(trip.mode)} · 成员：${trip.people.join("、") || "-"}${trip.mode === "parent" ? ` · 大家长：${trip.manager || "-"}` : ""}`;
  badge.textContent = tripModeLabel(trip.mode);
  metrics.innerHTML = `
    <div class="metric"><span class="meta-text">总预算</span><strong>${formatCurrency(trip.totalBudget)}</strong></div>
    <div class="metric"><span class="meta-text">总支出</span><strong>${formatCurrency(trip.currentSpent)}</strong></div>
    <div class="metric"><span class="meta-text">剩余预算</span><strong>${formatCurrency(remaining)}</strong></div>
  `;
  progressBar.style.width = `${Math.min(Math.max(progress, 0), 1) * 100}%`;
  progressBar.classList.toggle("alert", progress >= LOW_BALANCE_RATIO);
  progressText.textContent = getProgressText(trip);
  reviewLink.href = `./review.html?id=${encodeURIComponent(trip.id)}`;
  if (expenseLink) expenseLink.href = `./expense.html?id=${encodeURIComponent(trip.id)}`;
  if (budgetLink) budgetLink.href = `./budget.html?id=${encodeURIComponent(trip.id)}`;

  const warning = document.getElementById("budget_warning");
  const warningText = document.getElementById("budget_warning_text");
  const warningBadge = document.getElementById("budget_warning_badge");
  if (!warning || !warningText || !warningBadge) return;
  if (progress >= LOW_BALANCE_RATIO) {
    warning.hidden = false;
    warningBadge.textContent = progress > 1 ? "已超预算" : "预算告急";
    warningText.textContent = progress > 1
      ? `当前已经超出预算 ${formatCurrency(Math.abs(remaining))}，建议追加预算或进入结算。`
      : `当前已使用 ${Math.round(progress * 100)}% 预算，仅剩 ${formatCurrency(remaining)}。`;
  } else {
    warning.hidden = true;
  }
}

function resetDetailForm(trip) {
  const expenseAmount = document.getElementById("expense_amount");
  const expenseNote = document.getElementById("expense_note");
  const expenseTime = document.getElementById("expense_time");
  const payerInput = document.getElementById("payer_input");
  const customInput = document.getElementById("custom_category_input");
  if (expenseAmount) expenseAmount.value = "";
  if (expenseNote) expenseNote.value = "";
  if (expenseTime) expenseTime.value = "";
  if (customInput) customInput.value = "";
  if (trip.mode === "shared") {
    detailState.selectedPayer = "";
    if (payerInput) payerInput.value = "";
  }
  detailState.selectedCategory = EXPENSE_CATEGORIES[0];
  renderCategoryButtons();
  renderParticipantBoxes(trip);
}

function renderDetailSnapshot(options = {}) {
  const trip = getRecordById(detailState.tripId);
  if (!trip) {
    renderPageNotFound("这趟行程不存在了。", "可能已经被删除，或当前链接参数不正确。");
    return;
  }
  renderDetailOverview(trip);
  if (document.getElementById("category_group")) renderCategoryButtons();
  if (document.getElementById("payer_field")) renderPayerOptions(trip);
  if (options.resetParticipants && document.getElementById("participant_boxes")) renderParticipantBoxes(trip);
  renderExpenseList(trip);
  renderLedgerView(trip);
}

function getCheckedParticipants() {
  return Array.from(document.querySelectorAll("#participant_boxes input[type='checkbox']:checked"))
    .map((checkbox) => checkbox.value);
}

function initDetailPage() {
  const tripId = parseQueryId();
  const trip = getRecordById(tripId);
  if (!trip) {
    renderPageNotFound("没有找到这趟行程。", "请从已有行程页面重新进入。");
    return;
  }
  detailState.tripId = tripId;
  detailState.selectedCategory = EXPENSE_CATEGORIES[0];
  detailState.selectedPayer = "";

  const expenseList = document.getElementById("expense_list");

  expenseList?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action='delete-expense']");
    if (!button) return;
    const activeTrip = getRecordById(detailState.tripId);
    const expense = activeTrip?.expenses.find((item) => String(item.id) === String(button.dataset.id));
    if (!activeTrip || !expense) return;
    const label = expense.note || displayCategory(expense);
    if (!window.confirm(`确认删除「${label}」这笔支出吗？`)) return;
    deleteExpense(detailState.tripId, button.dataset.id);
    setMessage(document.getElementById("detail_message"), "这笔支出已删除。", "success");
    renderDetailSnapshot({ resetParticipants: false });
  });

  renderDetailSnapshot({ resetParticipants: false });
}

function bindDecisionHelper() {
  const decisionTags = document.getElementById("decision_tags");
  const decisionButton = document.getElementById("decision_button");
  const decisionPrompt = document.getElementById("decision_prompt");
  const decisionReply = document.getElementById("decision_reply");

  if (decisionTags) {
    decisionTags.innerHTML = DECISION_TAGS.map((tag) => `<button class="chip" type="button" data-prompt="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`).join("");
    decisionTags.addEventListener("click", (event) => {
      const button = event.target.closest("[data-prompt]");
      if (button && decisionPrompt) decisionPrompt.value = button.dataset.prompt || "";
    });
  }

  decisionButton?.addEventListener("click", () => {
    if (!decisionPrompt || !decisionReply) return;
    const prompt = decisionPrompt.value.trim();
    if (!prompt) {
      decisionReply.textContent = "先把问题写下来。";
      return;
    }
    if (detailState.decisionTimer) window.clearTimeout(detailState.decisionTimer);
    decisionReply.textContent = "正在想一个不内耗的答案...";
    detailState.decisionTimer = window.setTimeout(() => {
      const reply = DECISION_REPLIES[Math.floor(Math.random() * DECISION_REPLIES.length)];
      decisionReply.textContent = `${reply} 问题：${prompt}`;
    }, 420);
  });
}

function initExpensePage() {
  const tripId = parseQueryId();
  const trip = getRecordById(tripId);
  if (!trip) {
    renderPageNotFound("没有找到这趟行程。", "请从已有行程页面重新进入。");
    return;
  }
  detailState.tripId = tripId;
  detailState.selectedCategory = EXPENSE_CATEGORIES[0];
  detailState.selectedPayer = "";

  const title = document.getElementById("expense_title");
  const meta = document.getElementById("expense_trip_meta");
  const backLink = document.getElementById("expense_back_link");
  const expenseForm = document.getElementById("expense_form");
  const categoryGroup = document.getElementById("category_group");
  const payerInput = document.getElementById("payer_input");

  if (title) title.textContent = getTripTitle(trip);
  if (meta) meta.textContent = `${tripModeLabel(trip.mode)} · 成员：${trip.people.join("、") || "-"}${trip.mode === "parent" ? ` · 大家长：${trip.manager || "-"}` : ""}`;
  if (backLink) backLink.href = `./detail.html?id=${encodeURIComponent(trip.id)}`;

  categoryGroup?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");
    if (!button) return;
    detailState.selectedCategory = button.dataset.category || EXPENSE_CATEGORIES[0];
    renderCategoryButtons();
    if (detailState.selectedCategory === "其他") document.getElementById("custom_category_input")?.focus();
  });

  payerInput?.addEventListener("input", () => {
    detailState.selectedPayer = payerInput.value.trim();
  });

  expenseForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const activeTrip = getRecordById(detailState.tripId);
    if (!activeTrip) return;
    const message = document.getElementById("detail_message");
    const amount = toPositiveNumber(document.getElementById("expense_amount")?.value);
    const note = document.getElementById("expense_note")?.value.trim() || "";
    const time = document.getElementById("expense_time")?.value || "";
    const customCategory = document.getElementById("custom_category_input")?.value.trim() || "";
    const participants = getCheckedParticipants();
    const payer = activeTrip.mode === "shared"
      ? (detailState.selectedPayer || payerInput?.value.trim() || "")
      : activeTrip.manager;

    if (amount <= 0) return setMessage(message, "金额必须大于 0。", "error");
    if (!participants.length) return setMessage(message, "至少选择 1 位参与人。", "error");
    if (detailState.selectedCategory === "其他" && !customCategory) return setMessage(message, "请填写其他分类名称。", "error");
    if (activeTrip.mode === "shared" && !payer) return setMessage(message, "请填写付款人。", "error");

    const expense = sanitizeExpense({
      id: createId(),
      amount,
      category: detailState.selectedCategory,
      customCategory,
      note,
      payer,
      participants,
      time
    });
    updateTrip(detailState.tripId, (currentTrip) => ({
      ...currentTrip,
      expenses: [...currentTrip.expenses, expense]
    }));

    setMessage(message, "支出已记录，可以继续记下一笔。", "success");
    resetDetailForm(getRecordById(detailState.tripId));
    window.setTimeout(() => document.getElementById("expense_amount")?.focus(), 80);
  });

  renderCategoryButtons();
  renderPayerOptions(trip);
  renderParticipantBoxes(trip);
  bindDecisionHelper();
}

function initBudgetPage() {
  const tripId = parseQueryId();
  const trip = getRecordById(tripId);
  if (!trip) {
    renderPageNotFound("没有找到这趟行程。", "请从已有行程页面重新进入。");
    return;
  }
  detailState.tripId = tripId;

  const title = document.getElementById("budget_title");
  const backLink = document.getElementById("budget_back_link");
  const appendHint = document.getElementById("budget_append_hint");
  const budgetForm = document.getElementById("budget_form");
  if (title) title.textContent = getTripTitle(trip);
  if (backLink) backLink.href = `./detail.html?id=${encodeURIComponent(trip.id)}`;
  if (appendHint) {
    appendHint.textContent = trip.mode === "shared"
      ? "多人付款模式会增加总预算，并刷新人均参考值。"
      : "大家长模式会重新平均到每个人的预算。";
  }

  budgetForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = document.getElementById("budget_append_input");
    const message = document.getElementById("detail_message");
    const amount = toPositiveNumber(input?.value);
    if (amount <= 0) return setMessage(message, "追加预算必须大于 0。", "error");
    updateTrip(detailState.tripId, (currentTrip) => {
      const totalBudget = round2(currentTrip.totalBudget + amount);
      return {
        ...currentTrip,
        totalBudget,
        per: currentTrip.people.length ? round2(totalBudget / currentTrip.people.length) : currentTrip.per
      };
    });
    if (input) input.value = "";
    setMessage(message, "预算已追加。", "success");
    if (appendHint) appendHint.textContent = `当前总预算已更新为 ${formatCurrency(getRecordById(detailState.tripId)?.totalBudget || 0)}。`;
  });
}

function renderCategoryShareList(trip) {
  const container = document.getElementById("category_share_list");
  if (!container) return;
  const totals = getCategoryTotals(trip);
  if (!totals.length) {
    container.innerHTML = `<div class="settlement-item">还没有支出记录，暂无分类占比。</div>`;
    return;
  }
  container.innerHTML = totals.map((item) => `
    <article class="settlement-item">
      <div class="expense-head">
        <strong>${escapeHtml(item.category)}</strong>
        <span>${formatCurrency(item.amount)} · ${item.percent}%</span>
      </div>
      <div class="progress"><div class="progress-bar" style="width:${item.percent}%"></div></div>
    </article>
  `).join("");
}

function renderSpendList(trip) {
  const list = document.getElementById("spend_list");
  if (!list) return;
  if (!trip.expenses.length) {
    list.innerHTML = `<div class="expense-item">这趟旅行还没有支出记录。</div>`;
    return;
  }
  list.innerHTML = trip.expenses.map((expense, index) => {
    const split = expense.participants.length ? round2(expense.amount / expense.participants.length) : 0;
    const payer = expense.payer || trip.manager || "-";
    return `
      <article class="expense-item">
        <div class="expense-head">
          <div>
            <strong>#${index + 1} · ${escapeHtml(expense.note || displayCategory(expense))}</strong>
            <p class="meta-text">${formatDateTime(expense.time || expense.id)}</p>
          </div>
          <span class="badge">${escapeHtml(displayCategory(expense))}</span>
        </div>
        <p class="meta-text">付款人：${escapeHtml(payer)}</p>
        <p class="meta-text">参与人：${escapeHtml(expense.participants.join("、") || "-")}</p>
        <p class="meta-text">金额：${formatCurrency(expense.amount)} · 人均 ${formatCurrency(split)}</p>
      </article>
    `;
  }).join("");
}

function renderParentSettlement(trip, result) {
  const list = document.getElementById("settlement_view");
  if (!list) return;
  const members = trip.people.filter((name) => name !== trip.manager);
  const transferRows = result.mode === "extra"
    ? members.map((name) => ({ label: `${name} 补给 ${trip.manager || "大家长"}`, amount: result.extraPerPerson }))
    : members
        .map((name) => ({ label: `${trip.manager || "大家长"} 退给 ${name}`, amount: Math.max(0, result.balances[name] || 0) }))
        .filter((item) => item.amount > 0);
  list.innerHTML = `
    <article class="settlement-item">
      <div class="settlement-head">
        <div>
          <span class="badge ${result.mode === "extra" ? "alert" : ""}">${result.mode === "extra" ? "超支补款" : "预算返还"}</span>
          <h3 class="section-title">${result.mode === "extra" ? "需要补款" : "需要退款"}</h3>
        </div>
        <strong>${formatCurrency(result.mode === "extra" ? result.diff : result.totalBudget - result.totalExpense)}</strong>
      </div>
      <p class="meta-text">总预算 ${formatCurrency(result.totalBudget)}，总支出 ${formatCurrency(result.totalExpense)}。</p>
    </article>
    ${
      transferRows.length
        ? transferRows.map((row) => `<article class="settlement-item"><div class="expense-head"><strong>${escapeHtml(row.label)}</strong><strong>${formatCurrency(row.amount)}</strong></div></article>`).join("")
        : `<article class="settlement-item">目前没有需要执行的退款或补款动作。</article>`
    }
  `;
}

function renderSharedSettlement(trip, result) {
  const list = document.getElementById("settlement_view");
  if (!list) return;
  const netRows = Object.entries(result.net || {});
  list.innerHTML = `
    <article class="settlement-item">
      <div class="settlement-head">
        <div>
          <span class="badge">多人付款结算</span>
          <h3 class="section-title">按路径转账即可平账</h3>
        </div>
        <strong>${formatCurrency(result.totalExpense)}</strong>
      </div>
      <p class="meta-text">系统已按付款人和参与人计算净额。</p>
    </article>
    <article class="settlement-item">
      <strong>净额概览</strong>
      <div class="tag-list">
        ${netRows.length ? netRows.map(([name, amount]) => `
          <div class="about-item">
            <strong>${escapeHtml(name)}</strong>
            <p class="meta-text">${amount > 0 ? "应收" : amount < 0 ? "应付" : "已平账"} · ${amount > 0 ? "+" : ""}${formatCurrency(amount)}</p>
          </div>
        `).join("") : `<p class="meta-text">暂无净额数据。</p>`}
      </div>
    </article>
    <article class="settlement-item">
      <strong>转账路径</strong>
      <div class="tag-list">
        ${
          result.transfers.length
            ? result.transfers.map((transfer) => `<div class="about-item"><strong>${escapeHtml(transfer.from)} → ${escapeHtml(transfer.to)}</strong><p class="meta-text">${formatCurrency(transfer.amount)}</p></div>`).join("")
            : `<p class="meta-text">这趟行程已经平账，不需要额外转账。</p>`
        }
      </div>
    </article>
  `;
}

function initSummaryPage() {
  const tripId = parseQueryId();
  const trip = getRecordById(tripId);
  if (!trip) {
    renderPageNotFound("没有找到这趟行程。", "请从已有行程页面重新进入。");
    return;
  }

  const title = document.getElementById("summary_title");
  const heading = document.getElementById("summary_heading");
  const info = document.getElementById("summary_info");
  const metrics = document.getElementById("summary_metrics");
  const backLink = document.getElementById("summary_back_detail");
  const poster = document.getElementById("review_poster_line");
  if (!title || !heading || !info || !metrics || !backLink || !poster) return;

  const parentResult = trip.mode === "parent" ? settle(trip) : null;
  const sharedResult = trip.mode === "shared" ? settleShared(trip) : null;
  title.textContent = `${getTripTitle(trip)} · 结算`;
  heading.textContent = getTripTitle(trip);
  info.textContent = `${tripModeLabel(trip.mode)} · 成员：${trip.people.join("、") || "-"}${trip.mode === "parent" ? ` · 大家长：${trip.manager || "-"}` : ""}`;
  backLink.href = `./detail.html?id=${encodeURIComponent(trip.id)}`;
  poster.textContent = buildReviewPosterLine(trip, parentResult, sharedResult);

  const remaining = getRemainingBudget(trip);
  metrics.innerHTML = `
    <div class="metric"><span class="meta-text">总预算</span><strong>${formatCurrency(trip.totalBudget)}</strong></div>
    <div class="metric"><span class="meta-text">总支出</span><strong>${formatCurrency(trip.currentSpent)}</strong></div>
    <div class="metric"><span class="meta-text">预算结余</span><strong>${formatCurrency(remaining)}</strong></div>
  `;
  renderCategoryShareList(trip);
  renderSpendList(trip);
  if (trip.mode === "shared" && sharedResult) renderSharedSettlement(trip, sharedResult);
  if (trip.mode === "parent" && parentResult) renderParentSettlement(trip, parentResult);
}

function initPage() {
  const page = document.body?.dataset?.page || "";
  if (page === "create") initCreatePage();
  if (page === "manage") bindTripList("manage_list", "manage");
  if (page === "archive") bindTripList("archive_list", "archive");
  if (page === "detail") initDetailPage();
  if (page === "expense") initExpensePage();
  if (page === "budget") initBudgetPage();
  if (page === "summary" || page === "review") initSummaryPage();
}

document.addEventListener("DOMContentLoaded", initPage);
