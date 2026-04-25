export const STORAGE_KEY = "travel";
export const MAX_PEOPLE = 10;
export const LOW_BALANCE_RATIO = 0.8;
export const EXPENSE_CATEGORIES = ["餐饮", "住宿", "交通", "门票", "购物", "其他"];
export const DECISION_TAGS = [
  "今晚吃火锅还是烧烤？",
  "打车还是坐地铁？",
  "先去景点还是先吃饭？",
  "现在回酒店还是继续逛？"
];
export const DECISION_REPLIES = [
  "先选更省心的方案，把精力留给拍照和休息。",
  "今天优先效率，选更近、更快的那条路。",
  "如果两边差不多，选更省钱的，把预算留给真正想吃的。",
  "别开会了，按第一个方案走，路上再微调。",
  "选大家都能接受的中间方案，少消耗一点关系。"
];

export function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function toPositiveNumber(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return round2(parsed);
}

export function formatCurrency(value) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY"
  }).format(Number(value || 0));
}

export function formatDateTime(value) {
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

export function formatShortDate(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "未命名行程";
  const pad = (n) => String(n).padStart(2, "0");
  return `水豚旅行-${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}

export function createId() {
  return `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

export function tripModeLabel(mode) {
  return mode === "shared" ? "多人付款模式" : "大家长模式";
}

export function getTripTitle(trip) {
  if (!trip) return "未命名行程";
  return trip.tripName || formatShortDate(trip.createdAt || trip.id);
}

export function displayCategory(expense) {
  const customCategory = String(expense?.customCategory || "").trim();
  return expense?.category === "其他" && customCategory ? customCategory : expense?.category || "其他";
}

export function sanitizeExpense(rawExpense) {
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

export function sanitizeTrip(rawTrip) {
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

export function sanitizeTrips(rawTrips) {
  return (Array.isArray(rawTrips) ? rawTrips : [])
    .map(sanitizeTrip)
    .sort((left, right) => {
      const leftTime = new Date(left.createdAt || left.id).getTime();
      const rightTime = new Date(right.createdAt || right.id).getTime();
      return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
    });
}

export function loadTrips() {
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

export function saveTrips(trips) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeTrips(trips)));
}

export function getRecordById(id) {
  return loadTrips().find((trip) => String(trip.id) === String(id)) || null;
}

export function updateTrip(tripId, updater) {
  const trips = loadTrips();
  const index = trips.findIndex((trip) => String(trip.id) === String(tripId));
  if (index < 0) return null;
  const updated = sanitizeTrip(typeof updater === "function" ? updater(trips[index]) : updater);
  trips[index] = updated;
  saveTrips(trips);
  return updated;
}

export function deleteTrip(tripId) {
  saveTrips(loadTrips().filter((trip) => String(trip.id) !== String(tripId)));
}

export function deleteExpense(tripId, expenseId) {
  return updateTrip(tripId, (trip) => ({
    ...trip,
    expenses: trip.expenses.filter((expense) => String(expense.id) !== String(expenseId))
  }));
}

export function calcLedger(trip) {
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

export function settle(trip) {
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

export function settleShared(trip) {
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

export function getCategoryTotals(trip) {
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

export function getBudgetProgress(trip) {
  return trip.totalBudget ? trip.currentSpent / trip.totalBudget : 0;
}

export function getProgressText(trip) {
  return `${Math.round(getBudgetProgress(trip) * 100)}%`;
}

export function getRemainingBudget(trip) {
  return round2(trip.totalBudget - trip.currentSpent);
}

export function buildReviewPosterLine(trip, parentResult, sharedResult) {
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
