import { formatCurrency, getTripTitle } from "./travel";

export function getSettlementTransfers(trip, parentResult, sharedResult) {
  if (trip.mode === "shared" && sharedResult) return sharedResult.transfers || [];
  if (trip.mode === "parent" && parentResult) {
    const members = trip.people.filter((name) => name !== trip.manager);
    if (parentResult.mode === "extra") {
      return members.map((name) => ({
        from: name,
        to: trip.manager || "大家长",
        amount: parentResult.extraPerPerson
      }));
    }
    return members
      .map((name) => ({
        from: trip.manager || "大家长",
        to: name,
        amount: Math.max(0, parentResult.balances[name] || 0)
      }))
      .filter((item) => item.amount > 0);
  }
  return [];
}

export function buildSettlementShareText(trip, parentResult, sharedResult) {
  const transfers = getSettlementTransfers(trip, parentResult, sharedResult);
  const totalExpense = trip.mode === "shared" && sharedResult
    ? sharedResult.totalExpense
    : parentResult?.totalExpense ?? trip.currentSpent;
  const rows = transfers.length
    ? transfers.map((item) => `${item.from} 需要转给 ${item.to}：${formatCurrency(item.amount)}`)
    : ["本次已平账，无需额外转账。"];
  return [
    `【水豚旅行·${getTripTitle(trip)} 结算单】`,
    `总耗费：${formatCurrency(totalExpense)}`,
    "--- 结算方案 ---",
    ...rows,
    "---",
    "已算清，各位老板请结账 🦦"
  ].join("\n");
}
