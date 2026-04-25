import { useEffect, useState } from "react";
import { motion, useMotionValue, useMotionValueEvent, useSpring } from "framer-motion";
import heroCapybara from "../../assets/hero-capybara.svg";
import { formatCurrency } from "../lib/travel";
import { hrefTo } from "../lib/router";

export function classNames(...values) {
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

export function MoneyText({ value, animate = false, className }) {
  const baseClass = classNames("font-extrabold tracking-tight tabular-money", className);
  if (animate && isCurrencyValue(value)) return <AnimatedMoneyText value={value} className={baseClass} />;
  return <span className={baseClass}>{value}</span>;
}

export function EmptyWatermark() {
  return <img className="pointer-events-none absolute -right-5 -bottom-7 z-0 h-32 w-32 opacity-10" src={heroCapybara} alt="" aria-hidden="true" />;
}

export function ButtonLink({ to = "home", params, variant = "ghost", icon: Icon, children, className }) {
  return (
    <a className={classNames(buttonClass(variant), className)} href={hrefTo(to, params)}>
      {Icon ? <Icon size={17} /> : null}
      <span>{children}</span>
    </a>
  );
}

export function Button({ variant = "ghost", icon: Icon, children, className, ...props }) {
  return (
    <button className={classNames(buttonClass(variant), className)} type="button" {...props}>
      {Icon ? <Icon size={17} /> : null}
      <span>{children}</span>
    </button>
  );
}

export function buttonClass(variant) {
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

export function Shell({ children, wide = false }) {
  return (
    <main className={classNames("mx-auto min-h-screen pb-10 pt-5 animate-page-in", wide ? "max-w-5xl" : "max-w-[520px]")}>
      <div className="space-y-5">{children}</div>
    </main>
  );
}

export function Topbar({ title = "水豚旅行", subtitle = "Capybara Trip", children }) {
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

export function Eyebrow({ children }) {
  return <span className="text-xs font-extrabold uppercase tracking-[0.18em] text-accent">{children}</span>;
}

export function Badge({ children, tone = "default" }) {
  return (
    <span className={classNames(
      "inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-extrabold",
      tone === "alert" ? "bg-red-100 text-red-700" : tone === "dark" ? "bg-ink text-white" : "bg-card text-ink"
    )}>
      {children}
    </span>
  );
}

export function Panel({ children, className }) {
  return <section className={classNames("rounded-3xl border border-white/60 bg-paper/90 p-5 shadow-capybara-warm ring-1 ring-white/60", className)}>{children}</section>;
}

export function Metric({ label, value }) {
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

export function Message({ message }) {
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

export function Field({ label, hint, action, children }) {
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

export function inputClass() {
  return "min-h-12 w-full rounded-2xl border border-line bg-white/75 px-4 py-3 text-base font-bold text-ink outline-none transition placeholder:text-muted/65 focus:border-accent focus:bg-white focus:ring-4 focus:ring-accent/15";
}

export function ProgressBar({ width, alert }) {
  return (
    <div className="h-3 overflow-hidden rounded-full bg-card">
      <div className={classNames("h-full rounded-full transition-all", alert ? "bg-red-500" : "bg-accent")} style={{ width }} />
    </div>
  );
}

export function SectionHead({ eyebrow, title, badge }) {
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
