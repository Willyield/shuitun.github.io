import { useState } from "react";
import { Calculator, ReceiptText } from "lucide-react";
import { Badge, ButtonLink, EmptyWatermark, Eyebrow, Metric, MoneyText, Panel, ProgressBar, SectionHead, Shell, Topbar } from "../components/ui";
import {
  buildReviewPosterLine,
  formatCurrency,
  getCategoryTotals,
  getRecordById,
  getRemainingBudget,
  getTripTitle,
  settle,
  settleShared,
  tripModeLabel
} from "../lib/travel";
import { buildSettlementShareText, getSettlementTransfers } from "../lib/share";
import TripSummaryView from "./TripSummaryView";

function CategoryShareList({ trip }) {
  const totals = getCategoryTotals(trip);
  if (!totals.length) {
    return (
      <div className="relative overflow-hidden rounded-3xl border border-white/60 bg-white/70 p-4 text-sm font-bold text-muted shadow-capybara-warm ring-1 ring-white/60">
        <EmptyWatermark />
        <span className="relative z-10">还没有支出记录，暂无分类占比。</span>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {totals.map((item) => (
        <article className="rounded-3xl border border-white/60 bg-white/70 p-4 shadow-capybara-warm ring-1 ring-white/60" key={item.category}>
          <div className="flex items-center justify-between gap-3 text-sm font-extrabold">
            <strong>{item.category}</strong>
            <span><MoneyText value={formatCurrency(item.amount)} /> · {item.percent}%</span>
          </div>
          <div className="mt-3"><ProgressBar width={`${item.percent}%`} /></div>
        </article>
      ))}
    </div>
  );
}

function ParentSettlement({ trip, result }) {
  const transferRows = getSettlementTransfers(trip, result, null);
  return (
    <div className="space-y-3">
      <article className="rounded-3xl border border-white/60 bg-white/70 p-4 shadow-capybara-warm ring-1 ring-white/60">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Badge tone={result.mode === "extra" ? "alert" : "default"}>{result.mode === "extra" ? "超支补款" : "预算返还"}</Badge>
            <h3 className="mt-3 text-xl font-extrabold">{result.mode === "extra" ? "需要补款" : "需要退款"}</h3>
          </div>
          <strong className="text-xl"><MoneyText value={formatCurrency(result.mode === "extra" ? result.diff : result.totalBudget - result.totalExpense)} animate /></strong>
        </div>
        <p className="mt-2 text-sm font-bold text-muted">总预算 <MoneyText value={formatCurrency(result.totalBudget)} />，总支出 <MoneyText value={formatCurrency(result.totalExpense)} />。</p>
      </article>
      {transferRows.length ? transferRows.map((row) => (
        <article className="flex items-center justify-between gap-3 rounded-3xl border border-white/60 bg-white/70 p-4 text-sm font-extrabold shadow-capybara-warm ring-1 ring-white/60" key={`${row.from}-${row.to}-${row.amount}`}>
          <span>{row.from} → {row.to}</span>
          <strong><MoneyText value={formatCurrency(row.amount)} /></strong>
        </article>
      )) : (
        <div className="relative overflow-hidden rounded-3xl border border-white/60 bg-white/70 p-4 text-sm font-bold text-muted shadow-capybara-warm ring-1 ring-white/60">
          <EmptyWatermark />
          <span className="relative z-10">目前没有需要执行的退款或补款动作。</span>
        </div>
      )}
    </div>
  );
}

function SharedSettlement({ result }) {
  const netRows = Object.entries(result.net || {});
  return (
    <div className="space-y-3">
      <article className="rounded-3xl border border-white/60 bg-white/70 p-4 shadow-capybara-warm ring-1 ring-white/60">
        <Badge>多人付款结算</Badge>
        <h3 className="mt-3 text-xl font-extrabold">按路径转账即可平账</h3>
        <p className="mt-2 text-sm font-bold text-muted">总支出 <MoneyText value={formatCurrency(result.totalExpense)} />，系统已按付款人和参与人计算净额。</p>
      </article>
      <div className="grid grid-cols-2 gap-2">
        {netRows.map(([name, amount]) => (
          <article className="rounded-3xl border border-white/60 bg-white/70 p-4 shadow-capybara-warm ring-1 ring-white/60" key={name}>
            <strong className="block text-sm font-extrabold">{name}</strong>
            <p className="mt-1 text-xs font-bold text-muted">{amount > 0 ? "应收" : amount < 0 ? "应付" : "已平账"} · {amount > 0 ? "+" : ""}<MoneyText value={formatCurrency(amount)} /></p>
          </article>
        ))}
      </div>
      <div className="space-y-2">
        {result.transfers.length ? result.transfers.map((transfer) => (
          <article className="flex items-center justify-between gap-3 rounded-3xl border border-white/60 bg-white/70 p-4 text-sm font-extrabold shadow-capybara-warm ring-1 ring-white/60" key={`${transfer.from}-${transfer.to}-${transfer.amount}`}>
            <span>{transfer.from} → {transfer.to}</span>
            <strong><MoneyText value={formatCurrency(transfer.amount)} /></strong>
          </article>
        )) : (
          <div className="relative overflow-hidden rounded-3xl border border-white/60 bg-white/70 p-4 text-sm font-bold text-muted shadow-capybara-warm ring-1 ring-white/60">
            <EmptyWatermark />
            <span className="relative z-10">这趟行程已经平账，不需要额外转账。</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ExpenseList({ trip }) {
  if (!trip.expenses.length) {
    return (
      <div className="relative overflow-hidden rounded-3xl border border-white/60 bg-white/70 p-4 text-sm font-bold text-muted shadow-capybara-warm ring-1 ring-white/60">
        <EmptyWatermark />
        <span className="relative z-10">这趟旅行还没有支出记录。</span>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {trip.expenses.map((expense, index) => {
        const split = expense.participants.length ? expense.amount / expense.participants.length : 0;
        return (
          <article className="rounded-3xl border border-white/60 bg-white/70 p-4 shadow-capybara-warm ring-1 ring-white/60" key={expense.id}>
            <strong className="block text-base font-extrabold">#{index + 1} · {expense.note || expense.category}</strong>
            <p className="mt-2 text-sm font-bold text-muted">付款人：{expense.payer || trip.manager || "-"}</p>
            <p className="text-sm font-bold text-muted">参与人：{expense.participants.join("、") || "-"}</p>
            <p className="text-sm font-bold text-muted">金额：<MoneyText value={formatCurrency(expense.amount)} /> · 人均 <MoneyText value={formatCurrency(split)} /></p>
          </article>
        );
      })}
    </div>
  );
}

export default function SettlementView({ id, summary = false }) {
  const [showTripSummary, setShowTripSummary] = useState(false);
  const [copyState, setCopyState] = useState("idle");
  const trip = getRecordById(id);
  if (!trip) return null;
  const parentResult = trip.mode === "parent" ? settle(trip) : null;
  const sharedResult = trip.mode === "shared" ? settleShared(trip) : null;
  const remaining = getRemainingBudget(trip);

  async function copyShareText() {
    const text = buildSettlementShareText(trip, parentResult, sharedResult);
    try {
      await navigator.clipboard.writeText(text);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      setCopyState("error");
      window.setTimeout(() => setCopyState("idle"), 2400);
    }
  }

  return (
    <Shell>
      <Topbar title={summary ? "结算总结" : "结算"} subtitle={summary ? "Trip Summary" : "Trip Review"} />
      <section className="space-y-2">
        <Eyebrow>{summary ? "结算总结" : "第三步"}</Eyebrow>
        <h1 className="text-3xl font-extrabold leading-tight">{getTripTitle(trip)}</h1>
        <p className="text-sm leading-7 text-muted">
          {tripModeLabel(trip.mode)} · 成员：{trip.people.join("、") || "-"}{trip.mode === "parent" ? ` · 大家长：${trip.manager || "-"}` : ""}
        </p>
      </section>
      <div className="grid grid-cols-3 gap-2">
        <Metric label="总预算" value={formatCurrency(trip.totalBudget)} />
        <Metric label="总支出" value={formatCurrency(trip.currentSpent)} />
        <Metric label="预算结余" value={formatCurrency(remaining)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button className="inline-flex w-full min-h-14 items-center justify-center rounded-2xl bg-amber-500 px-4 py-4 text-sm font-extrabold text-white shadow-lg shadow-orange-500/30 transition-all duration-200 active:scale-[0.97]" type="button" onClick={() => setShowTripSummary(true)}>
          <span>🌟 生成专属旅行回忆</span>
        </button>
        <ButtonLink to="detail" params={{ id: trip.id }} variant="primary" icon={ReceiptText} className="w-full py-4">继续记账</ButtonLink>
      </div>
      <Panel className="space-y-4">
        <SectionHead eyebrow="分类占比" title="钱主要花在哪" />
        <CategoryShareList trip={trip} />
      </Panel>
      <Panel className="bg-ink text-white">
        <span className="text-xs font-extrabold uppercase tracking-[0.18em] text-card">提醒文案</span>
        <h2 className="mt-2 text-2xl font-extrabold">可以直接发群里</h2>
        <p className="mt-4 text-2xl font-extrabold leading-10 text-card">{buildReviewPosterLine(trip, parentResult, sharedResult)}</p>
      </Panel>
      <Panel className="space-y-4">
        <SectionHead eyebrow="最终结算" title="谁该付给谁" />
        {trip.mode === "shared" && sharedResult ? <SharedSettlement result={sharedResult} /> : null}
        {trip.mode === "parent" && parentResult ? <ParentSettlement trip={trip} result={parentResult} /> : null}
        <button className="inline-flex w-full min-h-12 items-center justify-center rounded-2xl bg-accent px-4 py-3 text-sm font-extrabold text-white shadow-float transition-all duration-200 active:scale-[0.97]" type="button" onClick={copyShareText}>
          {copyState === "copied" ? "✅ 已复制，去粘贴吧" : copyState === "error" ? "复制失败，请手动复制" : "📄 复制结算文案发群"}
        </button>
      </Panel>
      <Panel className="space-y-4">
        <SectionHead eyebrow="支出拆解" title="每笔支出明细" />
        <ExpenseList trip={trip} />
      </Panel>
      {showTripSummary ? <TripSummaryView trip={trip} onClose={() => setShowTripSummary(false)} /> : null}
    </Shell>
  );
}
