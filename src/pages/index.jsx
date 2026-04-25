import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Calculator, Home, Plus, ReceiptText, Sparkles, Trash2, Wallet } from "lucide-react";
import {
  Badge,
  Button,
  ButtonLink,
  classNames,
  EmptyWatermark,
  Eyebrow,
  Field,
  inputClass,
  Message,
  Metric,
  MoneyText,
  Panel,
  ProgressBar,
  SectionHead,
  Shell,
  Topbar
} from "../components/ui";
import { exportTravelBackup, importTravelBackup } from "../lib/backup";
import { navigate } from "../lib/router";
import {
  calcLedger,
  createId,
  DECISION_REPLIES,
  DECISION_TAGS,
  deleteExpense,
  deleteTrip,
  displayCategory,
  EXPENSE_CATEGORIES,
  formatCurrency,
  formatDateTime,
  getBudgetProgress,
  getProgressText,
  getRecordById,
  getRemainingBudget,
  getTripTitle,
  loadTrips,
  LOW_BALANCE_RATIO,
  MAX_PEOPLE,
  round2,
  sanitizeExpense,
  sanitizeTrip,
  saveTrips,
  settleShared,
  toPositiveNumber,
  tripModeLabel,
  updateTrip
} from "../lib/travel";

function DataBackupPanel() {
  const fileRef = useRef(null);
  const [message, setMessage] = useState(null);

  async function handleImport(file) {
    if (!file) return;
    if (!window.confirm("导入新数据将覆盖当前本地的所有行程，是否继续？")) {
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    try {
      await importTravelBackup(file);
      setMessage({ type: "success", text: "账本已导入，正在刷新。" });
      window.setTimeout(() => window.location.reload(), 500);
    } catch (error) {
      setMessage({ type: "error", text: error?.message || "导入失败，请检查文件格式。" });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <Panel className="relative overflow-hidden p-6">
      <EmptyWatermark />
      <div className="relative z-10 space-y-4">
        <div>
          <Eyebrow>数据备份</Eyebrow>
          <h2 className="mt-2 text-2xl font-extrabold">把本地账本握在自己手里。</h2>
          <p className="mt-2 text-sm leading-7 text-muted">导出 JSON 可以迁移到新手机；导入会覆盖当前本地行程。</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" icon={Wallet} onClick={() => {
            try {
              exportTravelBackup();
              setMessage({ type: "success", text: "备份文件已开始下载。" });
            } catch {
              setMessage({ type: "error", text: "导出失败，当前浏览器可能限制下载。" });
            }
          }}>导出账本</Button>
          <Button variant="primary" icon={Plus} onClick={() => fileRef.current?.click()}>导入账本</Button>
        </div>
        <input ref={fileRef} className="hidden" type="file" accept=".json,application/json" onChange={(event) => handleImport(event.target.files?.[0])} />
        <Message message={message} />
      </div>
    </Panel>
  );
}

export function HomePage() {
  return (
    <Shell>
      <Topbar>
        <ButtonLink to="about" variant="ghost" icon={Sparkles}>介绍</ButtonLink>
      </Topbar>

      <section>
        <div className="pt-8">
          <Eyebrow>多人旅行记账与分摊工具</Eyebrow>
          <h1 className="mt-4 text-[34px] font-extrabold leading-tight text-ink sm:text-[42px]">
            把旅行里最容易说不清的账，温柔地算清楚。
          </h1>
          <p className="mt-5 text-[15px] leading-[1.8] text-muted">
            重点记录住宿、门票、聚餐、交通等共同大额支出。谁付款、谁参与、最后谁该补钱，一页看明白。
          </p>
        </div>

        <section className="mt-12 space-y-5" aria-labelledby="home_steps_title">
          <div>
            <Eyebrow>30 秒上手</Eyebrow>
            <h2 id="home_steps_title" className="mt-2 text-2xl font-extrabold">只需要三步</h2>
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-stretch">
            {["创建行程", "记一笔", "看结算"].map((item, index) => (
              <div className="contents" key={item}>
                <article className="rounded-3xl border border-white/60 bg-card p-3 text-center shadow-capybara-warm ring-1 ring-white/60">
                  <span className="block text-xs font-bold text-muted">第{index + 1}步</span>
                  <strong className="mt-1 block text-sm font-extrabold">{item}</strong>
                </article>
                {index < 2 ? <span className="mx-2 self-center text-lg font-extrabold text-accent sm:mx-3">→</span> : null}
              </div>
            ))}
          </div>
        </section>

        <section className="mt-12 grid grid-cols-2 gap-3">
          <ButtonLink to="create" variant="primary" icon={Plus} className="min-h-20 flex-col items-start rounded-3xl">创建行程</ButtonLink>
          <ButtonLink to="manage" variant="secondary" icon={Wallet} className="min-h-20 flex-col items-start rounded-3xl">查看已有行程</ButtonLink>
        </section>

        <section className="mt-12 flex flex-col gap-5">
          {[
            ["不用记碎账", "只记真正影响结算的大项。"],
            ["分类占比清楚", "看清钱主要花在哪。"],
            ["适合场景", "朋友旅行、团建、家庭出游，多人共同支出更容易说清。"]
          ].map(([title, copy]) => (
            <Panel className="w-full p-6" key={title}>
              <h2 className="text-2xl font-extrabold">{title}</h2>
              <p className="mt-2 text-sm leading-7 text-muted">{copy}</p>
            </Panel>
          ))}
          <DataBackupPanel />
        </section>
      </section>
    </Shell>
  );
}

export function CreateChoicePage() {
  return (
    <Shell>
      <Topbar title="选择模式" subtitle="Choose Mode">
        <ButtonLink to="home" variant="ghost" icon={ArrowLeft}>首页</ButtonLink>
      </Topbar>
      <section className="space-y-2">
        <Eyebrow>创建行程前</Eyebrow>
        <h1 className="text-3xl font-extrabold leading-tight">先选择这趟旅行怎么记账。</h1>
      </section>
      <section className="space-y-4">
        <ModeCard to="create-parent" badge="大家长模式" title="一个人统一管钱" copy="适合先收预算、统一垫付，最后看谁该退、谁该补。" />
        <ModeCard to="create-shared" badge="多人付款模式" title="谁付款就记谁" copy="适合大家轮流付款，最后直接生成转账路径。" />
      </section>
    </Shell>
  );
}

function ModeCard({ to, badge, title, copy }) {
  return (
    <a className="block rounded-3xl border border-white/60 bg-paper/90 p-6 shadow-capybara-warm ring-1 ring-white/60 transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.97]" href={`#/${to}`}>
      <Badge>{badge}</Badge>
      <h2 className="mt-4 text-2xl font-extrabold">{title}</h2>
      <p className="mt-2 text-sm leading-7 text-muted">{copy}</p>
    </a>
  );
}

export function CreateTripPage({ mode }) {
  const [tripName, setTripName] = useState("");
  const [people, setPeople] = useState(["", ""]);
  const [budget, setBudget] = useState("");
  const [manager, setManager] = useState("");
  const [message, setMessage] = useState(null);
  const isShared = mode === "shared";
  const names = people.map((name, index) => String(name || "").trim() || `成员${index + 1}`);
  const selectedManager = manager || names[0] || "";

  function updatePerson(index, value) {
    setPeople((current) => current.map((name, itemIndex) => itemIndex === index ? value : name));
  }

  function submit(event) {
    event.preventDefault();
    const cleanNames = people.map((name) => name.trim());
    const amount = toPositiveNumber(budget);
    if (cleanNames.some((name) => !name)) return setMessage({ type: "error", text: "成员姓名不能为空。" });
    if (new Set(cleanNames).size !== cleanNames.length) return setMessage({ type: "error", text: "成员姓名不能重复。" });
    if (amount <= 0) return setMessage({ type: "error", text: "预算必须大于 0。" });
    if (!isShared && !cleanNames.includes(selectedManager)) return setMessage({ type: "error", text: "大家长必须是成员之一。" });

    const totalBudget = isShared ? round2(amount) : round2(amount * cleanNames.length);
    const trip = sanitizeTrip({
      id: createId(),
      tripName,
      mode,
      people: cleanNames,
      manager: isShared ? "" : selectedManager,
      per: isShared ? round2(totalBudget / cleanNames.length) : amount,
      totalBudget,
      expenses: [],
      createdAt: new Date().toISOString()
    });
    saveTrips([trip, ...loadTrips()]);
    setMessage({ type: "success", text: "行程已创建，正在进入记账页。" });
    window.setTimeout(() => navigate("detail", { id: trip.id }), 160);
  }

  return (
    <Shell>
      <Topbar title={isShared ? "多人付款模式" : "大家长模式"} subtitle={isShared ? "Shared Mode" : "Parent Mode"}>
        <ButtonLink to="create" variant="ghost" icon={ArrowLeft}>重选</ButtonLink>
        <ButtonLink to="manage" variant="secondary" icon={Wallet}>已有</ButtonLink>
      </Topbar>
      <section className="space-y-3">
        <Eyebrow>{isShared ? "谁付款就记谁" : "一个人统一管钱"}</Eyebrow>
        <h1 className="text-3xl font-extrabold leading-tight">{isShared ? "适合大家轮流付款的旅行。" : "适合先收预算、统一垫付的旅行。"}</h1>
        <p className="text-sm leading-7 text-muted">
          {isShared ? "每笔支出填写付款人和参与人，结算时自动生成转账路径。" : "系统会按每个人的预算和实际分摊算出该退或该补的金额。"}
        </p>
      </section>
      <Panel>
        <form className="space-y-5" onSubmit={submit}>
          <Field label="行程名称">
            <input className={inputClass()} maxLength={24} value={tripName} onChange={(event) => setTripName(event.target.value)} placeholder={isShared ? "例如：周末露营局" : "例如：五一杭州旅行"} />
          </Field>
          <Field label="成员" action={<Button icon={Plus} variant="secondary" disabled={people.length >= MAX_PEOPLE} onClick={() => setPeople((current) => [...current, ""])}>添加</Button>}>
            <div className="space-y-3">
              {people.map((person, index) => (
                <div className="flex gap-2" key={index}>
                  <input className={inputClass()} maxLength={16} value={person} onChange={(event) => updatePerson(index, event.target.value)} placeholder={`成员 ${index + 1} 姓名`} />
                  {people.length > 2 ? <Button variant="ghost" icon={Trash2} onClick={() => setPeople((current) => current.filter((_, itemIndex) => itemIndex !== index))}>删除</Button> : null}
                </div>
              ))}
            </div>
          </Field>
          {!isShared ? (
            <Field label="大家长" hint="大家长负责统一垫付、退款或收款。">
              <select className={inputClass()} value={selectedManager} onChange={(event) => setManager(event.target.value)}>
                {names.map((name) => <option value={name} key={name}>{name}</option>)}
              </select>
            </Field>
          ) : null}
          <Field label={isShared ? "行程总预算" : "每人预算"} hint={isShared ? "多人付款模式会把总预算换算成人均参考值。" : "系统会按成员数自动换算总预算。"}>
            <input className={inputClass()} type="number" min="0" step="0.01" value={budget} onChange={(event) => setBudget(event.target.value)} placeholder={isShared ? "输入这趟旅行总预算" : "输入每个人的预算金额"} />
          </Field>
          <Button variant="primary" className="w-full" icon={ReceiptText} type="submit">保存并进入记账页</Button>
          <Message message={message} />
        </form>
      </Panel>
    </Shell>
  );
}

function useTrip(id, version = 0) {
  return getRecordById(id);
}

export function NotFoundPage({ title = "没有找到这趟行程。", copy = "请从已有行程页面重新进入。" }) {
  return (
    <Shell>
      <Topbar title="水豚旅行" />
      <Panel className="relative overflow-hidden space-y-4 text-center">
        <EmptyWatermark />
        <div className="relative z-10 space-y-4">
          <Badge tone="alert">无法打开</Badge>
          <h1 className="text-2xl font-extrabold">{title}</h1>
          <p className="text-sm leading-7 text-muted">{copy}</p>
          <ButtonLink to="manage" variant="primary" icon={Wallet}>查看已有行程</ButtonLink>
        </div>
      </Panel>
    </Shell>
  );
}

export function TripListPage({ type = "manage" }) {
  const [version, setVersion] = useState(0);
  const trips = loadTrips();
  const isArchive = type === "archive";

  function removeTrip(id) {
    const trip = getRecordById(id);
    if (!trip || !window.confirm(`确认删除「${getTripTitle(trip)}」吗？`)) return;
    deleteTrip(id);
    setVersion((current) => current + 1);
  }

  return (
    <Shell>
      <Topbar title={isArchive ? "行程存档" : "已有行程"} subtitle={isArchive ? "Archive" : "Manage Trips"}>
        <ButtonLink to="home" variant="ghost" icon={Home}>首页</ButtonLink>
        <ButtonLink to="create" variant="primary" icon={Plus}>创建</ButtonLink>
      </Topbar>
      <section className="space-y-2">
        <Eyebrow>{isArchive ? "历史记录" : "继续使用"}</Eyebrow>
        <h1 className="text-3xl font-extrabold leading-tight">{isArchive ? "这里保留所有本机创建过的旅行账本。" : "选择一趟行程继续记账或查看结算。"}</h1>
      </section>
      {trips.length ? (
        <section className="space-y-4">
          {trips.map((trip) => <TripCard trip={trip} onDelete={removeTrip} key={trip.id} />)}
        </section>
      ) : (
        <Panel className="relative overflow-hidden space-y-4 text-center">
          <EmptyWatermark />
          <div className="relative z-10 space-y-4">
            <Badge>还没有行程</Badge>
            <h2 className="text-2xl font-extrabold">先创建一趟旅行，再回来继续记账和结算。</h2>
            <ButtonLink to="create" variant="primary" icon={Plus}>创建行程</ButtonLink>
          </div>
        </Panel>
      )}
    </Shell>
  );
}

function TripCard({ trip, onDelete }) {
  const progress = getBudgetProgress(trip);
  const width = `${Math.min(Math.max(progress, 0), 1) * 100}%`;
  const isAlert = progress >= LOW_BALANCE_RATIO;
  return (
    <Panel className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="break-words text-2xl font-extrabold">{getTripTitle(trip)}</h2>
          <p className="mt-1 text-sm leading-6 text-muted">{tripModeLabel(trip.mode)} · {trip.people.join("、") || "暂无成员"}</p>
        </div>
        <Badge tone={isAlert ? "alert" : "default"}>{isAlert ? "预算告急" : "状态正常"}</Badge>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Metric label="总预算" value={formatCurrency(trip.totalBudget)} />
        <Metric label="总支出" value={formatCurrency(trip.currentSpent)} />
        <Metric label="记录数" value={`${trip.expenses.length} 笔`} />
      </div>
      <ProgressBar width={width} alert={isAlert} />
      <div className="flex justify-between text-sm font-bold text-muted">
        <span>剩余预算 <MoneyText value={formatCurrency(getRemainingBudget(trip))} /></span>
        <strong className="text-ink">{getProgressText(trip)}</strong>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <ButtonLink to="detail" params={{ id: trip.id }} variant="primary" icon={ReceiptText}>继续记账</ButtonLink>
        <ButtonLink to="review" params={{ id: trip.id }} variant="secondary" icon={Calculator}>看结算</ButtonLink>
        <Button variant="danger" icon={Trash2} className="col-span-2" onClick={() => onDelete(trip.id)}>删除行程</Button>
      </div>
    </Panel>
  );
}

function ExpenseList({ trip, onDelete }) {
  if (!trip.expenses.length) {
    return (
      <div className="relative overflow-hidden rounded-3xl border border-white/60 bg-white/70 p-4 text-sm font-bold text-muted shadow-capybara-warm ring-1 ring-white/60">
        <EmptyWatermark />
        <span className="relative z-10">还没有支出记录，先去记一笔。</span>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {trip.expenses.map((expense, index) => (
        <article className="rounded-3xl border border-white/60 bg-white/70 p-4 shadow-capybara-warm ring-1 ring-white/60" key={expense.id}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <strong className="block break-words text-base font-extrabold">#{index + 1} · {expense.note || displayCategory(expense)}</strong>
              <p className="mt-1 text-xs font-bold text-muted">{formatDateTime(expense.time || expense.id)}</p>
            </div>
            <Badge>{displayCategory(expense)}</Badge>
          </div>
          <div className="mt-3 space-y-1 text-sm font-bold leading-6 text-muted">
            <p>付款人：{expense.payer || trip.manager || "-"}</p>
            <p>参与人：{expense.participants.join("、") || "-"}</p>
            <p>金额：<MoneyText value={formatCurrency(expense.amount)} /></p>
          </div>
          {onDelete ? <Button variant="danger" icon={Trash2} className="mt-3 w-full" onClick={() => onDelete(expense.id)}>删除这笔</Button> : null}
        </article>
      ))}
    </div>
  );
}

function LedgerView({ trip }) {
  if (trip.mode === "shared") {
    const result = settleShared(trip);
    const rows = Object.entries(result.net || {});
    return (
      <div className="space-y-3">
        {rows.length ? rows.map(([name, amount]) => (
          <article className="rounded-3xl border border-white/60 bg-white/70 p-4 shadow-capybara-warm ring-1 ring-white/60" key={name}>
            <strong className="block text-base font-extrabold">{name}</strong>
            <p className="mt-1 text-sm font-bold text-muted">{amount > 0 ? "应收" : amount < 0 ? "应付" : "已平账"} · {amount > 0 ? "+" : ""}<MoneyText value={formatCurrency(amount)} /></p>
          </article>
        )) : <div className="relative overflow-hidden rounded-3xl border border-white/60 bg-white/70 p-4 text-sm font-bold text-muted shadow-capybara-warm ring-1 ring-white/60"><EmptyWatermark /><span className="relative z-10">暂无净额数据。</span></div>}
      </div>
    );
  }
  const ledger = calcLedger(trip);
  return (
    <div className="space-y-3">
      {trip.people.map((name) => {
        const spent = ledger[name] || 0;
        const balance = round2((trip.per || 0) - spent);
        return (
          <article className="rounded-3xl border border-white/60 bg-white/70 p-4 shadow-capybara-warm ring-1 ring-white/60" key={name}>
            <div className="flex items-center justify-between gap-3">
              <strong className="text-base font-extrabold">{name}</strong>
              <Badge tone={balance < 0 ? "alert" : "default"}>{balance < 0 ? "已超支" : "未超支"}</Badge>
            </div>
            <p className="mt-2 text-sm font-bold text-muted">已分摊：<MoneyText value={formatCurrency(spent)} /></p>
            <p className="text-sm font-bold text-muted">人均预算：<MoneyText value={formatCurrency(trip.per)} /></p>
            <p className="mt-2 text-2xl"><MoneyText value={formatCurrency(balance)} animate /></p>
          </article>
        );
      })}
    </div>
  );
}

export function DetailPage({ id }) {
  const [version, setVersion] = useState(0);
  const [message, setMessage] = useState(null);
  const trip = useTrip(id, version);
  if (!trip) return <NotFoundPage />;
  const progress = getBudgetProgress(trip);
  const isAlert = progress >= LOW_BALANCE_RATIO;
  const remaining = getRemainingBudget(trip);

  function removeExpense(expenseId) {
    const expense = trip.expenses.find((item) => String(item.id) === String(expenseId));
    if (!expense || !window.confirm(`确认删除「${expense.note || displayCategory(expense)}」这笔支出吗？`)) return;
    deleteExpense(trip.id, expenseId);
    setMessage({ type: "success", text: "这笔支出已删除。" });
    setVersion((current) => current + 1);
  }

  return (
    <Shell>
      <Topbar title={getTripTitle(trip)} subtitle="Trip Detail" />
      <section className="grid grid-cols-2 gap-2">
        <ButtonLink to="expense" params={{ id: trip.id }} variant="primary" icon={Plus}>记一笔</ButtonLink>
        <ButtonLink to="review" params={{ id: trip.id }} variant="secondary" icon={Calculator}>查看结算</ButtonLink>
        <ButtonLink to="budget" params={{ id: trip.id }} variant="secondary" icon={Wallet}>增加预算</ButtonLink>
        <ButtonLink to="manage" variant="ghost" icon={ArrowLeft}>返回管理</ButtonLink>
      </section>
      <section className="space-y-2">
        <Eyebrow>当前行程</Eyebrow>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold leading-tight">{getTripTitle(trip)}</h1>
            <p className="mt-2 text-sm leading-7 text-muted">
              {tripModeLabel(trip.mode)} · 成员：{trip.people.join("、") || "-"}{trip.mode === "parent" ? ` · 大家长：${trip.manager || "-"}` : ""}
            </p>
          </div>
          <Badge>{tripModeLabel(trip.mode)}</Badge>
        </div>
      </section>
      <div className="grid grid-cols-3 gap-2">
        <Metric label="总预算" value={formatCurrency(trip.totalBudget)} />
        <Metric label="总支出" value={formatCurrency(trip.currentSpent)} />
        <Metric label="剩余预算" value={formatCurrency(remaining)} />
      </div>
      <Panel className="space-y-3">
        <ProgressBar width={`${Math.min(Math.max(progress, 0), 1) * 100}%`} alert={isAlert} />
        <div className="flex justify-between text-sm font-bold">
          <span className="text-muted">预算使用进度</span>
          <strong>{getProgressText(trip)}</strong>
        </div>
      </Panel>
      {isAlert ? (
        <Panel className="border-red-200 bg-red-50">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Eyebrow>预算提醒</Eyebrow>
              <h2 className="mt-2 text-2xl font-extrabold">预算快见底了</h2>
            </div>
            <Badge tone="alert">{progress > 1 ? "已超预算" : "预算告急"}</Badge>
          </div>
          <p className="mt-2 text-sm leading-7 text-red-700">
            {progress > 1 ? <>当前已经超出预算 <MoneyText value={formatCurrency(Math.abs(remaining))} />，建议追加预算或进入结算。</> : <>当前已使用 {Math.round(progress * 100)}% 预算，仅剩 <MoneyText value={formatCurrency(remaining)} />。</>}
          </p>
        </Panel>
      ) : null}
      <Panel className="space-y-4">
        <SectionHead eyebrow="已记录" title="最近支出" badge={`${trip.expenses.length} 笔`} />
        <ExpenseList trip={trip} onDelete={removeExpense} />
        <Message message={message} />
      </Panel>
      <Panel className="space-y-4">
        <SectionHead eyebrow="实时结果" title="当前分摊结果" badge="自动更新" />
        <LedgerView trip={trip} />
      </Panel>
    </Shell>
  );
}

export function ExpensePage({ id }) {
  const [version, setVersion] = useState(0);
  const trip = useTrip(id, version);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState("");
  const [payer, setPayer] = useState("");
  const [participants, setParticipants] = useState([]);
  const [note, setNote] = useState("");
  const [time, setTime] = useState("");
  const [message, setMessage] = useState(null);
  const [decisionPrompt, setDecisionPrompt] = useState("");
  const [decisionReply, setDecisionReply] = useState("点一个快捷问题，或直接输入你们的纠结。");

  useEffect(() => {
    if (trip) {
      setParticipants(trip.people);
      setPayer(trip.people[0] || "");
    }
  }, [trip?.id]);

  if (!trip) return <NotFoundPage />;
  const isShared = trip.mode === "shared";

  function toggleParticipant(name) {
    setParticipants((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name]);
  }

  function submit(event) {
    event.preventDefault();
    const expenseAmount = toPositiveNumber(amount);
    const cleanPayer = isShared ? payer.trim() : trip.manager;
    if (expenseAmount <= 0) return setMessage({ type: "error", text: "金额必须大于 0。" });
    if (!participants.length) return setMessage({ type: "error", text: "至少选择 1 位参与人。" });
    if (category === "其他" && !customCategory.trim()) return setMessage({ type: "error", text: "请填写其他分类名称。" });
    if (isShared && !cleanPayer) return setMessage({ type: "error", text: "请选择付款人。" });

    const expense = sanitizeExpense({ id: createId(), amount: expenseAmount, category, customCategory, note, payer: cleanPayer, participants, time });
    updateTrip(trip.id, (currentTrip) => ({ ...currentTrip, expenses: [...currentTrip.expenses, expense] }));
    setAmount("");
    setCategory(EXPENSE_CATEGORIES[0]);
    setCustomCategory("");
    setNote("");
    setTime("");
    setParticipants(trip.people);
    if (isShared) setPayer(trip.people[0] || "");
    setMessage({ type: "success", text: "支出已记录，可以继续记下一笔。" });
    setVersion((current) => current + 1);
  }

  function askDecision() {
    if (!decisionPrompt.trim()) {
      setDecisionReply("先把问题写下来。");
      return;
    }
    const reply = DECISION_REPLIES[Math.floor(Math.random() * DECISION_REPLIES.length)];
    setDecisionReply(`${reply} 问题：${decisionPrompt.trim()}`);
  }

  return (
    <Shell>
      <Topbar title={getTripTitle(trip)} subtitle="Record Expense">
        <ButtonLink to="detail" params={{ id: trip.id }} variant="ghost" icon={ArrowLeft}>返回</ButtonLink>
      </Topbar>
      <Panel className="space-y-5">
        <div>
          <Eyebrow>第二步</Eyebrow>
          <h1 className="mt-2 text-3xl font-extrabold">记一笔支出</h1>
          <p className="mt-2 text-sm leading-7 text-muted">适合记录住宿、门票、聚餐、交通这类共同支出。</p>
        </div>
        <form className="space-y-5" onSubmit={submit}>
          <Field label="金额"><input className={inputClass()} type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="输入本笔花费" /></Field>
          <Field label="分类"><div className="grid grid-cols-3 gap-2">{EXPENSE_CATEGORIES.map((item) => <Button key={item} variant={category === item ? "primary" : "secondary"} onClick={() => setCategory(item)}>{item}</Button>)}</div></Field>
          {category === "其他" ? <Field label="其他分类名称"><input className={inputClass()} maxLength={16} value={customCategory} onChange={(event) => setCustomCategory(event.target.value)} placeholder="例如：停车费、伴手礼" /></Field> : null}
          {isShared ? <Field label="付款人"><select className={inputClass()} value={payer} onChange={(event) => setPayer(event.target.value)}>{trip.people.map((name) => <option value={name} key={name}>{name}</option>)}</select></Field> : null}
          <Field label="参与人">
            <div className="grid grid-cols-2 gap-2">
              {trip.people.map((name) => (
                <label className={classNames("flex min-h-12 items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-extrabold transition-all duration-200 active:scale-[0.97]", participants.includes(name) ? "border-accent bg-accent/10 text-ink" : "border-line bg-white/70 text-muted")} key={name}>
                  <input className="h-4 w-4 accent-accent" type="checkbox" checked={participants.includes(name)} onChange={() => toggleParticipant(name)} />
                  <span className="truncate">{name}</span>
                </label>
              ))}
            </div>
          </Field>
          <Field label="用途备注"><input className={inputClass()} maxLength={30} value={note} onChange={(event) => setNote(event.target.value)} placeholder="例如：晚餐、门票、打车" /></Field>
          <DecisionCard prompt={decisionPrompt} setPrompt={setDecisionPrompt} reply={decisionReply} onAsk={askDecision} />
          <Field label="时间"><input className={inputClass()} type="datetime-local" value={time} onChange={(event) => setTime(event.target.value)} /></Field>
          <Button variant="primary" className="w-full" icon={ReceiptText} type="submit">保存这一笔</Button>
          <Message message={message} />
        </form>
      </Panel>
    </Shell>
  );
}

function DecisionCard({ prompt, setPrompt, reply, onAsk }) {
  return (
    <section className="space-y-4 rounded-3xl bg-ink p-4 text-white shadow-capybara-warm">
      <div>
        <span className="text-xs font-extrabold uppercase tracking-[0.18em] text-card">选择困难时</span>
        <h2 className="mt-2 text-2xl font-extrabold">水豚拍板</h2>
      </div>
      <div className="flex flex-wrap gap-2">
        {DECISION_TAGS.map((tag) => <button className="rounded-full bg-white/12 px-3 py-2 text-xs font-extrabold text-white transition-all duration-200 active:scale-[0.97]" type="button" key={tag} onClick={() => setPrompt(tag)}>{tag}</button>)}
      </div>
      <textarea className="min-h-24 w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-bold outline-none placeholder:text-white/50 focus:ring-4 focus:ring-white/15" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="例如：今晚吃火锅还是烧烤？" />
      <Button variant="secondary" className="w-full" icon={Sparkles} onClick={onAsk}>给个建议</Button>
      <div className="rounded-3xl bg-white/10 p-4 text-sm font-bold leading-7 text-white/85">{reply}</div>
    </section>
  );
}

export function BudgetPage({ id }) {
  const [version, setVersion] = useState(0);
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState(null);
  const trip = useTrip(id, version);
  if (!trip) return <NotFoundPage />;

  function submit(event) {
    event.preventDefault();
    const append = toPositiveNumber(amount);
    if (append <= 0) return setMessage({ type: "error", text: "追加预算必须大于 0。" });
    updateTrip(trip.id, (currentTrip) => {
      const totalBudget = round2(currentTrip.totalBudget + append);
      return { ...currentTrip, totalBudget, per: currentTrip.people.length ? round2(totalBudget / currentTrip.people.length) : currentTrip.per };
    });
    setAmount("");
    setMessage({ type: "success", text: "预算已追加。" });
    setVersion((current) => current + 1);
  }

  return (
    <Shell>
      <Topbar title={getTripTitle(trip)} subtitle="Add Budget">
        <ButtonLink to="detail" params={{ id: trip.id }} variant="ghost" icon={ArrowLeft}>返回</ButtonLink>
      </Topbar>
      <Panel>
        <form className="space-y-5" onSubmit={submit}>
          <div><Eyebrow>预算</Eyebrow><h1 className="mt-2 text-3xl font-extrabold">增加预算</h1></div>
          <Metric label="当前总预算" value={formatCurrency(trip.totalBudget)} />
          <Field label="追加金额" hint={trip.mode === "shared" ? "多人付款模式会增加总预算，并刷新人均参考值。" : "大家长模式会重新平均到每个人的预算。"}>
            <input className={inputClass()} type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="输入要补充的金额" />
          </Field>
          <Button variant="secondary" className="w-full" icon={Wallet} type="submit">增加预算</Button>
          <Message message={message} />
        </form>
      </Panel>
    </Shell>
  );
}

export function AboutPage() {
  return (
    <Shell>
      <Topbar title="产品介绍" subtitle="About">
        <ButtonLink to="home" variant="ghost" icon={ArrowLeft}>首页</ButtonLink>
        <ButtonLink to="create" variant="primary" icon={Plus}>开始</ButtonLink>
      </Topbar>
      <section className="space-y-3">
        <Eyebrow>What It Does</Eyebrow>
        <h1 className="text-3xl font-extrabold leading-tight">水豚旅行是一个多人旅行记账与分摊工具。</h1>
        <p className="text-sm leading-7 text-muted">它专门处理住宿、门票、聚餐、交通这类共同支出，减少旅行结束后的算账沟通成本。</p>
      </section>
      <section className="space-y-4">
        {[
          ["创建行程", "先定成员和预算", "选择大家长模式或多人付款模式，再进入详情页记账。"],
          ["记一笔", "记录付款人和参与人", "每笔支出都能明确是谁付的、谁参与分摊。"],
          ["看结算", "自动生成结果", "系统会给出分类占比、支出拆解和最终转账路径。"]
        ].map(([badge, title, copy]) => (
          <Panel key={badge}>
            <Badge>{badge}</Badge>
            <h2 className="mt-4 text-2xl font-extrabold">{title}</h2>
            <p className="mt-2 text-sm leading-7 text-muted">{copy}</p>
          </Panel>
        ))}
      </section>
    </Shell>
  );
}
