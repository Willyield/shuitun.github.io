import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useMotionValue, useMotionValueEvent, useSpring } from "framer-motion";
import {
  ArrowLeft,
  Brush,
  Calculator,
  Camera,
  Copy,
  FileText,
  Home,
  Link2,
  Map,
  MapPin,
  PieChart,
  PencilLine,
  Plus,
  ReceiptText,
  Sparkles,
  Tag,
  Trash2,
  UserPlus,
  Users,
  X,
  Wallet
} from "lucide-react";
import heroCapybara from "../assets/hero-capybara.svg";
import {
  DECISION_TAGS,
  EXPENSE_CATEGORIES,
  LOW_BALANCE_RATIO,
  MAX_PEOPLE,
  calcLedger,
  createId,
  deleteExpense,
  deleteTrip,
  displayCategory,
  formatCurrency,
  getBudgetProgress,
  getCategoryTotals,
  getExpenseEntries,
  getProgressText,
  getRecordById,
  getRemainingBudget,
  getTransferEntries,
  getTripTitle,
  getTripTotalSpent,
  isTransferEntry,
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
import {
  COLLAB_POLL_INTERVAL_MS,
  createCollabChannel,
  createCollabRoom,
  findRoomCodeByTripId,
  getCollabRoom,
  getOnlineMembers,
  getSelfNickname,
  heartbeatCollabRoom,
  joinCollabRoom,
  setSelfNickname,
  syncLocalTripFromRoom,
  syncTripToExistingCollabRoom
} from "./lib/collab";
import { parseReceiptImageFile, requestDecisionAdvice } from "./lib/receipt";
import productCapybara from "../assets/product-capybara.png";

const pageTitles = {
  home: "水豚旅行 | 多人旅行记账与分摊",
  create: "选择记账模式 | 水豚旅行",
  "create-parent": "大家长模式 | 水豚旅行",
  "create-shared": "共同管理模式 | 水豚旅行",
  manage: "已有行程 | 水豚旅行",
  archive: "行程存档 | 水豚旅行",
  detail: "行程详情 | 水豚旅行",
  expense: "记一笔 | 水豚旅行",
  budget: "加预算 | 水豚旅行",
  collaborate: "加入协作 | 水豚旅行",
  review: "结算 | 水豚旅行",
  summary: "结算总结 | 水豚旅行",
  about: "产品介绍 | 水豚旅行"
};

const LAST_ACTIVE_TRIP_KEY = "lastActiveTripId";
const WARM_YELLOW_CARD_CLASS = "inner-warm-card";
const WHITE_LEDGER_CARD_CLASS = "surface-card";

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

async function copyText(value) {
  const text = String(value || "");
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const input = document.createElement("textarea");
  input.value = text;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.top = "0";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.focus();
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  if (!copied) throw new Error("Copy command failed");
}

function buildCollabJoinUrl(roomCode) {
  return `${window.location.origin}${window.location.pathname}${hrefTo("collaborate", { room: roomCode })}`;
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
  const baseClass = classNames("type-ledger", className);
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
    primary: "bg-[#321D13] text-white shadow-button hover:bg-[#24140E]",
    secondary: "border border-[#8F7058]/55 bg-[rgba(255,250,240,0.78)] text-[#321D13] ring-1 ring-white/55 hover:bg-[#F6E0CF]",
    ghost: "border border-[#8F7058]/45 bg-[rgba(255,250,240,0.52)] text-[#321D13] hover:bg-paper",
    dark: "bg-[#321D13] text-white hover:bg-[#24140E]",
    danger: "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
  };
  return `${base} ${variants[variant] || variants.ghost}`;
}

function Shell({ children, wide = false }) {
  return (
    <main className={classNames("relative isolate mx-auto min-h-[100svh] overflow-hidden px-5 pb-10 pt-5 animate-page-in", wide ? "max-w-5xl" : "max-w-[480px]")}>
      <AppBackdrop />
      <div className="relative z-10 space-y-5">{children}</div>
    </main>
  );
}

function AppBackdrop({ home = false }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
      <div className="absolute -left-24 -top-28 h-64 w-64 rounded-full bg-white/38 blur-sm" />
      <div className="absolute -right-28 top-24 h-72 w-72 rounded-full bg-[#FFF8E8]/34 blur-sm" />
      <div className="absolute left-1/2 top-[11%] h-40 w-40 -translate-x-1/2 rounded-full bg-[#C4E2E0]/22 blur-3xl" />
      <div className="absolute inset-x-0 top-[18%] h-44 opacity-70">
        <div className="absolute -left-10 bottom-0 h-32 w-72 rounded-t-[100%] bg-gradient-to-t from-[#C4E2E0]/26 to-[#FFF8E8]/18 blur-[1px]" />
        <div className="absolute left-24 bottom-0 h-40 w-80 rounded-t-[100%] bg-gradient-to-t from-[#AFCFCA]/22 to-[#FFF7EA]/12 blur-[2px]" />
        <div className="absolute -right-20 bottom-0 h-36 w-80 rounded-t-[100%] bg-gradient-to-t from-[#E8CFB0]/24 to-[#FFF7EA]/10 blur-[2px]" />
      </div>
      <div className="absolute left-9 top-[18%] h-16 w-10 rounded-[50%] bg-[#D8B58F]/30 blur-[2px]">
        <span className="absolute left-1/2 top-full h-10 w-px -translate-x-1/2 bg-[#9B7A60]/20" />
      </div>
      <div className="absolute right-12 top-[21%] h-12 w-8 rounded-[50%] bg-[#E3BC87]/26 blur-[2px]">
        <span className="absolute left-1/2 top-full h-8 w-px -translate-x-1/2 bg-[#9B7A60]/16" />
      </div>
      <div className="absolute inset-x-0 bottom-0 h-[42%] bg-gradient-to-t from-[#F5E5D0]/68 via-[#FFF7EA]/35 to-transparent" />
      <div className="absolute left-4 top-[40%] h-7 w-9 -rotate-12 rounded-md border border-primaryDeep/10" />
      <div className="absolute right-7 top-[36%] h-8 w-6 rotate-12 rounded-full border border-primaryDeep/10" />
      <div className="absolute bottom-16 right-6 h-8 w-10 rounded-lg border border-primaryDeep/8" />
      {home ? (
        <>
          <div className="absolute bottom-28 left-5 h-8 w-8 rounded-full border border-primaryDeep/10" />
          <div className="absolute bottom-40 right-7 h-10 w-10 rounded-full border border-primaryDeep/10" />
        </>
      ) : null}
    </div>
  );
}

const capybaraMarkTone = {
  brand: {
    halo: "bg-[#FFE8A8]",
    accent: "bg-accent"
  },
  choice: {
    halo: "bg-[#FBEBCF]",
    accent: "bg-primaryDeep"
  },
  trip: {
    halo: "bg-[#FFF0C7]",
    accent: "bg-accent"
  },
  entry: {
    halo: "bg-[#FFF6D8]",
    accent: "bg-primaryDeep"
  },
  budget: {
    halo: "bg-[#FFEAB8]",
    accent: "bg-accent"
  },
  settlement: {
    halo: "bg-[#F9E2BA]",
    accent: "bg-primaryDeep"
  },
  archive: {
    halo: "bg-[#FFF3D6]",
    accent: "bg-muted"
  }
};

function CapybaraMark({ variant = "brand", size = "md", className = "" }) {
  const tone = capybaraMarkTone[variant] || capybaraMarkTone.brand;
  const sizeClass = size === "lg" ? "h-14 w-14" : size === "sm" ? "h-9 w-9" : "h-11 w-11";
  return (
    <span className={classNames("relative isolate inline-flex shrink-0 items-center justify-center", sizeClass, className)} aria-hidden="true">
      <span className={classNames("absolute -inset-1 -z-10 rotate-[-7deg] rounded-[42%_58%_46%_54%/54%_44%_56%_46%]", tone.halo)} />
      <span className={classNames("absolute right-0 top-0 z-20 h-2.5 w-2.5 rounded-[4px]", tone.accent)} />
      <span className="relative h-full w-full overflow-hidden rounded-[38%_62%_44%_56%/54%_44%_56%_46%] shadow-sm">
        <img
          className="h-full w-full scale-[1.78] object-cover object-[52%_56%]"
          src={productCapybara}
          alt=""
        />
      </span>
    </span>
  );
}

function CapybaraTravelSticker() {
  return (
    <div className="absolute -right-1 top-7 z-0 h-[122px] w-[122px] overflow-hidden rounded-full border border-white/75 bg-[#F6EFE9]/78 shadow-[0_8px_24px_rgba(107,83,67,0.12)]" aria-hidden="true">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_18%,rgba(196,226,224,0.5),transparent_32%),linear-gradient(135deg,#FFF8E8,#F6E0CF)]" />
      <img
        className="absolute inset-0 h-full w-full scale-[1.42] object-cover object-[50%_54%]"
        src={productCapybara}
        alt=""
      />
      <div className="absolute inset-0 rounded-full ring-1 ring-white/70" />
    </div>
  );
}

function Topbar({ title = "水豚旅行", subtitle = "", children, markVariant = "brand", markSize = "md" }) {
  return (
    <header className="flex items-center justify-between gap-3">
      <a className="flex min-w-0 flex-1 items-center gap-3" href={hrefTo("home")} aria-label="水豚旅行首页">
        <CapybaraMark variant={markVariant} size={markSize} />
        <span className="min-w-0">
          <strong className="block truncate type-h3 text-base text-ink">{title}</strong>
          {subtitle ? <small className="block truncate type-caption normal-case">{subtitle}</small> : null}
        </span>
      </a>
      {children ? <nav className="flex shrink-0 flex-wrap justify-end gap-2">{children}</nav> : null}
    </header>
  );
}

function Eyebrow({ children }) {
  return <span className="type-kicker">{children}</span>;
}

function Badge({ children, tone = "default" }) {
  return (
    <span className={classNames(
      "inline-flex items-center justify-center whitespace-nowrap rounded-full px-2 py-1 text-xs font-bold uppercase tracking-widest",
      tone === "alert" ? "bg-red-100 text-red-700" : tone === "safe" ? "badge-safe" : tone === "dark" ? "bg-primaryDeep text-white" : "badge-soft"
    )}>
      {children}
    </span>
  );
}

function Panel({ children, className }) {
  return <section className={classNames("surface-card rounded-3xl p-5 backdrop-blur", className)}>{children}</section>;
}

function Metric({ label, value, valueClassName }) {
  const isMoney = isCurrencyValue(value);
  return (
    <div className="inner-warm-card flex min-w-0 flex-1 flex-col items-start justify-center rounded-3xl px-2 py-4">
      <span className="text-xs font-medium tracking-wide text-muted">{label}</span>
      <strong className={classNames("mt-1 min-w-0 text-xl font-black leading-none tracking-tighter tabular-nums sm:text-2xl", valueClassName || "text-ink")}>
        {isMoney ? <MoneyText value={value} animate className="block" /> : <span className="block">{value}</span>}
      </strong>
    </div>
  );
}

function Message({ message }) {
  if (!message?.text) return null;
  return (
    <div className={classNames(
      "rounded-2xl px-4 py-3 type-body",
      message.type === "error" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
    )}>
      {message.text}
    </div>
  );
}

function BackgroundScene() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#DDEFF2_0%,#F8F3E8_44%,#F8DFB9_100%)]" />
      <div className="absolute -left-24 -top-24 h-56 w-56 rounded-full bg-white/54 blur-[1px]" />
      <div className="absolute -right-20 top-24 h-44 w-44 rounded-full bg-white/46 blur-[1px]" />
      <div className="absolute inset-x-0 top-[23%] h-52">
        <div className="absolute -left-16 bottom-8 h-28 w-64 rounded-t-[100%] bg-[#9CB8C2]/34 blur-sm" />
        <div className="absolute left-10 bottom-10 h-36 w-80 rounded-t-[100%] bg-[#88A8B7]/26 blur-sm" />
        <div className="absolute -right-20 bottom-8 h-32 w-72 rounded-t-[100%] bg-[#CBDAD8]/32 blur-sm" />
        <div className="absolute inset-x-[-18%] bottom-0 h-24 bg-[linear-gradient(180deg,rgba(221,239,242,0.24),rgba(185,220,223,0.54),rgba(248,243,232,0.16))]" />
      </div>
      <div className="absolute left-9 top-[17%] h-20 w-12 rounded-[50%] bg-[#D9B68E]/24 blur-[2px]">
        <span className="absolute left-1/2 top-full h-9 w-px -translate-x-1/2 bg-[#8A6A4E]/18" />
      </div>
      <div className="absolute right-9 top-[24%] h-14 w-9 rounded-[50%] bg-[#E8C58F]/22 blur-[1px]">
        <span className="absolute left-1/2 top-full h-8 w-px -translate-x-1/2 bg-[#8A6A4E]/16" />
      </div>
      <FileText className="absolute left-4 top-[40%] h-8 w-8 -rotate-12 text-[#6D4B36]/16" strokeWidth={1.7} />
      <MapPin className="absolute right-16 top-[35%] h-8 w-8 rotate-12 text-[#6D4B36]/18" strokeWidth={1.7} />
      <Camera className="absolute bottom-32 right-7 h-8 w-8 -rotate-12 text-[#6D4B36]/12" strokeWidth={1.7} />
      <Map className="absolute bottom-24 left-5 h-9 w-9 rotate-12 text-[#6D4B36]/12" strokeWidth={1.7} />
      <span className="absolute bottom-[28%] right-4 h-8 w-12 rounded-[50%_48%_44%_56%] border border-[#6D4B36]/10" />
      <span className="absolute bottom-[36%] left-1 h-7 w-10 rounded-[50%_48%_44%_56%] border border-[#6D4B36]/10" />
      <div className="absolute inset-x-0 bottom-0 h-[42%] bg-[linear-gradient(180deg,rgba(255,247,234,0),rgba(255,242,219,0.72)_44%,rgba(245,221,188,0.84))]" />
    </div>
  );
}

function CapybaraIcon({ className = "" }) {
  return (
    <div className={classNames("relative grid place-items-center overflow-hidden rounded-[24px] border-2 border-[#A98467]/62 bg-[#F4E7D5] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_12px_28px_rgba(92,72,52,0.18)]", className)} aria-label="水豚头像">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_20%,rgba(255,255,255,0.72),transparent_30%),linear-gradient(135deg,#FFF4DF,#E8C9A2)]" />
      <img
        className="relative h-full w-full scale-[1.42] object-cover object-[52%_56%]"
        src={productCapybara}
        alt=""
      />
    </div>
  );
}

function BrandHeader() {
  return (
    <header className="relative z-20 flex flex-col items-center pt-10">
      <a
        className="absolute right-0 top-[calc(env(safe-area-inset-top)+8px)] inline-flex min-h-10 items-center gap-1.5 rounded-full border border-[#8F7058]/65 bg-[#FFF8EE]/78 px-3.5 py-1.5 text-sm font-extrabold text-[#3B2418] shadow-[0_8px_18px_rgba(92,72,52,0.08)] backdrop-blur-md transition-all duration-200 active:scale-[0.97]"
        href={hrefTo("about")}
      >
        <Sparkles size={16} />
        <span>新手指南</span>
      </a>
      <CapybaraIcon className="h-[76px] w-[76px]" />
      <h1 className="mt-4 text-center text-[38px] font-black leading-none tracking-tight text-[#3B2418]">水豚旅行</h1>
    </header>
  );
}

const homeFeatures = [
  { label: "简易记录", icon: PencilLine },
  { label: "抵扣核算", icon: Tag },
  { label: "一键清除", icon: Brush }
];

function TravelIllustration() {
  return (
    <div className="absolute -right-5 top-4 z-0 h-[112px] w-[112px] overflow-hidden rounded-full border border-white/75 bg-[#F6EFE9]/80 shadow-[0_8px_24px_rgba(107,83,67,0.12)]" aria-hidden="true">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_18%,rgba(196,226,224,0.5),transparent_32%),linear-gradient(135deg,#FFF8E8,#F6E0CF)]" />
      <Map className="absolute right-3 top-4 h-12 w-12 rotate-12 text-[#A98668]/28" strokeWidth={1.8} />
      <img
        className="absolute inset-0 h-full w-full scale-[1.56] object-cover object-[50%_54%]"
        src={productCapybara}
        alt=""
      />
      <div className="absolute inset-0 rounded-full ring-1 ring-white/70" />
    </div>
  );
}

function FeatureCard() {
  return (
    <section className="ledger-paper relative mt-9 min-h-[386px] w-full overflow-hidden rounded-[34px] border-2 border-[#E4D2BD]/88 bg-[#FFFCF6]/88 px-7 py-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.94),0_20px_44px_rgba(91,57,32,0.16),8px_10px_0_rgba(235,185,116,0.28)] backdrop-blur-md">
      <div className="absolute -right-6 -top-5 h-32 w-32 rounded-full border border-[#C4A790]/30 bg-white/20" aria-hidden="true" />
      <TravelIllustration />
      <div className="relative z-10">
        <span className="inline-flex w-fit rounded-md bg-transparent px-0 py-1 text-[16px] font-bold tracking-wide text-[#A8754B]">多人旅行账本</span>
        <h2 className="mt-5 max-w-[260px] text-[38px] font-black leading-[1.12] tracking-tighter text-[#3B2418]">
          难开口的账<br />
          轻松算清
        </h2>
        <p className="mt-4 flex max-w-none items-center gap-2 whitespace-nowrap text-[15px] font-semibold leading-none text-[#5F4736]">
          <FileText className="h-5 w-5 shrink-0 text-[#A8754B]" strokeWidth={1.9} />
          <span>支出、还款、</span>
          <PieChart className="h-5 w-5 shrink-0 text-[#C18A55]" strokeWidth={1.9} />
          <span>分摊，一页看懂。</span>
        </p>
      </div>
      <div className="relative z-10 mt-12 grid grid-cols-3 gap-2">
        {homeFeatures.map(({ label, icon: Icon }) => (
          <span
            className="flex min-h-[52px] items-center justify-center gap-1.5 rounded-[22px] border border-[#D8C2AA]/80 bg-[#F8EFE5]/86 px-2 text-center text-[12px] font-black leading-tight text-[#3B2418] shadow-[inset_0_1px_0_rgba(255,255,255,0.88),0_8px_18px_rgba(92,72,52,0.09)]"
            key={label}
          >
            <Icon className="h-4 w-4 shrink-0 text-[#A8754B]" strokeWidth={2} />
            <span>{label}</span>
          </span>
        ))}
      </div>
    </section>
  );
}

function ActionButtons() {
  return (
    <section className="mt-auto w-full space-y-4 pt-8">
      <a className="inline-flex min-h-[72px] w-full items-center justify-center gap-2 rounded-[30px] border-t border-white/15 bg-[#321D13] px-4 py-4 text-lg font-black text-white shadow-[0_12px_24px_rgba(50,29,19,0.28)] transition-all duration-200 active:scale-[0.97]" href={hrefTo("create")}>
        <Plus size={20} />
        <span>开启新旅程</span>
      </a>
      <a className="inline-flex min-h-[72px] w-full items-center justify-center gap-2 rounded-[30px] border border-[#8F7058]/45 bg-[rgba(255,250,240,0.86)] px-4 py-4 text-lg font-black text-[#321D13] shadow-[0_8px_18px_rgba(92,72,52,0.08)] backdrop-blur transition-all duration-200 active:scale-[0.97]" href={hrefTo("manage")}>
        <Wallet size={20} />
        <span>已有行程</span>
      </a>
    </section>
  );
}

function HomePage() {
  useEffect(() => {
    const lastActiveTripId = localStorage.getItem(LAST_ACTIVE_TRIP_KEY);
    if (!lastActiveTripId) return;
    if (getRecordById(lastActiveTripId)) {
      navigate("detail", { id: lastActiveTripId });
      return;
    }
    localStorage.removeItem(LAST_ACTIVE_TRIP_KEY);
  }, []);

  return (
    <main className="relative isolate mx-auto flex min-h-[100svh] max-w-[430px] flex-col overflow-hidden px-5 pb-[calc(env(safe-area-inset-bottom)+28px)] pt-[calc(env(safe-area-inset-top)+12px)] text-ink animate-page-in">
      <BackgroundScene />
      <BrandHeader />
      <section className="relative z-10 flex flex-1 flex-col items-center">
        <FeatureCard />
        <ActionButtons />
      </section>
    </main>
  );
}

function CreateChoicePage() {
  return (
    <Shell>
      <Topbar title="选模式" markVariant="choice" markSize="sm">
        <ButtonLink to="home" variant="ghost" icon={ArrowLeft}>首页</ButtonLink>
      </Topbar>
      <section className="space-y-2">
        <Eyebrow>创建行程前</Eyebrow>
        <h1 className="type-h1">这趟旅行怎么记？</h1>
      </section>
      <section className="space-y-4">
        <ModeCard to="create-parent" index="01" badge="大家长模式" title="大家长记账" copy="一人记账，大家查看。" />
        <ModeCard to="create-shared" index="02" badge="共同管理模式" title="大家一起管" copy="多人编辑，共同分摊。" />
      </section>
    </Shell>
  );
}

function ModeCard({ to, index, badge, title, copy }) {
  return (
    <a className={classNames("group block rounded-3xl border p-5 backdrop-blur transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.97]", WARM_YELLOW_CARD_CLASS)} href={hrefTo(to)}>
      <div className="flex items-start justify-between gap-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primaryDeep text-xs font-black tracking-widest text-white">{index}</span>
        <span className="text-xl font-black text-accent transition-transform group-hover:translate-x-0.5">→</span>
      </div>
      <div className="mt-5">
        <Badge>{badge}</Badge>
        <h2 className="mt-3 type-h2">{title}</h2>
        <p className="mt-2 type-body">{copy}</p>
      </div>
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
      <header className="flex items-center justify-between gap-2">
        <ButtonLink to="create" variant="ghost" icon={ArrowLeft} className="shrink-0">重选</ButtonLink>
        <div className="flex shrink-0 items-center gap-2">
          <ButtonLink to="manage" variant="secondary" icon={Wallet}>已有</ButtonLink>
        </div>
      </header>
      <section className="inner-warm-card rounded-3xl p-5">
        <div className="flex items-start gap-4">
          <CapybaraMark variant="choice" size="lg" />
          <div className="min-w-0 flex-1">
            <Badge>{isShared ? "共同管理模式" : "大家长模式"}</Badge>
            <div className="mt-3">
              <Eyebrow>{isShared ? "多人编辑，共同分摊" : "一人记账，大家查看"}</Eyebrow>
            </div>
            <h1 className="mt-2 type-h1">设置行程</h1>
          </div>
        </div>
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
            <Field label="大家长">
              <select className={inputClass()} value={selectedManager} onChange={(event) => setManager(event.target.value)}>
                {names.map((name) => <option value={name} key={name}>{name}</option>)}
              </select>
            </Field>
          ) : null}
          <Field label={isShared ? "总预算" : "每人预算"}>
            <input className={inputClass()} type="number" min="0" step="0.01" value={budget} onChange={(event) => setBudget(event.target.value)} placeholder={isShared ? "输入这趟旅行总预算" : "输入每个人的预算金额"} />
          </Field>
          <Button variant="primary" className="w-full" icon={ReceiptText} type="submit">创建行程</Button>
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
        <span className="type-caption text-ink">{label}</span>
        {action}
      </span>
      {children}
      {hint ? <span className="block type-caption normal-case">{hint}</span> : null}
    </label>
  );
}

function inputClass() {
  return "min-h-12 w-full rounded-2xl border border-line bg-[rgba(255,250,240,0.78)] px-4 py-3 text-base font-semibold text-ink outline-none transition placeholder:text-muted/65 focus:border-accent focus:bg-[rgba(255,250,240,0.95)] focus:ring-4 focus:ring-accent/15";
}

function CollabInviteModal({ trip, onClose, onReady }) {
  const [roomCode, setRoomCode] = useState(() => findRoomCodeByTripId(trip.id) || "");
  const [nickname, setNickname] = useState(() => getSelfNickname() || trip.manager || trip.people[0] || "");
  const [message, setMessage] = useState(null);
  const joinUrl = roomCode ? buildCollabJoinUrl(roomCode) : "";

  function ensureRoom() {
    if (roomCode) return roomCode;
    const cleanNickname = nickname.trim();
    if (!cleanNickname) {
      setMessage({ type: "error", text: "请先填写你的昵称。" });
      return "";
    }
    const code = createCollabRoom(trip, cleanNickname);
    setRoomCode(code);
    setMessage({ type: "success", text: "协作房间已开启。" });
    onReady?.(code);
    return code;
  }

  async function copyRoomCode() {
    const code = ensureRoom();
    if (!code) return;
    try {
      await copyText(code);
      setMessage({ type: "success", text: "房间码已复制。" });
    } catch {
      setMessage({ type: "error", text: "复制失败，请手动选中房间码复制。" });
    }
  }

  async function copyJoinUrl() {
    const code = ensureRoom();
    if (!code) return;
    try {
      await copyText(buildCollabJoinUrl(code));
      setMessage({ type: "success", text: "邀请链接已复制。" });
    } catch {
      setMessage({ type: "error", text: "复制失败，请手动选中邀请链接复制。" });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="collab-invite-title" onClick={onClose}>
      <motion.div
        className="surface-card w-full max-w-sm rounded-3xl p-5 shadow-soft"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <Eyebrow>多人协作</Eyebrow>
            <h2 id="collab-invite-title" className="mt-2 type-h2">邀请同行者</h2>
          </div>
          <button className="grid h-10 w-10 place-items-center rounded-2xl border border-line bg-paper text-ink" type="button" onClick={onClose} aria-label="关闭">
            <X size={18} />
          </button>
        </div>
        <p className="mt-3 type-body">生成房间码后，同行者可在本浏览器环境内加入并同步行程数据。</p>
        {!roomCode ? (
          <Field label="你的昵称">
            <input className={inputClass()} maxLength={16} value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="在协作中显示的名字" />
          </Field>
        ) : null}
        <div className="mt-4 rounded-3xl border border-line bg-[rgba(255,250,240,0.74)] p-4 text-center">
          <p className="type-caption normal-case">房间码</p>
          <strong className="mt-2 block select-all text-4xl font-black tracking-[0.18em] text-primaryDeep">{roomCode || "------"}</strong>
        </div>
        {joinUrl ? (
          <div className="mt-3 rounded-2xl bg-paper/75 p-3">
            <p className="type-caption normal-case">邀请链接</p>
            <p className="mt-1 break-all text-xs font-semibold leading-relaxed text-muted">{joinUrl}</p>
          </div>
        ) : null}
        <div className="mt-4 grid grid-cols-2 gap-2">
          {!roomCode ? <Button variant="primary" className="col-span-2" icon={UserPlus} onClick={ensureRoom}>开启协作</Button> : null}
          <Button variant="secondary" icon={Copy} onClick={copyRoomCode}>复制房间码</Button>
          <Button variant="secondary" icon={Link2} onClick={copyJoinUrl}>复制链接</Button>
        </div>
        <Message message={message} />
      </motion.div>
    </div>
  );
}

function TripListPage({ type = "manage" }) {
  const [version, setVersion] = useState(0);
  const [inviteTrip, setInviteTrip] = useState(null);
  const trips = useMemo(() => loadTrips(), [version]);
  const isArchive = type === "archive";

  function removeTrip(id) {
    const trip = getRecordById(id);
    if (!trip || !window.confirm(`确认删除「${getTripTitle(trip)}」吗？`)) return;
    deleteTrip(id);
    if (localStorage.getItem(LAST_ACTIVE_TRIP_KEY) === String(id)) localStorage.removeItem(LAST_ACTIVE_TRIP_KEY);
    setVersion((current) => current + 1);
  }

  return (
    <Shell>
      <Topbar title={isArchive ? "行程存档" : "已有行程"} markVariant="archive" markSize="sm" />
      <nav className="grid grid-cols-2 gap-3">
        <ButtonLink to="home" variant="ghost" icon={Home} className="min-h-[54px] rounded-[22px] text-base">首页</ButtonLink>
        <ButtonLink to="create" variant="primary" icon={Plus} className="min-h-[54px] rounded-[22px] text-base">创建</ButtonLink>
        {!isArchive ? <ButtonLink to="collaborate" variant="secondary" icon={Users} className="col-span-2 min-h-[54px] rounded-[22px] text-base">加入协作</ButtonLink> : null}
      </nav>
      <section className="space-y-2">
        <Eyebrow>{isArchive ? "历史记录" : "继续使用"}</Eyebrow>
        <h1 className="type-h1">{isArchive ? "历史账本" : "继续记账"}</h1>
      </section>
      {trips.length ? (
        <section className="space-y-4">
          {trips.map((trip) => <TripCard trip={trip} onDelete={removeTrip} onInvite={setInviteTrip} key={trip.id} />)}
        </section>
      ) : (
        <Panel className="relative overflow-hidden space-y-4 text-center">
          <EmptyWatermark />
          <div className="relative z-10 space-y-4">
            <Badge>还没有行程</Badge>
           <h2 className="type-h2">还没有行程</h2>
            <ButtonLink to="create" variant="primary" icon={Plus}>创建行程</ButtonLink>
          </div>
        </Panel>
      )}
      {inviteTrip ? <CollabInviteModal trip={inviteTrip} onClose={() => setInviteTrip(null)} /> : null}
    </Shell>
  );
}

function TripCard({ trip, onDelete, onInvite }) {
  const progress = getBudgetProgress(trip);
  const width = `${Math.min(Math.max(progress, 0), 1) * 100}%`;
  const isAlert = progress >= LOW_BALANCE_RATIO;
  return (
    <Panel className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="break-words type-h2">{getTripTitle(trip)}</h2>
          <p className="mt-1 truncate type-body">{shortModeLabel(trip.mode)} · {trip.people.join("、") || "暂无成员"}</p>
        </div>
        <Badge tone={isAlert ? "alert" : "default"}>{isAlert ? "预算告急" : "状态正常"}</Badge>
      </div>
      <div className="flex flex-row justify-between gap-2">
        <Metric label="总预算" value={formatCurrency(trip.totalBudget)} />
        <Metric label="总支出" value={formatCurrency(trip.currentSpent)} />
        <Metric label="记录数" value={`${trip.expenses.length} 笔`} />
      </div>
      <ProgressBar width={width} alert={isAlert} />
      <div className="flex justify-between type-caption normal-case">
        <span>剩余预算 <MoneyText value={formatCurrency(getRemainingBudget(trip))} /></span>
        <strong className="text-ink">{getProgressText(trip)}</strong>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ButtonLink to="detail" params={{ id: trip.id }} variant="primary" icon={ReceiptText} className="min-h-[58px] rounded-[24px] text-base sm:col-span-2">继续记账</ButtonLink>
        <ButtonLink to="review" params={{ id: trip.id }} variant="secondary" icon={Calculator} className="min-h-[54px] rounded-[22px]">看结算</ButtonLink>
        <Button variant="secondary" icon={UserPlus} className="min-h-[54px] rounded-[22px]" onClick={() => onInvite?.(trip)}>邀请入队</Button>
        <Button variant="danger" icon={Trash2} className="min-h-[54px] rounded-[22px] sm:col-span-2" onClick={() => onDelete(trip.id)}>删除行程</Button>
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

function shortModeLabel(mode) {
  return mode === "shared" ? "共同管理模式" : "大家长";
}

function BudgetOverview({ trip, remaining, progress, compact = false }) {
  const percent = Math.min(Math.max(progress, 0), 1) * 100;
  const isOverBudget = remaining < 0;
  return (
    <section className={classNames("ledger-paper space-y-4 rounded-[32px] text-ink", WARM_YELLOW_CARD_CLASS, compact ? "p-4" : "p-5")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-accentDark">预算</span>
          <p className="mt-2 text-xs font-medium tracking-widest text-muted">{isOverBudget ? "已超支" : "剩余预算"}</p>
          <p className={classNames("mt-2 leading-none tracking-tighter", compact ? "text-3xl" : "text-4xl", isOverBudget ? "text-rose-600" : "text-primaryDeep")}>
            <MoneyText value={formatCurrency(remaining)} animate />
          </p>
        </div>
        <span className={classNames("rounded-full px-3 py-1 text-xs font-black tracking-widest", isOverBudget ? "bg-rose-100 text-rose-700" : "bg-primaryDeep/8 text-primaryDeep")}>{getProgressText(trip)}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="inner-warm-card rounded-2xl p-3">
          <p className="text-xs font-medium tracking-widest text-muted">总预算</p>
          <p className="mt-1 text-lg leading-none text-ink"><MoneyText value={formatCurrency(trip.totalBudget)} /></p>
        </div>
        <div className="inner-warm-card rounded-2xl p-3">
          <p className="text-xs font-medium tracking-widest text-muted">总支出</p>
          <p className="mt-1 text-lg leading-none text-ink"><MoneyText value={formatCurrency(trip.currentSpent)} /></p>
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-3 overflow-hidden rounded-full bg-[#F6E0CF]/70">
          <div className={classNames("h-full rounded-full transition-all", isOverBudget || progress >= LOW_BALANCE_RATIO ? "bg-rose-500" : "bg-accent")} style={{ width: `${percent}%` }} />
        </div>
        <div className="flex justify-between text-xs font-medium tracking-widest text-muted">
          <span>进度</span>
          <strong>{Math.round(progress * 100)}%</strong>
        </div>
      </div>
    </section>
  );
}

function useTrip(id, version = 0) {
  return useMemo(() => getRecordById(id), [id, version]);
}

function NotFoundPage({ title = "没有找到这趟行程。", copy = "请从已有行程页面重新进入。" }) {
  return (
    <Shell>
      <Topbar title="水豚旅行" markVariant="brand" markSize="lg" />
      <Panel className="relative overflow-hidden space-y-4 text-center">
        <EmptyWatermark />
        <div className="relative z-10 space-y-4">
          <Badge tone="alert">无法打开</Badge>
        <h1 className="type-h2">{title}</h1>
        <p className="type-body">{copy}</p>
          <ButtonLink to="manage" variant="primary" icon={Wallet}>查看已有行程</ButtonLink>
        </div>
      </Panel>
    </Shell>
  );
}

function DetailPage({ id, room }) {
  const [version, setVersion] = useState(0);
  const [message, setMessage] = useState(null);
  const [activeCollabRoomCode, setActiveCollabRoomCode] = useState(() => String(room || "").toUpperCase());
  const [collabMembers, setCollabMembers] = useState([]);
  const [collabNotice, setCollabNotice] = useState("");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const collabNoticeTimer = useRef(null);
  const trip = useTrip(id, version);
  useEffect(() => {
    if (trip?.id) localStorage.setItem(LAST_ACTIVE_TRIP_KEY, trip.id);
  }, [trip?.id]);
  useEffect(() => {
    if (!trip?.id) return undefined;
    const roomFromRoute = String(room || "").trim().toUpperCase();
    const code = activeCollabRoomCode || roomFromRoute || findRoomCodeByTripId(trip.id);
    if (!code) {
      setCollabMembers([]);
      return undefined;
    }
    if (code !== activeCollabRoomCode) setActiveCollabRoomCode(code);

    const existingRoom = getCollabRoom(code);
    if (!existingRoom) {
      setMessage({ type: "error", text: "当前浏览器没有找到这个协作房间，请确认房间码。" });
      return undefined;
    }

    const nickname = setSelfNickname(getSelfNickname() || existingRoom.hostNickname || "访客");
    let lastVersion = Number(existingRoom.version) || 0;

    function syncFromRoom(showNotice = false) {
      heartbeatCollabRoom(code, nickname);
      const latestRoom = getCollabRoom(code);
      if (!latestRoom) return;
      if ((Number(latestRoom.version) || 0) !== lastVersion) {
        lastVersion = Number(latestRoom.version) || 0;
        syncLocalTripFromRoom(code);
        setVersion((current) => current + 1);
        if (showNotice) {
          setCollabNotice("已同步最新协作数据");
          window.clearTimeout(collabNoticeTimer.current);
          collabNoticeTimer.current = window.setTimeout(() => setCollabNotice(""), 2200);
        }
      }
      setCollabMembers(getOnlineMembers(code));
    }

    syncFromRoom(false);
    const channel = createCollabChannel(code, () => syncFromRoom(true));
    const timer = window.setInterval(() => syncFromRoom(true), COLLAB_POLL_INTERVAL_MS);
    return () => {
      window.clearInterval(timer);
      channel?.close?.();
    };
  }, [trip?.id, room, activeCollabRoomCode]);
  if (!trip) return <NotFoundPage />;
  const progress = getBudgetProgress(trip);
  const isAlert = progress >= LOW_BALANCE_RATIO;
  const remaining = getRemainingBudget(trip);
  const visibleCollabRoomCode = activeCollabRoomCode || findRoomCodeByTripId(trip.id);

  function removeExpense(expenseId) {
    const expense = trip.expenses.find((item) => String(item.id) === String(expenseId));
    if (!expense) return;
    const label = isTransferEntry(expense) ? `${expense.from || "-"} 转给 ${expense.to || "-"}` : (expense.note || displayCategory(expense));
    if (!window.confirm(`确认删除「${label}」这笔记录吗？`)) return;
    const updatedTrip = deleteExpense(trip.id, expenseId);
    if (!updatedTrip) return setMessage({ type: "error", text: "删除失败，请重新进入行程后再试。" });
    syncTripToExistingCollabRoom(trip.id);
    setMessage({ type: "success", text: "这笔记录已删除。" });
    setVersion((current) => current + 1);
  }

  function startCollab(nickname) {
    const existingCode = findRoomCodeByTripId(trip.id);
    const code = existingCode || createCollabRoom(trip, nickname);
    setActiveCollabRoomCode(code);
    setShowInviteModal(true);
  }

  return (
    <Shell>
      <Topbar title="旅行中" subtitle={getTripTitle(trip)} markVariant="trip" />
      <section className="surface-card rounded-3xl p-4 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{shortModeLabel(trip.mode)}</Badge>
          <span className="type-body text-sm">{trip.people.join("、") || "-"}</span>
        </div>
        {trip.mode === "parent" ? <p className="mt-2 type-caption normal-case">大家长：{trip.manager || "-"}</p> : null}
      </section>
      {visibleCollabRoomCode ? (
        <CollabStatusBar roomCode={visibleCollabRoomCode} members={collabMembers} onInvite={() => setShowInviteModal(true)} />
      ) : (
        <CollabStartCard trip={trip} onStart={startCollab} />
      )}
      {collabNotice ? <div className="fixed left-1/2 top-5 z-50 -translate-x-1/2 rounded-full bg-[#321D13]/90 px-4 py-2 text-sm font-extrabold text-white shadow-lg">{collabNotice}</div> : null}
      <BudgetOverview trip={trip} remaining={remaining} progress={progress} />
      <section className="space-y-3">
        <ButtonLink to="expense" params={{ id: trip.id }} variant="primary" icon={Plus} className="w-full rounded-3xl py-5 text-lg">记一笔</ButtonLink>
        <div className="grid grid-cols-3 gap-2">
          <ButtonLink to="review" params={{ id: trip.id }} variant="secondary" icon={Calculator} className="min-h-10 px-2 py-2 text-xs">结算</ButtonLink>
          <ButtonLink to="budget" params={{ id: trip.id }} variant="secondary" icon={Wallet} className="min-h-10 px-2 py-2 text-xs">预算</ButtonLink>
          <ButtonLink to="manage" variant="ghost" icon={ArrowLeft} className="min-h-10 px-2 py-2 text-xs">管理</ButtonLink>
        </div>
      </section>
      {isAlert ? (
        <Panel className="border-red-200 bg-red-50">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Eyebrow>预算提醒</Eyebrow>
          <h2 className="mt-2 type-h2">预算告急</h2>
            </div>
            <Badge tone="alert">{progress > 1 ? "已超预算" : "预算告急"}</Badge>
          </div>
            <p className="mt-2 type-body text-red-700">
            {progress > 1 ? (
              <>超支 <MoneyText value={formatCurrency(Math.abs(remaining))} /></>
            ) : (
              <>仅剩 <MoneyText value={formatCurrency(remaining)} /></>
            )}
          </p>
        </Panel>
      ) : null}
      <Panel className="space-y-4">
        <SectionHead eyebrow="已记录" title="最近支出" />
        <ExpenseList trip={trip} onDelete={removeExpense} />
        <Message message={message} />
      </Panel>
      <Panel className="space-y-4">
        <SectionHead eyebrow="净额" title="成员净额" badge="实时" />
        <LedgerView trip={trip} />
      </Panel>
      {showInviteModal ? (
        <CollabInviteModal trip={trip} onClose={() => setShowInviteModal(false)} onReady={setActiveCollabRoomCode} />
      ) : null}
    </Shell>
  );
}

function SectionHead({ eyebrow, title, badge }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-2 type-h2">{title}</h2>
      </div>
      {badge ? <Badge>{badge}</Badge> : null}
    </div>
  );
}

function ExpenseList({ trip, onDelete }) {
  if (!trip.expenses.length) {
    return (
      <div className={classNames("ledger-paper relative overflow-hidden rounded-3xl border p-4 type-body backdrop-blur", WHITE_LEDGER_CARD_CLASS)}>
        <EmptyWatermark />
        <span className="relative z-10">还没有支出记录，先去记一笔。</span>
      </div>
    );
  }
  return (
    <div className="relative space-y-3">
      <div className="absolute left-4 top-2 h-[calc(100%-16px)] w-px bg-line" aria-hidden="true" />
      {trip.expenses.map((expense) => {
        const isTransfer = isTransferEntry(expense);
        const label = isTransfer ? `${expense.from || "-"} → ${expense.to || "-"}` : (expense.note || displayCategory(expense));
        return (
          <article className="relative pl-9" key={expense.id}>
            <span className={classNames("absolute left-[9px] top-5 h-3 w-3 rounded-full border-2 border-[#FFF8ED]", isTransfer ? "bg-sky-400" : "bg-amber-500")} aria-hidden="true" />
            <div className={classNames("ledger-paper relative overflow-hidden rounded-3xl border p-4 backdrop-blur", WHITE_LEDGER_CARD_CLASS)}>
              <div className={classNames("absolute left-0 top-0 h-full w-1", isTransfer ? "bg-sky-400" : "bg-accent")} aria-hidden="true" />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <strong className="mt-1 block break-words type-h3 text-base">{label}</strong>
                </div>
                <div className="flex shrink-0 items-start gap-2">
                  <Badge>{isTransfer ? "还款/转账" : displayCategory(expense)}</Badge>
                  {onDelete ? (
                    <button
                      className="relative z-10 grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-red-100 bg-red-50 text-red-600 transition-all duration-200 active:scale-[0.97]"
                      type="button"
                      aria-label="删除这笔"
                      title="删除这笔"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onDelete(expense.id);
                      }}
                    >
                      <Trash2 size={17} />
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="mt-4 flex items-end justify-between gap-3 border-t border-line/60 pt-3">
                <span className="truncate type-caption normal-case">{isTransfer ? "已抵扣" : (expense.payer || trip.manager || "已记录")}</span>
                <strong className="shrink-0 text-xl leading-none"><MoneyText value={formatCurrency(expense.amount)} /></strong>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function netCardClass(amount) {
  if (amount > 0) return "border-[#9BC6A4]/75 bg-[linear-gradient(135deg,rgba(246,255,236,0.96),rgba(220,243,205,0.72)_58%,rgba(255,250,240,0.9))] shadow-[0_12px_24px_rgba(93,125,73,0.10)]";
  if (amount < 0) return "border-[#E6B7AA]/75 bg-[linear-gradient(135deg,rgba(255,248,238,0.96),rgba(255,225,211,0.76)_58%,rgba(255,250,240,0.9))] shadow-[0_12px_24px_rgba(150,82,58,0.10)]";
  return "border-[#BFD7DC]/75 bg-[linear-gradient(135deg,rgba(245,253,255,0.96),rgba(218,239,241,0.72)_58%,rgba(255,250,240,0.9))] shadow-[0_12px_24px_rgba(73,118,128,0.09)]";
}

function LedgerView({ trip }) {
  if (trip.mode === "shared") {
    const result = settleShared(trip);
    const rows = Object.entries(result.net || {});
    return (
      <div className="space-y-3">
        {rows.length ? rows.map(([name, amount]) => (
          <article className={classNames("ledger-paper relative overflow-hidden rounded-3xl border p-4 backdrop-blur", netCardClass(amount))} key={name}>
            <span className="pointer-events-none absolute -right-6 -top-8 h-20 w-20 rounded-full bg-white/34" aria-hidden="true" />
            <strong className="relative z-10 block type-h3 text-base">{name}</strong>
            <p className="relative z-10 mt-1 type-body">{amount > 0 ? "应收" : amount < 0 ? "应付" : "已平账"} · {amount > 0 ? "+" : ""}<MoneyText value={formatCurrency(amount)} /></p>
          </article>
        )) : (
          <div className={classNames("ledger-paper relative overflow-hidden rounded-3xl border p-4 type-body backdrop-blur", WHITE_LEDGER_CARD_CLASS)}>
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
          <article className={classNames("ledger-paper relative overflow-hidden rounded-3xl border p-4 backdrop-blur", netCardClass(balance))} key={name}>
            <span className="pointer-events-none absolute -right-6 -top-8 h-20 w-20 rounded-full bg-white/34" aria-hidden="true" />
            <div className="relative z-10 flex items-center justify-between gap-3">
              <strong className="type-h3 text-base">{name}</strong>
              <Badge tone={balance < 0 ? "alert" : "safe"}>{balance < 0 ? "已超支" : "未超支"}</Badge>
            </div>
            <p className="relative z-10 mt-2 type-body">已分摊：<MoneyText value={formatCurrency(spent)} /></p>
            <p className="relative z-10 type-body">人均预算：<MoneyText value={formatCurrency(trip.per)} /></p>
            <p className="relative z-10 mt-2 text-2xl"><MoneyText value={formatCurrency(balance)} animate /></p>
          </article>
        );
      })}
    </div>
  );
}

function CollabStartCard({ trip, onStart }) {
  const [nickname, setNickname] = useState(() => getSelfNickname() || trip.manager || trip.people[0] || "");
  const [message, setMessage] = useState(null);

  function start() {
    const cleanNickname = nickname.trim();
    if (!cleanNickname) return setMessage({ type: "error", text: "请先填写你的昵称。" });
    onStart(cleanNickname);
    setMessage({ type: "success", text: "协作房间已开启。" });
  }

  return (
    <Panel className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Eyebrow>多人协作</Eyebrow>
          <h2 className="mt-2 type-h2">开启协作</h2>
        </div>
        <Badge>新功能</Badge>
      </div>
      <p className="type-body">生成房间码后，同行者可在本浏览器环境内加入这趟行程并同步记账。</p>
      <Field label="你的昵称">
        <input className={inputClass()} maxLength={16} value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="在协作中显示的名字" />
      </Field>
      <Button variant="primary" className="w-full" icon={UserPlus} onClick={start}>开启协作 · 生成房间码</Button>
      <Message message={message} />
    </Panel>
  );
}

function CollabStatusBar({ roomCode, members, onInvite }) {
  return (
    <section className="rounded-3xl border border-line bg-[radial-gradient(circle_at_90%_8%,rgba(196,226,224,0.42),transparent_30%),rgba(255,250,240,0.84)] p-4 shadow-[0_12px_26px_rgba(91,57,32,0.08),inset_0_1px_0_rgba(255,255,255,0.74)] backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>协作中</Badge>
            <span className="type-caption normal-case">房间码</span>
            <strong className="select-all text-lg font-black tracking-[0.16em] text-primaryDeep">{roomCode}</strong>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {members.length ? members.map((member) => (
              <span className="inline-flex min-h-8 max-w-full items-center rounded-full border border-accent/25 bg-[#FFF8E8]/85 px-3 py-1 text-xs font-extrabold text-[#321D13]" key={member.nickname}>
                {member.isHost ? "主持" : "成员"} · {member.nickname}{member.nickname === getSelfNickname() ? "（我）" : ""}
              </span>
            )) : <span className="inline-flex min-h-8 max-w-full items-center rounded-full border border-accent/25 bg-[#FFF8E8]/85 px-3 py-1 text-xs font-extrabold text-[#321D13]">暂无在线成员</span>}
          </div>
        </div>
        <Button variant="secondary" icon={Link2} onClick={onInvite}>邀请</Button>
      </div>
    </section>
  );
}

function ExpensePage({ id }) {
  const [version, setVersion] = useState(0);
  const trip = useTrip(id, version);
  const receiptInputRef = useRef(null);
  const [amount, setAmount] = useState("");
  const [entryType, setEntryType] = useState("expense");
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState("");
  const [payer, setPayer] = useState("");
  const [transferFrom, setTransferFrom] = useState("");
  const [transferTo, setTransferTo] = useState("");
  const [participants, setParticipants] = useState([]);
  const [note, setNote] = useState("");
  const [time, setTime] = useState("");
  const [message, setMessage] = useState(null);
  const [receiptMessage, setReceiptMessage] = useState(null);
  const [receiptDraft, setReceiptDraft] = useState(null);
  const [isReceiptParsing, setIsReceiptParsing] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [decisionPrompt, setDecisionPrompt] = useState("");
  const [isDecisionLoading, setIsDecisionLoading] = useState(false);
  const [decisionReply, setDecisionReply] = useState("写下问题，水豚给个轻建议。");

  useEffect(() => {
    if (trip) {
      setParticipants(trip.people);
      setPayer(trip.people[0] || "");
      setTransferFrom(trip.people.find((name) => name !== trip.manager) || trip.people[0] || "");
      setTransferTo(trip.manager || trip.people[0] || "");
      localStorage.setItem(LAST_ACTIVE_TRIP_KEY, trip.id);
    }
  }, [trip?.id]);

  if (!trip) return <NotFoundPage />;
  const isShared = trip.mode === "shared";

  function toggleParticipant(name) {
    setParticipants((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name]);
  }

  function applyReceiptDraft(draft) {
    setEntryType("expense");
    if (draft.amount > 0) setAmount(String(draft.amount));
    if (EXPENSE_CATEGORIES.includes(draft.category)) {
      setCategory(draft.category);
      setCustomCategory(draft.category === "其他" ? draft.customCategory || draft.category || "" : "");
    }
    if (draft.note || draft.merchant) setNote(draft.note || draft.merchant);
    if (draft.time) setTime(draft.time);
  }

  async function handleReceiptUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsReceiptParsing(true);
    setReceiptMessage({ type: "success", text: "正在识别账单截图..." });
    setReceiptDraft(null);
    try {
      const draft = await parseReceiptImageFile(file, { allowedCategories: EXPENSE_CATEGORIES });
      applyReceiptDraft(draft);
      setReceiptDraft(draft);
      const warnings = [
        draft.confidence > 0 && draft.confidence < 0.55 ? "识别置信度较低，请仔细核对。" : "",
        ...(draft.warnings || [])
      ].filter(Boolean);
      setReceiptMessage({
        type: warnings.length ? "error" : "success",
        text: warnings.length ? warnings.join(" ") : "已识别账单，并填入下方表单。保存前请确认金额、分类和时间。"
      });
    } catch (error) {
      setReceiptMessage({ type: "error", text: error.message || "账单识别失败，请手动录入。" });
    } finally {
      setIsReceiptParsing(false);
      event.target.value = "";
    }
  }

  function submit(event) {
    event.preventDefault();
    const expenseAmount = toPositiveNumber(amount);
    if (entryType === "transfer") {
      const cleanFrom = transferFrom.trim();
      const cleanTo = transferTo.trim();
      if (expenseAmount <= 0) return setMessage({ type: "error", text: "转账金额必须大于 0。" });
      if (!cleanFrom || !cleanTo) return setMessage({ type: "error", text: "请选择付款人和收款人。" });
      if (cleanFrom === cleanTo) return setMessage({ type: "error", text: "付款人和收款人不能相同。" });

      const transfer = sanitizeExpense({
        id: createId(),
        type: "transfer",
        amount: expenseAmount,
        from: cleanFrom,
        to: cleanTo,
        note,
        time
      });
      updateTrip(trip.id, (currentTrip) => ({ ...currentTrip, expenses: [...currentTrip.expenses, transfer] }));
      syncTripToExistingCollabRoom(trip.id);
      setAmount("");
      setNote("");
      setTime("");
      setMessage({ type: "success", text: "转账已记录，最终结算会自动抵扣。" });
      setVersion((current) => current + 1);
      setShowSuccessModal(true);
      return;
    }

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
    syncTripToExistingCollabRoom(trip.id);
    setAmount("");
    setCategory(EXPENSE_CATEGORIES[0]);
    setCustomCategory("");
    setNote("");
    setTime("");
    setParticipants(trip.people);
    if (isShared) setPayer(trip.people[0] || "");
    setMessage({ type: "success", text: "支出已记录，可以继续记下一笔。" });
    setVersion((current) => current + 1);
    setShowSuccessModal(true);
  }

  async function askDecision() {
    if (isDecisionLoading) return;
    if (!decisionPrompt.trim()) {
      setDecisionReply("先把问题写下来。");
      return;
    }
    setIsDecisionLoading(true);
    setDecisionReply("水豚正在拍板...");
    try {
      const result = await requestDecisionAdvice({
        prompt: decisionPrompt,
        tripTitle: getTripTitle(trip),
        people: trip.people,
        category,
        note,
        amount,
        time
      });
      const warnings = result.warnings?.length ? ` ${result.warnings.join(" ")}` : "";
      setDecisionReply(`${result.advice}${warnings}`);
    } catch (error) {
      setDecisionReply(error.message || "水豚拍板暂时不可用，请稍后再试。");
    } finally {
      setIsDecisionLoading(false);
    }
  }

  return (
    <>
    <Shell>
      <header className="flex items-center justify-between gap-3">
        <a className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-2xl border border-line bg-[rgba(255,250,240,0.62)] px-3 py-2 text-sm font-extrabold text-ink transition-all duration-200 active:scale-[0.97]" href={hrefTo("detail", { id: trip.id })} aria-label="返回行程详情">
          <ArrowLeft size={17} />
          <span>返回</span>
        </a>
        <div className="min-w-0 flex-1 text-center">
          <strong className="block truncate type-h3 text-base text-ink">记一笔</strong>
          <small className="block truncate type-caption normal-case">{getTripTitle(trip)}</small>
        </div>
        <span className="flex h-11 w-[72px] shrink-0 justify-end" aria-hidden="true">
          <CapybaraMark variant="entry" size="sm" />
        </span>
      </header>
      <Panel className="space-y-5">
        <div>
          <Eyebrow>{entryType === "transfer" ? "还款" : "支出"}</Eyebrow>
          <h1 className="mt-2 type-h1">记一笔</h1>
        </div>
        <div className="grid grid-cols-2 gap-2 rounded-3xl bg-card/70 p-1">
          <button className={classNames("rounded-2xl px-4 py-3 text-sm font-extrabold transition-all duration-200 active:scale-[0.97]", entryType === "expense" ? "bg-paper text-ink ring-1 ring-line/60" : "text-muted")} type="button" onClick={() => setEntryType("expense")}>支出</button>
          <button className={classNames("rounded-2xl px-4 py-3 text-sm font-extrabold transition-all duration-200 active:scale-[0.97]", entryType === "transfer" ? "bg-paper text-ink ring-1 ring-line/60" : "text-muted")} type="button" onClick={() => setEntryType("transfer")}>还款</button>
        </div>
        <div className="rounded-3xl border border-line/70 bg-[rgba(255,250,240,0.66)] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <Eyebrow>AI 识别</Eyebrow>
              <h2 className="mt-1 type-h3">识别账单截图</h2>
              <p className="mt-1 type-body">上传小票或支付截图，识别结果会先填入表单，确认后再保存。</p>
            </div>
            <Button
              variant="secondary"
              icon={Sparkles}
              disabled={isReceiptParsing}
              onClick={() => receiptInputRef.current?.click()}
            >
              {isReceiptParsing ? "识别中" : "上传截图"}
            </Button>
          </div>
          <input
            ref={receiptInputRef}
            className="hidden"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            onChange={handleReceiptUpload}
          />
          <Message message={receiptMessage} />
          {receiptDraft ? (
            <div className="mt-3 grid gap-2 rounded-2xl bg-white/45 p-3 text-sm font-bold text-muted">
              <span>金额：{receiptDraft.amount > 0 ? formatCurrency(receiptDraft.amount) : "待确认"}</span>
              <span>分类：{receiptDraft.category}</span>
              <span>备注：{receiptDraft.note || receiptDraft.merchant || "待确认"}</span>
              {receiptDraft.time ? <span>时间：{receiptDraft.time.replace("T", " ")}</span> : null}
            </div>
          ) : null}
        </div>
        <form className="space-y-5" onSubmit={submit}>
          <Field label="金额">
            <input className={inputClass()} type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder={entryType === "transfer" ? "转账金额" : "本笔花费"} />
          </Field>
          {entryType === "transfer" ? (
            <>
              <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
                <Field label="付款人">
                  <select className={inputClass()} value={transferFrom} onChange={(event) => setTransferFrom(event.target.value)}>
                    {trip.people.map((name) => <option value={name} key={name}>{name}</option>)}
                  </select>
                </Field>
                <span className="pb-4 text-xl font-extrabold text-accent">→</span>
                <Field label="收款人">
                  <select className={inputClass()} value={transferTo} onChange={(event) => setTransferTo(event.target.value)}>
                    {trip.people.map((name) => <option value={name} key={name}>{name}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="备注">
                <input className={inputClass()} maxLength={30} value={note} onChange={(event) => setNote(event.target.value)} placeholder="例如：B 已转给 A" />
              </Field>
            </>
          ) : (
            <>
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
                    <label className={classNames("flex min-h-12 items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-extrabold transition-all duration-200 active:scale-[0.97]", participants.includes(name) ? "border-accent bg-accent/10 text-ink" : "border-line bg-[rgba(255,250,240,0.72)] text-muted")} key={name}>
                      <input className="h-4 w-4 accent-accent" type="checkbox" checked={participants.includes(name)} onChange={() => toggleParticipant(name)} />
                      <span className="truncate">{name}</span>
                    </label>
                  ))}
                </div>
              </Field>
              <Field label="备注">
                <input className={inputClass()} maxLength={30} value={note} onChange={(event) => setNote(event.target.value)} placeholder="例如：晚餐、门票、打车" />
              </Field>
              <DecisionCard prompt={decisionPrompt} setPrompt={setDecisionPrompt} reply={decisionReply} onAsk={askDecision} isLoading={isDecisionLoading} />
            </>
          )}
          <Field label="时间">
            <input className={inputClass()} type="datetime-local" value={time} onChange={(event) => setTime(event.target.value)} />
          </Field>
          <div className="flex flex-row gap-3">
            <a className="inline-flex min-h-11 w-1/3 items-center justify-center rounded-2xl bg-stone-200 px-4 py-2.5 text-sm font-extrabold text-ink transition-all duration-200 active:scale-[0.97]" href={hrefTo("detail", { id: trip.id })}>取消</a>
            <Button variant="primary" className="w-2/3" icon={ReceiptText} type="submit">保存</Button>
          </div>
          <Message message={message} />
        </form>
      </Panel>
    </Shell>
    {showSuccessModal ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="expense-success-title">
        <motion.div
          className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-soft"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-green-50 text-4xl">✅</div>
          <h2 id="expense-success-title" className="mt-5 type-h2">记账成功！</h2>
          <p className="mt-2 type-body">已同步至当前行程</p>
          <Button
            variant="primary"
            className="mt-6 w-full"
            onClick={() => {
              setShowSuccessModal(false);
              navigate("detail", { id: trip.id });
            }}
          >
            确定
          </Button>
        </motion.div>
      </div>
    ) : null}
    </>
  );
}

function DecisionCard({ prompt, setPrompt, reply, onAsk, isLoading = false }) {
  return (
    <details className="surface-card group rounded-3xl p-3">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-1 py-1 text-sm font-extrabold text-ink transition-all active:scale-[0.98]">
        <span>水豚拍板</span>
        <span className="type-caption normal-case text-muted group-open:hidden">可选</span>
        <span className="hidden type-caption normal-case text-muted group-open:inline">收起</span>
      </summary>
      <div className="mt-3 space-y-3">
      <div className="flex flex-wrap gap-2">
        {DECISION_TAGS.map((tag) => (
          <button className="rounded-full bg-card px-2 py-1.5 text-xs font-extrabold text-ink transition-all duration-200 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50" type="button" key={tag} disabled={isLoading} onClick={() => setPrompt(tag)}>
            {tag}
          </button>
        ))}
      </div>
      <textarea rows={2} className="w-full rounded-2xl border border-line bg-[rgba(255,250,240,0.78)] px-3 py-2 text-sm font-normal leading-relaxed text-ink outline-none placeholder:text-muted/65 focus:ring-4 focus:ring-accent/15 disabled:cursor-not-allowed disabled:opacity-60" value={prompt} disabled={isLoading} onChange={(event) => setPrompt(event.target.value)} placeholder="例如：火锅还是烧烤？" />
      <Button variant="secondary" className="min-h-9 w-full py-2 text-xs" icon={Sparkles} disabled={isLoading} onClick={onAsk}>{isLoading ? "水豚思考中" : "给个建议"}</Button>
      <div className="rounded-2xl bg-paper p-3 text-sm font-normal leading-relaxed text-muted">{reply}</div>
      </div>
    </details>
  );
}

function BudgetPage({ id }) {
  const [version, setVersion] = useState(0);
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const trip = useTrip(id, version);
  useEffect(() => {
    if (trip?.id) localStorage.setItem(LAST_ACTIVE_TRIP_KEY, trip.id);
  }, [trip?.id]);
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
    syncTripToExistingCollabRoom(trip.id);
    setAmount("");
    setMessage({ type: "success", text: "预算已追加。" });
    setVersion((current) => current + 1);
    setShowSuccessModal(true);
  }

  return (
    <>
    <Shell>
      <Topbar title="加预算" subtitle={getTripTitle(trip)} markVariant="budget" markSize="sm">
        <ButtonLink to="detail" params={{ id: trip.id }} variant="ghost" icon={ArrowLeft}>返回</ButtonLink>
      </Topbar>
      <Panel>
        <form className="space-y-5" onSubmit={submit}>
          <div>
            <Eyebrow>预算</Eyebrow>
        <h1 className="mt-2 type-h1">加预算</h1>
          </div>
          <Metric label="当前总预算" value={formatCurrency(trip.totalBudget)} />
          <Field label="追加金额">
            <input className={inputClass()} type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="补充金额" />
          </Field>
          <Button variant="primary" className="w-full" icon={Wallet} type="submit">保存</Button>
          <Message message={message} />
        </form>
      </Panel>
    </Shell>
    {showSuccessModal ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="budget-success-title">
        <motion.div
          className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-soft"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-green-50 text-4xl">✅</div>
          <h2 id="budget-success-title" className="mt-5 type-h2">预算已增加</h2>
          <p className="mt-2 type-body">已同步至当前行程</p>
          <Button
            variant="primary"
            className="mt-6 w-full"
            onClick={() => {
              setShowSuccessModal(false);
              navigate("detail", { id: trip.id });
            }}
          >
            确定
          </Button>
        </motion.div>
      </div>
    ) : null}
    </>
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

function getExpenseDateKey(expense) {
  const date = new Date(expense.time);
  if (!Number.isFinite(date.getTime())) return "unknown";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function getExpenseDateLabel(expense) {
  const date = new Date(expense.time);
  if (!Number.isFinite(date.getTime())) return "时间未记";
  return `${date.getMonth() + 1}月${date.getDate()}日`;
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
  return getExpenseEntries(trip)
    .filter((expense) => expense.amount >= 15 || hasLandmarkSignal(expense))
    .sort((left, right) => {
      const leftTime = new Date(left.time).getTime();
      const rightTime = new Date(right.time).getTime();
      const leftSafe = Number.isFinite(leftTime) ? leftTime : Number.MAX_SAFE_INTEGER;
      const rightSafe = Number.isFinite(rightTime) ? rightTime : Number.MAX_SAFE_INTEGER;
      return leftSafe - rightSafe;
    });
}

function getDailyExpenseTotals(trip) {
  return getExpenseEntries(trip).reduce((totals, expense) => {
    const key = getExpenseDateKey(expense);
    totals[key] = round2((totals[key] || 0) + expense.amount);
    return totals;
  }, {});
}

function getTimelineGroups(expenses, dailyTotals) {
  const groups = [];
  for (const expense of expenses) {
    const key = getExpenseDateKey(expense);
    let group = groups.find((item) => item.key === key);
    if (!group) {
      group = {
        key,
        label: getExpenseDateLabel(expense),
        total: dailyTotals[key] || 0,
        expenses: []
      };
      groups.push(group);
    }
    group.expenses.push(expense);
  }
  return groups;
}

function getTripDurationText(trip) {
  const dates = getExpenseEntries(trip)
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
  const dailyTotals = useMemo(() => getDailyExpenseTotals(trip), [trip]);
  const categoryTotals = useMemo(() => getCategoryTotals(trip), [trip]);
  const footprints = useMemo(() => getCoreFootprints(trip, timelineExpenses), [trip, timelineExpenses]);
  const durationText = useMemo(() => getTripDurationText(trip), [trip]);
  const expenseEntries = useMemo(() => getExpenseEntries(trip), [trip]);
  const topExpense = useMemo(() => expenseEntries.reduce((top, item) => (!top || item.amount > top.amount ? item : top), null), [expenseEntries]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <motion.section className="fixed inset-0 z-50 bg-[linear-gradient(180deg,#FFF8EA_0%,#FDFBF7_46%,#F5E5D0_100%)] text-ink" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.42, ease: "easeOut" }}>
      <header className="fixed inset-x-0 top-0 z-10 border-b border-line/60 bg-[#FFF8EA]/92 px-5 pb-3 pt-[calc(env(safe-area-inset-top)+10px)] backdrop-blur">
        <div className="mx-auto flex max-w-[430px] items-center justify-between gap-3">
          <button className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-2xl border border-[#8F7058]/45 bg-[rgba(255,250,240,0.82)] px-3 text-sm font-extrabold text-ink shadow-sm transition-all duration-200 active:scale-[0.97]" type="button" onClick={onClose} aria-label="返回上一页">
            <ArrowLeft size={18} />
            <span>返回</span>
          </button>
          <div className="min-w-0 flex-1 text-center">
            <h1 className="truncate text-base font-black text-ink">旅行回忆</h1>
            <p className="truncate text-xs font-semibold text-muted">{getTripTitle(trip)}</p>
          </div>
          <span className="h-11 w-[72px] shrink-0" aria-hidden="true" />
        </div>
      </header>

      <div className="h-full overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+42px)] pt-[calc(env(safe-area-inset-top)+112px)]">
        <div className="mx-auto max-w-[430px] space-y-6">
          <article className="ledger-paper inner-warm-card animate-fade-in rounded-[32px] p-6 text-ink">
            <div className="grid grid-cols-2 gap-5">
              <div>
                <span className="text-xs font-semibold tracking-[0.22em] text-accentDark">总耗时</span>
                <strong className="mt-2 block text-2xl font-black tracking-tight text-ink">{durationText}</strong>
              </div>
              <div className="text-right">
                <span className="text-xs font-semibold tracking-[0.22em] text-accentDark">总花费</span>
                <strong className="mt-2 block text-3xl text-primaryDeep"><MoneyText value={formatCurrency(getTripTotalSpent(trip))} animate /></strong>
              </div>
              <div className="inner-warm-card col-span-2 rounded-3xl p-4">
                <span className="text-xs font-semibold tracking-[0.22em] text-muted">核心足迹</span>
                <p className="mt-2 text-sm leading-relaxed text-stone-700">📍 {footprints.join(" ➔ ")}</p>
              </div>
            </div>
          </article>

          <MemoryHighlights trip={trip} topExpense={topExpense} topCategory={categoryTotals[0]} footprints={footprints} />
          <CategoryDonut totals={categoryTotals} total={getTripTotalSpent(trip)} />

          <section className="space-y-5">
            <h2 className="type-h2">时间线</h2>
            <Timeline expenses={timelineExpenses} dailyTotals={dailyTotals} />
          </section>
        </div>
      </div>
    </motion.section>
  );
}

const CHART_COLORS = ["#D97736", "#6C8B57", "#C0844B", "#7CA7B8", "#A16207", "#8B7A6A"];

function MemoryHighlights({ trip, topExpense, topCategory, footprints }) {
  const items = [
    ["一句话", `${getTripTitle(trip)}，账已算清。`],
    ["最贵", topExpense ? `${getExpenseLabel(topExpense)} · ${formatCurrency(topExpense.amount)}` : "还没记录"],
    ["花在哪", topCategory ? `${topCategory.category} · ${topCategory.percent}%` : "暂无占比"],
    ["记住", footprints[0] || getTripTitle(trip)]
  ];
  return (
    <section className="grid grid-cols-2 gap-3">
      {items.map(([label, value]) => (
        <article className="surface-card rounded-3xl p-4 backdrop-blur" key={label}>
          <p className="type-caption normal-case">{label}</p>
          <h3 className="mt-2 line-clamp-2 text-base font-extrabold leading-snug text-ink">{value}</h3>
        </article>
      ))}
    </section>
  );
}

function CategoryDonut({ totals, total }) {
  const circumference = 2 * Math.PI * 42;
  let offset = 0;
  if (!totals.length || total <= 0) {
    return (
      <article className="surface-card relative flex min-h-[98px] items-center overflow-hidden animate-fade-in rounded-3xl p-5 type-body">
        <img className="pointer-events-none absolute -right-8 -bottom-10 z-0 h-36 w-36 opacity-[0.055]" src={heroCapybara} alt="" aria-hidden="true" />
        <span className="relative z-10">还没有可用于生成占比图的支出。</span>
      </article>
    );
  }

  return (
    <article className="surface-card animate-fade-in rounded-3xl p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Eyebrow>占比</Eyebrow>
          <h2 className="mt-2 type-h2">资金占比</h2>
        </div>
        <div className="relative h-28 w-28 shrink-0">
          <svg viewBox="0 0 100 100" className="h-full w-full">
            <circle cx="50" cy="50" r="42" fill="none" stroke="#E9CDAF" strokeWidth="13" />
            {totals.map((item, index) => {
              const dash = (item.amount / total) * circumference;
              const circle = (
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke={CHART_COLORS[index % CHART_COLORS.length]}
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="round"
                  strokeWidth="13"
                  transform="rotate(-90 50 50)"
                  key={item.category}
                />
              );
              offset += dash;
              return circle;
            })}
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center">
            <span className="type-caption normal-case">总支出</span>
          </div>
        </div>
      </div>
      <div className="mt-5 space-y-3">
        {totals.map((item, index) => (
          <div className="flex items-center justify-between gap-3 type-body" key={item.category}>
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
              <span className="truncate">{item.category}</span>
            </span>
            <span className="shrink-0"><MoneyText value={formatCurrency(item.amount)} /> · {item.percent}%</span>
          </div>
        ))}
      </div>
    </article>
  );
}

function Timeline({ expenses, dailyTotals }) {
  if (!expenses.length) {
    return (
      <div className="surface-card relative flex min-h-[108px] items-center overflow-hidden animate-fade-in rounded-3xl p-5 type-body">
        <img className="pointer-events-none absolute -right-8 -bottom-10 z-0 h-36 w-36 opacity-[0.055]" src={heroCapybara} alt="" aria-hidden="true" />
        <span className="relative z-10">还没有可生成回忆的核心支出。</span>
      </div>
    );
  }

  const groups = getTimelineGroups(expenses, dailyTotals);
  return (
    <div className="relative space-y-5">
      <div className="absolute left-4 top-0 h-full w-px bg-gray-200" aria-hidden="true" />
      {groups.map((group, groupIndex) => (
        <div className="relative space-y-3 pl-12" key={group.key}>
          <div className="relative animate-fade-in rounded-2xl bg-card/80 px-4 py-3">
            <span className="absolute -left-[37px] top-4 h-3 w-3 rounded-full border-2 border-[#FDFBF7] bg-ink shadow-sm" aria-hidden="true" />
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="type-h3">{group.label}</h3>
              <span className="type-caption normal-case">当日 <MoneyText value={formatCurrency(group.total)} /></span>
            </div>
          </div>
          {group.expenses.map((expense, index) => (
            <article className="relative animate-fade-in" style={{ animationDelay: `${(groupIndex + index) * 55}ms` }} key={expense.id}>
              <span className="absolute -left-[37px] top-5 h-3 w-3 rounded-full border-2 border-[#FDFBF7] bg-amber-500 shadow-sm" aria-hidden="true" />
              <div className="inner-warm-card rounded-3xl p-5">
                <p className="type-caption normal-case">{getTimelineTime(expense)}</p>
                <h3 className="mt-1 type-h3">{getExpenseLabel(expense)}</h3>
                <p className="mt-2 type-body">花费: <MoneyText value={formatCurrency(expense.amount)} /></p>
              </div>
            </article>
          ))}
        </div>
      ))}
    </div>
  );
}

function ReviewPage({ id, summary = false }) {
  const [showTripSummary, setShowTripSummary] = useState(false);
  const trip = useTrip(id);
  useEffect(() => {
    if (trip?.id) localStorage.setItem(LAST_ACTIVE_TRIP_KEY, trip.id);
  }, [trip?.id]);
  if (!trip) return <NotFoundPage />;
  const parentResult = trip.mode === "parent" ? settle(trip) : null;
  const sharedResult = trip.mode === "shared" ? settleShared(trip) : null;
  const remaining = getRemainingBudget(trip);

  return (
    <Shell>
      <Topbar title={summary ? "结算总结" : "结算"} markVariant="settlement" markSize="sm" />
      <section className="space-y-2">
        <Eyebrow>{summary ? "总结" : "结算"}</Eyebrow>
        <h1 className="type-h1">{getTripTitle(trip)}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{shortModeLabel(trip.mode)}</Badge>
          <span className="type-body text-sm">成员：{trip.people.join("、") || "-"}</span>
        </div>
      </section>
      <Panel className="space-y-4">
        <SectionHead eyebrow="转账" title="转账路径" />
        {trip.mode === "shared" && sharedResult ? <SharedSettlement result={sharedResult} /> : null}
        {trip.mode === "parent" && parentResult ? <ParentSettlement trip={trip} result={parentResult} /> : null}
      </Panel>
      <ButtonLink to="detail" params={{ id: trip.id }} variant="secondary" icon={ReceiptText} className="w-full py-4">继续记账</ButtonLink>
      <Panel className="space-y-4">
        <SectionHead eyebrow="分类" title="钱花在哪" />
        <CategoryShareList trip={trip} />
      </Panel>
      <Panel className="space-y-4">
        <SectionHead eyebrow="明细" title="支出记录" />
        <ExpenseList trip={trip} />
      </Panel>
      <button className="inline-flex w-full min-h-14 items-center justify-center rounded-2xl bg-primaryDeep px-4 py-4 text-sm font-extrabold text-white shadow-button transition-all duration-200 active:scale-[0.97]" type="button" onClick={() => setShowTripSummary(true)}>
        <span>生成旅行回忆</span>
      </button>
      {showTripSummary ? <TripSummaryView trip={trip} onClose={() => setShowTripSummary(false)} /> : null}
    </Shell>
  );
}

function CategoryShareList({ trip }) {
  const totals = getCategoryTotals(trip);
  if (!totals.length) {
    return (
      <div className="surface-card relative overflow-hidden rounded-3xl p-4 type-body">
        <EmptyWatermark />
        <span className="relative z-10">还没有支出记录。</span>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {totals.map((item) => (
        <article className="surface-card rounded-3xl p-4" key={item.category}>
          <div className="flex items-center justify-between gap-3 text-sm">
            <strong className="type-h3 text-base">{item.category}</strong>
            <span><MoneyText value={formatCurrency(item.amount)} /> · {item.percent}%</span>
          </div>
          <div className="mt-3"><ProgressBar width={`${item.percent}%`} /></div>
        </article>
      ))}
    </div>
  );
}

function ParentSettlement({ trip, result }) {
  const transferRows = result.transfers || [];
  const remainingTotal = round2(transferRows.reduce((sum, item) => sum + item.amount, 0));
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {transferRows.length ? transferRows.map((row) => (
          <article className="ledger-paper inner-warm-card relative overflow-hidden rounded-[28px] p-5 text-ink" key={`${row.from}-${row.to}-${row.amount}`}>
            <div className="absolute inset-y-0 right-0 w-1.5 bg-primaryDeep" aria-hidden="true" />
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold tracking-[0.22em] text-accentDark">转账路径</p>
                <h3 className="mt-2 text-xl font-black tracking-tight text-ink">{row.from} <span className="text-primaryDeep">→</span> {row.to}</h3>
              </div>
              <strong className="shrink-0 pr-2 text-2xl leading-none text-primaryDeep"><MoneyText value={formatCurrency(row.amount)} /></strong>
            </div>
          </article>
        )) : (
          <div className="surface-card relative overflow-hidden rounded-3xl p-5 type-body">
            <EmptyWatermark />
            <span className="relative z-10">当前已平账，无需额外转账。</span>
          </div>
        )}
      </div>
      <article className="surface-card rounded-3xl p-4 backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Badge tone={result.mode === "extra" ? "alert" : "default"}>{result.mode === "extra" ? "补款" : "返还"}</Badge>
            <h3 className="mt-3 type-h3">成员净额</h3>
          </div>
          <strong className="text-2xl leading-none"><MoneyText value={formatCurrency(remainingTotal)} animate /></strong>
        </div>
      </article>
    </div>
  );
}

function SharedSettlement({ result }) {
  const netRows = Object.entries(result.net || {});
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {result.transfers.length ? result.transfers.map((transfer) => (
          <article className="ledger-paper inner-warm-card relative overflow-hidden rounded-[28px] p-5 text-ink" key={`${transfer.from}-${transfer.to}-${transfer.amount}`}>
            <div className="absolute inset-y-0 right-0 w-1.5 bg-primaryDeep" aria-hidden="true" />
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold tracking-[0.22em] text-accentDark">转账路径</p>
                <h3 className="mt-2 text-xl font-black tracking-tight text-ink">{transfer.from} <span className="text-primaryDeep">→</span> {transfer.to}</h3>
              </div>
              <strong className="shrink-0 pr-2 text-2xl leading-none text-primaryDeep"><MoneyText value={formatCurrency(transfer.amount)} /></strong>
            </div>
          </article>
        )) : (
          <div className="surface-card relative overflow-hidden rounded-3xl p-5 type-body">
            <EmptyWatermark />
            <span className="relative z-10">当前已平账，无需额外转账。</span>
          </div>
        )}
      </div>
      <div>
        <h3 className="mb-3 type-h3 text-base">成员净额</h3>
        <div className="grid grid-cols-3 gap-2">
          {netRows.map(([name, amount]) => (
            <article className="surface-card rounded-2xl p-3" key={name}>
              <strong className="block truncate text-sm font-extrabold text-ink">{name}</strong>
              <p className="mt-1 type-caption normal-case">{amount > 0 ? "应收" : amount < 0 ? "应付" : "平账"}</p>
              <p className={classNames("mt-1 text-sm leading-none", amount < 0 ? "text-rose-600" : "text-ink")}>{amount > 0 ? "+" : ""}<MoneyText value={formatCurrency(amount)} /></p>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

function CollaboratePage({ room }) {
  const [roomCode, setRoomCode] = useState(() => String(room || "").toUpperCase());
  const [nickname, setNickname] = useState(() => getSelfNickname());
  const [message, setMessage] = useState(null);

  function submit(event) {
    event.preventDefault();
    const code = roomCode.trim().toUpperCase();
    const cleanNickname = nickname.trim();
    if (code.length !== 6) return setMessage({ type: "error", text: "请输入正确的 6 位房间码。" });
    if (!cleanNickname) return setMessage({ type: "error", text: "请填写你的昵称。" });

    const existingRoom = getCollabRoom(code);
    if (!existingRoom) return setMessage({ type: "error", text: "房间码不存在，请确认后再试。" });
    const isExistingName = Array.isArray(existingRoom.members) && existingRoom.members.some((member) => member.nickname === cleanNickname);
    const joinedRoom = joinCollabRoom(code, cleanNickname);
    if (!joinedRoom) return setMessage({ type: "error", text: "加入失败，请重新检查房间码。" });

    setMessage({ type: "success", text: isExistingName ? "已使用这个昵称进入行程。" : "加入成功，正在进入行程。" });
    window.setTimeout(() => navigate("detail", { id: joinedRoom.tripId, room: code }), 500);
  }

  return (
    <Shell>
      <Topbar title="加入协作" markVariant="choice" markSize="sm">
        <ButtonLink to="manage" variant="ghost" icon={ArrowLeft}>返回</ButtonLink>
      </Topbar>
      <section className="space-y-2">
        <Eyebrow>多人协作</Eyebrow>
        <h1 className="type-h1">加入同行者的行程</h1>
        <p className="type-body">输入同行者分享的 6 位房间码，即可在当前浏览器环境内同步这趟行程。</p>
      </section>
      <Panel>
        <form className="space-y-5" onSubmit={submit}>
          <Field label="房间码">
            <input
              className={`${inputClass()} text-center text-2xl tracking-[0.2em]`}
              maxLength={6}
              value={roomCode}
              onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
              placeholder="AB3K7Z"
            />
          </Field>
          <Field label="你的昵称" hint="昵称会显示在协作成员列表中。">
            <input className={inputClass()} maxLength={16} value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="在行程中显示的名字" />
          </Field>
          <Button variant="primary" className="w-full" icon={Users} type="submit">加入行程</Button>
          <Message message={message} />
        </form>
      </Panel>
      <Panel className="space-y-2">
        <h2 className="type-h3">还没有房间码？</h2>
        <p className="type-body">让行程发起人在详情页开启协作，或在已有行程页点击“邀请入队”生成房间码。</p>
        <ButtonLink to="manage" variant="secondary" icon={Wallet}>去已有行程</ButtonLink>
      </Panel>
    </Shell>
  );
}

function AboutPage() {
  return (
    <Shell>
      <Topbar title="说明" markVariant="brand" markSize="lg">
        <ButtonLink to="home" variant="ghost" icon={ArrowLeft}>首页</ButtonLink>
        <ButtonLink to="create" variant="primary" icon={Plus}>开始</ButtonLink>
      </Topbar>
      <section className="space-y-3">
        <Eyebrow>水豚旅行</Eyebrow>
        <h1 className="type-h1">多人旅行账本</h1>
        <p className="type-body">记支出、算分摊、生成转账路径。</p>
      </section>
      <section className="space-y-4">
        {[
          ["创建", "定成员和预算", "选择大家长或共同管理模式。"],
          ["记录", "谁付谁参与", "支出、还款都能记。"],
          ["结算", "看转账路径", "谁转给谁一眼清楚。"]
        ].map(([badge, title, copy]) => (
          <Panel key={badge}>
            <Badge>{badge}</Badge>
            <h2 className="mt-4 type-h2">{title}</h2>
            <p className="mt-2 type-body">{copy}</p>
          </Panel>
        ))}
      </section>
    </Shell>
  );
}

export default function App() {
  const route = useRoute();
  const id = route.params.get("id");
  const room = route.params.get("room");
  const pages = {
    home: <HomePage />,
    create: <CreateChoicePage />,
    "create-parent": <CreateTripPage mode="parent" />,
    "create-shared": <CreateTripPage mode="shared" />,
    manage: <TripListPage />,
    archive: <TripListPage type="archive" />,
    detail: <DetailPage id={id} room={room} />,
    expense: <ExpensePage id={id} />,
    budget: <BudgetPage id={id} />,
    collaborate: <CollaboratePage room={room} />,
    review: <ReviewPage id={id} />,
    summary: <ReviewPage id={id} summary />,
    about: <AboutPage />
  };
  const page = pages[route.name] || <HomePage />;
  if (route.name === "home" || !pages[route.name]) return page;
  return <div className="px-5 sm:px-6">{page}</div>;
}
