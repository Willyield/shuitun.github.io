import { useEffect, useMemo, useState } from "react";
import { motion, useMotionValue, useMotionValueEvent, useSpring } from "framer-motion";
import {
  ArrowLeft,
  Calculator,
  Home,
  Plus,
  ReceiptText,
  Sparkles,
  Trash2,
  Users,
  Wallet
} from "lucide-react";
import heroCapybara from "../assets/hero-capybara.svg";
import {
  DECISION_REPLIES,
  DECISION_TAGS,
  EXPENSE_CATEGORIES,
  LOW_BALANCE_RATIO,
  MAX_PEOPLE,
  buildReviewPosterLine,
  calcLedger,
  createId,
  deleteExpense,
  deleteTrip,
  displayCategory,
  formatCurrency,
  formatDateTime,
  getBudgetProgress,
  getCategoryTotals,
  getProgressText,
  getRecordById,
  getRemainingBudget,
  getTripTitle,
  loadTrips,
  round2,
  sanitizeExpense,
  sanitizeTrip,
  saveTrips,
  settle,
  settleShared,
  toPositiveNumber,
  tripModeLabel,
  updateTrip
} from "./lib/travel";

const pageTitles = {
  home: "水豚旅行 | 多人旅行记账与分摊",
  create: "选择记账模式 | 水豚旅行",
  "create-parent": "大家长模式 | 水豚旅行",
  "create-shared": "多人付款模式 | 水豚旅行",
  manage: "已有行程 | 水豚旅行",
  archive: "行程存档 | 水豚旅行",
  detail: "行程详情 | 水豚旅行",
  expense: "记一笔 | 水豚旅行",
  budget: "增加预算 | 水豚旅行",
  review: "结算 | 水豚旅行",
  summary: "结算总结 | 水豚旅行",
  about: "产品介绍 | 水豚旅行"
};

function parseRoute() {
  const hash = window.location.hash.startsWith("#/") ? window.location.hash.slice(1) : "";
  const source = hash || normalizePath(window.location.pathname);
  const [rawPath, rawQuery = ""] = source.split("?");
  const segment = rawPath.replace(/^\/+|\/+$/g, "").replace(/\.html$/i, "") || "home";
  const route = segment === "index" ? "home" : segment;
  return {
    name: route,
    params: new URLSearchParams(hash ? rawQuery : window.location.search)
  };
}

function normalizePath(pathname) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  let path = pathname;
  if (base && base !== "/" && path.startsWith(base)) path = path.slice(base.length);
  return path || "/";
}

function hrefTo(route = "home", params = {}) {
  const query = new URLSearchParams(params);
  return `#/${route === "home" ? "" : route}${query.size ? `?${query.toString()}` : ""}`;
}

function useRoute() {
  const [route, setRoute] = useState(parseRoute);
  useEffect(() => {
    const sync = () => setRoute(parseRoute());
    window.addEventListener("hashchange", sync);
    window.addEventListener("popstate", sync);
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("popstate", sync);
    };
  }, []);
  useEffect(() => {
    document.title = pageTitles[route.name] || pageTitles.home;
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [route.name]);
  return route;
}

function navigate(route, params) {
  window.location.hash = hrefTo(route, params);
}

function classNames(...values) {
  return values.filter(Boolean).join(" ");
}

function parseCurrencyValue(value) {
  if (typeof value === "number") return value;
  const parsed = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function isCurrencyValue(value) {
  return typeof value === "number" || String(value ?? "").includes("¥");
}

function AnimatedMoneyText({ value, className }) {
  const target = parseCurrencyValue(value);
  const motionValue = useMotionValue(target);
  const springValue = useSpring(motionValue, { stiffness: 180, damping: 26, mass: 0.8 });
  const [display, setDisplay] = useState(formatCurrency(target));

  useEffect(() => {
    motionValue.set(target);
  }, [motionValue, target]);

  useMotionValueEvent(springValue, "change", (latest) => {
    setDisplay(formatCurrency(latest));
  });

  return <motion.span className={classNames("tabular-money", className)}>{display}</motion.span>;
}

function MoneyText({ value, animate = false, className }) {
  const baseClass = classNames("font-extrabold tracking-tight tabular-money", className);
  if (animate && isCurrencyValue(value)) return <AnimatedMoneyText value={value} className={baseClass} />;
  return <span className={baseClass}>{value}</span>;
}

function EmptyWatermark() {
  return <img className="pointer-events-none absolute -right-5 -bottom-7 z-0 h-32 w-32 opacity-10" src={heroCapybara} alt="" aria-hidden="true" />;
}

function ButtonLink({ to = "home", params, variant = "ghost", icon: Icon, children, className }) {
  return (
    <a className={classNames(buttonClass(variant), className)} href={hrefTo(to, params)}>
      {Icon ? <Icon size={17} /> : null}
      <span>{children}</span>
    </a>
  );
}

function Button({ variant = "ghost", icon: Icon, children, className, ...props }) {
  return (
    <button className={classNames(buttonClass(variant), className)} type="button" {...props}>
      {Icon ? <Icon size={17} /> : null}
      <span>{children}</span>
    </button>
  );
}

function buttonClass(variant) {
  const base = "inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-extrabold transition-all duration-200 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50";
  const variants = {
    primary: "bg-accent text-white shadow-float hover:bg-accentDark",
    secondary: "border border-white/60 bg-paper text-ink shadow-capybara-warm ring-1 ring-white/60 hover:bg-card",
    ghost: "border border-line bg-white/50 text-ink hover:bg-paper",
    dark: "bg-ink text-white hover:bg-[#352111]",
    danger: "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
  };
  return `${base} ${variants[variant] || variants.ghost}`;
}

function Shell({ children, wide = false }) {
  return (
    <main className={classNames("mx-auto min-h-screen pb-10 pt-5 animate-page-in", wide ? "max-w-5xl" : "max-w-[520px]")}>
      <div className="space-y-5">{children}</div>
    </main>
  );
}

function Topbar({ title = "水豚旅行", subtitle = "Capybara Trip", children }) {
  return (
    <header className="flex items-center justify-between gap-3">
      <a className="flex min-w-0 items-center gap-3" href={hrefTo("home")} aria-label="水豚旅行首页">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-3xl border border-white/60 bg-paper shadow-capybara-warm ring-1 ring-white/60">
          <img className="h-9 w-9" src={heroCapybara} alt="水豚旅行头像" />
        </span>
        <span className="min-w-0">
          <strong className="block truncate text-base font-extrabold text-ink">{title}</strong>
          <small className="block truncate text-xs font-bold text-muted">{subtitle}</small>
        </span>
      </a>
      {children ? <nav className="flex shrink-0 flex-wrap justify-end gap-2">{children}</nav> : null}
    </header>
  );
}

function Eyebrow({ children }) {
  return <span className="text-xs font-extrabold uppercase tracking-[0.18em] text-accent">{children}</span>;
}

function Badge({ children, tone = "default" }) {
  return (
    <span className={classNames(
      "inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-extrabold",
      tone === "alert" ? "bg-red-100 text-red-700" : tone === "dark" ? "bg-ink text-white" : "bg-card text-ink"
    )}>
      {children}
    </span>
  );
}

function Panel({ children, className }) {
  return <section className={classNames("rounded-3xl border border-white/60 bg-paper/90 p-5 shadow-capybara-warm ring-1 ring-white/60", className)}>{children}</section>;
}

function Metric({ label, value }) {
  const isMoney = isCurrencyValue(value);
  return (
    <div className="rounded-3xl border border-white/60 bg-white/70 p-4 shadow-capybara-warm ring-1 ring-white/60">
      <span className="text-xs font-extrabold tracking-wide text-stone-400">{label}</span>
      <strong className="mt-1 block break-words text-xl text-ink">
        {isMoney ? <MoneyText value={value} animate className="block" /> : value}
      </strong>
    </div>
  );
}

function Message({ message }) {
  if (!message?.text) return null;
  return (
    <div className={classNames(
      "rounded-2xl px-4 py-3 text-sm font-bold",
      message.type === "error" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
    )}>
      {message.text}
    </div>
  );
}

function HomePage() {
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
          <ButtonLink to="create" variant="primary" icon={Plus} className="min-h-20 flex-col items-start rounded-3xl">
            创建行程
          </ButtonLink>
          <ButtonLink to="manage" variant="secondary" icon={Wallet} className="min-h-20 flex-col items-start rounded-3xl">
            查看已有行程
          </ButtonLink>
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
        </section>
      </section>
    </Shell>
  );
}

function CreateChoicePage() {
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
    <a className="block rounded-3xl border border-white/60 bg-paper/90 p-6 shadow-capybara-warm ring-1 ring-white/60 transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.97]" href={hrefTo(to)}>
      <Badge>{badge}</Badge>
      <h2 className="mt-4 text-2xl font-extrabold">{title}</h2>
      <p className="mt-2 text-sm leading-7 text-muted">{copy}</p>
    </a>
  );
}

function CreateTripPage({ mode }) {
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
                  {people.length > 2 ? (
                    <Button variant="ghost" icon={Trash2} onClick={() => setPeople((current) => current.filter((_, itemIndex) => itemIndex !== index))}>删除</Button>
                  ) : null}
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

function Field({ label, hint, action, children }) {
  return (
    <label className="block space-y-2">
      <span className="flex items-center justify-between gap-3">
        <span className="text-sm font-extrabold text-ink">{label}</span>
        {action}
      </span>
      {children}
      {hint ? <span className="block text-xs font-bold leading-6 text-muted">{hint}</span> : null}
    </label>
  );
}

function inputClass() {
  return "min-h-12 w-full rounded-2xl border border-line bg-white/75 px-4 py-3 text-base font-bold text-ink outline-none transition placeholder:text-muted/65 focus:border-accent focus:bg-white focus:ring-4 focus:ring-accent/15";
}

function TripListPage({ type = "manage" }) {
  const [version, setVersion] = useState(0);
  const trips = useMemo(() => loadTrips(), [version]);
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

function ProgressBar({ width, alert }) {
  return (
    <div className="h-3 overflow-hidden rounded-full bg-card">
      <div className={classNames("h-full rounded-full transition-all", alert ? "bg-red-500" : "bg-accent")} style={{ width }} />
    </div>
  );
}

function useTrip(id, version = 0) {
  return useMemo(() => getRecordById(id), [id, version]);
}

function NotFoundPage({ title = "没有找到这趟行程。", copy = "请从已有行程页面重新进入。" }) {
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

function DetailPage({ id }) {
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
            {progress > 1 ? (
              <>当前已经超出预算 <MoneyText value={formatCurrency(Math.abs(remaining))} />，建议追加预算或进入结算。</>
            ) : (
              <>当前已使用 {Math.round(progress * 100)}% 预算，仅剩 <MoneyText value={formatCurrency(remaining)} />。</>
            )}
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

function SectionHead({ eyebrow, title, badge }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 className="mt-2 text-2xl font-extrabold">{title}</h2>
      </div>
      {badge ? <Badge>{badge}</Badge> : null}
    </div>
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
        )) : (
          <div className="relative overflow-hidden rounded-3xl border border-white/60 bg-white/70 p-4 text-sm font-bold text-muted shadow-capybara-warm ring-1 ring-white/60">
            <EmptyWatermark />
            <span className="relative z-10">暂无净额数据。</span>
          </div>
        )}
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

function ExpensePage({ id }) {
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

    const expense = sanitizeExpense({
      id: createId(),
      amount: expenseAmount,
      category,
      customCategory,
      note,
      payer: cleanPayer,
      participants,
      time
    });
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
          <Field label="金额">
            <input className={inputClass()} type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="输入本笔花费" />
          </Field>
          <Field label="分类">
            <div className="grid grid-cols-3 gap-2">
              {EXPENSE_CATEGORIES.map((item) => (
                <Button key={item} variant={category === item ? "primary" : "secondary"} onClick={() => setCategory(item)}>{item}</Button>
              ))}
            </div>
          </Field>
          {category === "其他" ? (
            <Field label="其他分类名称">
              <input className={inputClass()} maxLength={16} value={customCategory} onChange={(event) => setCustomCategory(event.target.value)} placeholder="例如：停车费、伴手礼" />
            </Field>
          ) : null}
          {isShared ? (
            <Field label="付款人">
              <select className={inputClass()} value={payer} onChange={(event) => setPayer(event.target.value)}>
                {trip.people.map((name) => <option value={name} key={name}>{name}</option>)}
              </select>
            </Field>
          ) : null}
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
          <Field label="用途备注">
            <input className={inputClass()} maxLength={30} value={note} onChange={(event) => setNote(event.target.value)} placeholder="例如：晚餐、门票、打车" />
          </Field>
          <DecisionCard prompt={decisionPrompt} setPrompt={setDecisionPrompt} reply={decisionReply} onAsk={askDecision} />
          <Field label="时间">
            <input className={inputClass()} type="datetime-local" value={time} onChange={(event) => setTime(event.target.value)} />
          </Field>
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
        {DECISION_TAGS.map((tag) => (
          <button className="rounded-full bg-white/12 px-3 py-2 text-xs font-extrabold text-white transition-all duration-200 active:scale-[0.97]" type="button" key={tag} onClick={() => setPrompt(tag)}>
            {tag}
          </button>
        ))}
      </div>
      <textarea className="min-h-24 w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-bold outline-none placeholder:text-white/50 focus:ring-4 focus:ring-white/15" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="例如：今晚吃火锅还是烧烤？" />
      <Button variant="secondary" className="w-full" icon={Sparkles} onClick={onAsk}>给个建议</Button>
      <div className="rounded-3xl bg-white/10 p-4 text-sm font-bold leading-7 text-white/85">{reply}</div>
    </section>
  );
}

function BudgetPage({ id }) {
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
      return {
        ...currentTrip,
        totalBudget,
        per: currentTrip.people.length ? round2(totalBudget / currentTrip.people.length) : currentTrip.per
      };
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
          <div>
            <Eyebrow>预算</Eyebrow>
            <h1 className="mt-2 text-3xl font-extrabold">增加预算</h1>
          </div>
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

const LANDMARK_KEYWORDS = ["站", "湖", "寺", "山", "街", "馆", "园", "桥", "机场", "酒店", "民宿", "景区", "游船", "码头", "古镇"];

function getExpenseLabel(expense) {
  return expense.note || displayCategory(expense);
}

function isValidExpenseDate(expense) {
  const date = new Date(expense.time);
  return Number.isFinite(date.getTime());
}

function getTimelineTime(expense) {
  const date = new Date(expense.time);
  if (!Number.isFinite(date.getTime())) return "时间未记";
  return date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function hasLandmarkSignal(expense) {
  const text = `${expense.note || ""}${displayCategory(expense)}`;
  return LANDMARK_KEYWORDS.some((keyword) => text.includes(keyword));
}

function getTimelineExpenses(trip) {
  return [...(trip.expenses || [])]
    .filter((expense) => expense.amount >= 15 || hasLandmarkSignal(expense))
    .sort((left, right) => {
      const leftTime = new Date(left.time).getTime();
      const rightTime = new Date(right.time).getTime();
      const leftSafe = Number.isFinite(leftTime) ? leftTime : Number.MAX_SAFE_INTEGER;
      const rightSafe = Number.isFinite(rightTime) ? rightTime : Number.MAX_SAFE_INTEGER;
      return leftSafe - rightSafe;
    });
}

function getTripDurationText(trip) {
  const dates = (trip.expenses || [])
    .filter(isValidExpenseDate)
    .map((expense) => new Date(expense.time));
  if (!dates.length) return "未记录";
  const start = new Date(Math.min(...dates.map((date) => date.getTime())));
  const end = new Date(Math.max(...dates.map((date) => date.getTime())));
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  const days = Math.max(1, Math.floor((endDay - startDay) / 86400000) + 1);
  return `${days}天${Math.max(0, days - 1)}夜`;
}

function getCoreFootprints(trip, timelineExpenses) {
  const labels = [];
  for (const expense of timelineExpenses) {
    const label = getExpenseLabel(expense).trim();
    if (label && !labels.includes(label)) labels.push(label);
    if (labels.length >= 4) break;
  }
  return labels.length ? labels : [getTripTitle(trip)];
}

function TripSummaryView({ trip, onClose }) {
  const timelineExpenses = useMemo(() => getTimelineExpenses(trip), [trip]);
  const footprints = useMemo(() => getCoreFootprints(trip, timelineExpenses), [trip, timelineExpenses]);
  const durationText = useMemo(() => getTripDurationText(trip), [trip]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <motion.section className="fixed inset-0 z-50 bg-[#FDFBF7] text-ink" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.42, ease: "easeOut" }}>
      <header className="fixed inset-x-0 top-0 z-10 flex h-16 items-center justify-center border-b border-line/60 bg-[#FDFBF7]/95 px-5 backdrop-blur">
        <button className="absolute left-5 inline-flex min-h-10 items-center gap-2 rounded-2xl px-2 text-sm font-extrabold text-ink transition-all duration-200 active:scale-[0.97]" type="button" onClick={onClose}>
          <ArrowLeft size={18} />
          <span>返回</span>
        </button>
        <h1 className="max-w-[58%] truncate text-base font-extrabold">{getTripTitle(trip)}复盘</h1>
      </header>

      <div className="h-full overflow-y-auto px-5 pb-10 pt-24">
        <div className="mx-auto max-w-[520px] space-y-5">
          <article className="animate-fade-in rounded-3xl border border-white/60 bg-white p-6 shadow-capybara-warm ring-1 ring-white/60">
            <div className="grid grid-cols-2 gap-5">
              <div>
                <span className="text-xs font-extrabold tracking-wide text-stone-400">总耗时</span>
                <strong className="mt-2 block text-2xl font-extrabold">{durationText}</strong>
              </div>
              <div className="text-right">
                <span className="text-xs font-extrabold tracking-wide text-stone-400">总花费</span>
                <strong className="mt-2 block text-3xl"><MoneyText value={formatCurrency(trip.currentSpent)} animate /></strong>
              </div>
              <div className="col-span-2 rounded-3xl bg-card/65 p-4">
                <span className="text-xs font-extrabold tracking-wide text-stone-400">核心足迹</span>
                <p className="mt-2 text-sm font-extrabold leading-7 text-gray-700">📍 {footprints.join(" ➔ ")}</p>
              </div>
            </div>
          </article>

          <section className="space-y-5">
            <h2 className="text-2xl font-extrabold">每日行程记录</h2>
            <Timeline expenses={timelineExpenses} />
          </section>
        </div>
      </div>
    </motion.section>
  );
}

function Timeline({ expenses }) {
  if (!expenses.length) {
    return (
      <div className="relative overflow-hidden animate-fade-in rounded-3xl border border-white/60 bg-white p-5 text-sm font-bold leading-7 text-muted shadow-capybara-warm ring-1 ring-white/60">
        <EmptyWatermark />
        <span className="relative z-10">还没有可生成回忆的核心支出。</span>
      </div>
    );
  }

  return (
    <div className="relative space-y-5">
      <div className="absolute left-4 top-0 h-full w-px bg-gray-200" aria-hidden="true" />
      {expenses.map((expense, index) => (
        <article className="relative animate-fade-in pl-12" style={{ animationDelay: `${index * 55}ms` }} key={expense.id}>
          <span className="absolute left-[11px] top-5 h-3 w-3 rounded-full border-2 border-[#FDFBF7] bg-amber-500 shadow-sm" aria-hidden="true" />
          <div className="rounded-3xl border border-white/60 bg-white/80 p-5 shadow-capybara-warm ring-1 ring-white/60">
            <p className="text-xs font-extrabold tracking-wide text-stone-400">{getTimelineTime(expense)}</p>
            <h3 className="mt-1 text-lg font-extrabold">{getExpenseLabel(expense)}</h3>
            <p className="mt-2 text-sm font-bold text-muted">花费: <MoneyText value={formatCurrency(expense.amount)} /></p>
          </div>
        </article>
      ))}
    </div>
  );
}

function ReviewPage({ id, summary = false }) {
  const [showTripSummary, setShowTripSummary] = useState(false);
  const trip = useTrip(id);
  if (!trip) return <NotFoundPage />;
  const parentResult = trip.mode === "parent" ? settle(trip) : null;
  const sharedResult = trip.mode === "shared" ? settleShared(trip) : null;
  const remaining = getRemainingBudget(trip);

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
      </Panel>
      <Panel className="space-y-4">
        <SectionHead eyebrow="支出拆解" title="每笔支出明细" />
        <ExpenseList trip={trip} />
      </Panel>
      {showTripSummary ? <TripSummaryView trip={trip} onClose={() => setShowTripSummary(false)} /> : null}
    </Shell>
  );
}

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
  const members = trip.people.filter((name) => name !== trip.manager);
  const transferRows = result.mode === "extra"
    ? members.map((name) => ({ label: `${name} 补给 ${trip.manager || "大家长"}`, amount: result.extraPerPerson }))
    : members
      .map((name) => ({ label: `${trip.manager || "大家长"} 退给 ${name}`, amount: Math.max(0, result.balances[name] || 0) }))
      .filter((item) => item.amount > 0);
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
        <article className="flex items-center justify-between gap-3 rounded-3xl border border-white/60 bg-white/70 p-4 text-sm font-extrabold shadow-capybara-warm ring-1 ring-white/60" key={row.label}>
          <span>{row.label}</span>
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

function AboutPage() {
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

export default function App() {
  const route = useRoute();
  const id = route.params.get("id");
  const pages = {
    home: <HomePage />,
    create: <CreateChoicePage />,
    "create-parent": <CreateTripPage mode="parent" />,
    "create-shared": <CreateTripPage mode="shared" />,
    manage: <TripListPage />,
    archive: <TripListPage type="archive" />,
    detail: <DetailPage id={id} />,
    expense: <ExpensePage id={id} />,
    budget: <BudgetPage id={id} />,
    review: <ReviewPage id={id} />,
    summary: <ReviewPage id={id} summary />,
    about: <AboutPage />
  };
  return <div className="px-5 sm:px-6">{pages[route.name] || <HomePage />}</div>;
}
