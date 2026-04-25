import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import html2canvas from "html2canvas";
import { ArrowLeft } from "lucide-react";
import { classNames, EmptyWatermark, MoneyText } from "../components/ui";
import { displayCategory, formatCurrency, getTripTitle } from "../lib/travel";
import { downloadCanvasAsPng, imageDateStamp, isWeChatBrowser } from "../lib/capture";

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

export default function TripSummaryView({ trip, onClose }) {
  const captureRef = useRef(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureMessage, setCaptureMessage] = useState("");
  const [previewImage, setPreviewImage] = useState("");
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

  async function captureMemoryCard() {
    if (!captureRef.current || isCapturing) return;
    setIsCapturing(true);
    setCaptureMessage("正在生成专属海报...");
    setPreviewImage("");
    try {
      const element = captureRef.current;
      const canvas = await html2canvas(element, {
        useCORS: true,
        logging: false,
        backgroundColor: "#FDFBF7",
        scale: Math.min(2, window.devicePixelRatio || 1),
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight
      });
      if (isWeChatBrowser()) {
        setPreviewImage(canvas.toDataURL("image/png"));
        setCaptureMessage("图片已生成，可长按保存。");
      } else {
        await downloadCanvasAsPng(canvas, `shuitun-memory-${imageDateStamp()}.png`);
        setCaptureMessage("旅行回忆卡片已生成。");
      }
    } catch {
      setCaptureMessage("图片生成失败，请稍后再试。");
    } finally {
      setIsCapturing(false);
    }
  }

  return (
    <motion.section className="fixed inset-0 z-50 bg-[#FDFBF7] text-ink" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.42, ease: "easeOut" }}>
      <header className="fixed inset-x-0 top-0 z-10 flex h-16 items-center justify-center border-b border-line/60 bg-[#FDFBF7]/95 px-5 backdrop-blur">
        <button className="absolute left-5 inline-flex min-h-10 items-center gap-2 rounded-2xl px-2 text-sm font-extrabold text-ink transition-all duration-200 active:scale-[0.97]" type="button" onClick={onClose}>
          <ArrowLeft size={18} />
          <span>返回</span>
        </button>
        <h1 className="max-w-[50%] truncate text-base font-extrabold">{getTripTitle(trip)}复盘</h1>
      </header>

      <div className="h-full overflow-y-auto px-5 pb-28 pt-24">
        <div id="capture-area" ref={captureRef} className="mx-auto max-w-[520px] space-y-5 bg-[#FDFBF7] pb-10">
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

        {previewImage ? (
          <div className="mx-auto mt-5 max-w-[520px] rounded-3xl border border-white/60 bg-white p-4 shadow-capybara-warm">
            <p className="mb-3 text-sm font-bold text-muted">微信内可长按下方图片保存。</p>
            <img className="w-full rounded-2xl" src={previewImage} alt="旅行回忆卡片预览" />
          </div>
        ) : null}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line/50 bg-[#FDFBF7]/95 px-5 py-4 backdrop-blur">
        <div className="mx-auto max-w-[520px] space-y-2">
          <button className={classNames("inline-flex w-full min-h-12 items-center justify-center rounded-2xl bg-amber-500 px-4 py-3 text-sm font-extrabold text-white shadow-lg shadow-orange-500/30 transition-all duration-200 active:scale-[0.97]", isCapturing && "opacity-70")} type="button" disabled={isCapturing} onClick={captureMemoryCard}>
            {isCapturing ? "正在生成专属海报..." : "📸 保存旅行回忆卡片"}
          </button>
          {captureMessage ? <p className="text-center text-xs font-bold text-muted">{captureMessage}</p> : null}
        </div>
      </div>
    </motion.section>
  );
}
