// Client.tsx — Complete UI Rewrite
// Mobile-first bottom tab bar design matching ForgeFit app screenshot

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import Chat from "./Chat";
import AiIntake, { callAi } from "./AiIntake";
import XPBadgeAnimated from "../components/XPBadgeAnimated";

// ── Types ──────────────────────────────────────────────────────────────────────
type Tab = "home" | "diet" | "workout" | "progress" | "profile";

interface ClientData {
  id: string;
  name: string;
  age: number;
  height_cm: number;
  weight_kg: number;
  connection_code: string;
  coach_id: string | null;
  intake_completed?: boolean;
}
interface FoodRef {
  name: string;
  calories_per_serving: number;
  protein_per_serving: number;
  carbs_per_serving: number;
  fat_per_serving: number;
  serving_size: number;
  serving_unit: string;
}
interface MealItem {
  id: string;
  food_id: string;
  quantity: number;
  unit: string;
  food: FoodRef | null;
}
interface Meal {
  id: string;
  meal_name: string;
  meal_number: number;
  display_order: number;
  items: MealItem[];
}
interface WorkoutItem {
  id: string;
  exercise_id: string;
  exercise_name: string;
  muscle_group: string;
  notes: string;
  sets: number;
  reps: number;
  weight_kg: number | null;
}
interface WorkoutLog {
  id?: string;
  client_id: string;
  workout_item_id: string;
  log_date: string;
  actual_sets: number;
  actual_reps: number;
  actual_weight_kg: number | null;
  note: string;
}
interface ProgressEntry {
  id: string;
  date: string;
  diet_progress: number;
  workout_progress: number;
  weight_kg: number | null;
}
interface ClientGoals {
  calories_target: number;
  protein_target: number;
  carbs_target: number;
  fat_target: number;
  show_macros_to_client: boolean;
}
interface WeeklyProgressPhoto {
  id: string;
  client_id: string;
  week_start: string;
  photo_url: string;
  notes: string;
  uploaded_at: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function macroScale(food: FoodRef, qty: number) {
  return qty / (food.serving_size || 1);
}
function fmtDate(d: Date) {
  return d.toISOString().split("T")[0];
}
function todayStr() {
  return fmtDate(new Date());
}
function addDays(ds: string, n: number) {
  const d = new Date(ds + "T00:00:00");
  d.setDate(d.getDate() + n);
  return fmtDate(d);
}
function dayLabel(ds: string) {
  const t = todayStr();
  if (ds === t) return "Today";
  if (ds === addDays(t, 1)) return "Tomorrow";
  if (ds === addDays(t, -1)) return "Yesterday";
  return new Date(ds + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
function pctColor(v: number) {
  if (v >= 80) return "var(--green)";
  if (v >= 50) return "var(--yellow)";
  return "var(--red)";
}
function getWeekStart(ds: string) {
  const d = new Date(ds + "T00:00:00");
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return fmtDate(new Date(d.setDate(diff)));
}
function compressImage(
  file: File,
  maxDim = 1200,
  quality = 0.75
): Promise<Blob> {
  return new Promise((res, rej) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas
        .getContext("2d")!
        .drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (b) => {
          URL.revokeObjectURL(url);
          b ? res(b) : rej(new Error("fail"));
        },
        "image/jpeg",
        quality
      );
    };
    img.onerror = rej;
    img.src = url;
  });
}

// ── XP System ─────────────────────────────────────────────────────────────────
const MAX_RAW = 21024;
function rawToXP(r: number) {
  return Math.min(
    100,
    Math.round(
      100 * Math.pow(Math.min(Math.max(r, 0), MAX_RAW) / MAX_RAW, 0.45) * 10
    ) / 10
  );
}
function calcDailyPts(
  dp: number,
  wp: number,
  hasDiet: boolean,
  hasWorkout: boolean
) {
  let pts = 0;
  if (hasWorkout) pts += wp === 0 ? -3 : Math.round((wp / 100) * 15);
  if (hasDiet) pts += dp === 0 ? -2 : Math.round((dp / 100) * 10);
  return pts;
}
const LEVELS = [
  {
    level: 1,
    name: "Rookie",
    color: "#888780",
    icon: "🌱",
    xs: 0,
    xe: 15,
    tiers: [
      { tier: "Bronze", xn: 0, xx: 5 },
      { tier: "Silver", xn: 5, xx: 10 },
      { tier: "Gold", xn: 10, xx: 15 },
    ],
  },
  {
    level: 2,
    name: "Hustler",
    color: "#7c6af7",
    icon: "💪",
    xs: 15,
    xe: 30,
    tiers: [
      { tier: "Bronze", xn: 15, xx: 20 },
      { tier: "Silver", xn: 20, xx: 25 },
      { tier: "Gold", xn: 25, xx: 30 },
    ],
  },
  {
    level: 3,
    name: "Warrior",
    color: "#1d9e75",
    icon: "⚔️",
    xs: 30,
    xe: 45,
    tiers: [
      { tier: "Bronze", xn: 30, xx: 35 },
      { tier: "Silver", xn: 35, xx: 40 },
      { tier: "Gold", xn: 40, xx: 45 },
    ],
  },
  {
    level: 4,
    name: "Beast",
    color: "#d85a30",
    icon: "🔥",
    xs: 45,
    xe: 60,
    tiers: [
      { tier: "Bronze", xn: 45, xx: 50 },
      { tier: "Silver", xn: 50, xx: 55 },
      { tier: "Gold", xn: 55, xx: 60 },
    ],
  },
  {
    level: 5,
    name: "Titan",
    color: "#d4537e",
    icon: "⚡",
    xs: 60,
    xe: 75,
    tiers: [
      { tier: "Bronze", xn: 60, xx: 65 },
      { tier: "Silver", xn: 65, xx: 70 },
      { tier: "Gold", xn: 70, xx: 75 },
    ],
  },
  {
    level: 6,
    name: "Elite",
    color: "#3b82f6",
    icon: "🏆",
    xs: 75,
    xe: 85,
    tiers: [
      { tier: "Bronze", xn: 75, xx: 79 },
      { tier: "Silver", xn: 79, xx: 82 },
      { tier: "Gold", xn: 82, xx: 85 },
    ],
  },
  {
    level: 7,
    name: "Apex",
    color: "#ba7517",
    icon: "💎",
    xs: 85,
    xe: 95,
    tiers: null,
  },
  {
    level: 8,
    name: "Legend",
    color: "#a32d2d",
    icon: "👑",
    xs: 95,
    xe: 100,
    tiers: null,
  },
] as const;
function resolveLevel(xp: number) {
  let def = LEVELS[0] as any;
  for (const d of LEVELS) {
    if (xp >= d.xs) def = d;
    else break;
  }
  if (!def.tiers) {
    const range = def.xe - def.xs;
    return {
      ...def,
      tier: null,
      displayName: def.name,
      xMin: def.xs,
      xMax: def.xe,
      pct:
        range > 0
          ? Math.min(100, Math.round(((xp - def.xs) / range) * 100))
          : 100,
    };
  }
  let t = def.tiers[0] as any;
  for (const tier of def.tiers) {
    if (xp >= tier.xn) t = tier;
    else break;
  }
  const range = t.xx - t.xn;
  return {
    ...def,
    tier: t.tier,
    displayName: `${def.name} ${t.tier}`,
    xMin: t.xn,
    xMax: t.xx,
    pct:
      range > 0 ? Math.min(100, Math.round(((xp - t.xn) / range) * 100)) : 100,
  };
}
function tierEmoji(tier: string | null) {
  return tier === "Bronze"
    ? "🥉"
    : tier === "Silver"
    ? "🥈"
    : tier === "Gold"
    ? "🥇"
    : "👑";
}

// ── Streak helpers ─────────────────────────────────────────────────────────────
function calcStreak(
  history: ProgressEntry[],
  type: "diet" | "workout" | "both"
) {
  const today = todayStr();
  const active = new Set(
    history
      .filter((p) =>
        type === "diet"
          ? p.diet_progress === 100
          : type === "workout"
          ? p.workout_progress === 100
          : p.diet_progress === 100 && p.workout_progress === 100
      )
      .map((p) => p.date)
  );
  let streak = 0,
    cursor = active.has(today) ? today : addDays(today, -1);
  while (active.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}
function calcMaxStreak(history: ProgressEntry[]) {
  const active = new Set(
    history
      .filter((p) => p.diet_progress === 100 && p.workout_progress === 100)
      .map((p) => p.date)
  );
  if (!active.size) return 0;
  const sorted = [...active].sort();
  let max = 1,
    cur = 1;
  for (let i = 1; i < sorted.length; i++) {
    const diff = Math.round(
      (new Date(sorted[i] + "T00:00:00").getTime() -
        new Date(sorted[i - 1] + "T00:00:00").getTime()) /
        86400000
    );
    if (diff === 1) {
      cur++;
      max = Math.max(max, cur);
    } else cur = 1;
  }
  return max;
}

// ── SVG Progress Ring ──────────────────────────────────────────────────────────
function Ring({
  pct,
  color,
  size = 64,
}: {
  pct: number;
  color: string;
  size?: number;
}) {
  const r = (size - 8) / 2,
    c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--surface2)"
        strokeWidth={6}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={6}
        strokeDasharray={c}
        strokeDashoffset={c - (pct / 100) * c}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 0.6s" }}
      />
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill="currentColor"
        fontSize={size > 56 ? 13 : 10}
        fontWeight={700}
        fontFamily="Outfit,sans-serif"
      >
        {pct}%
      </text>
    </svg>
  );
}

// ── Day Strip ──────────────────────────────────────────────────────────────────
const PAST = 7,
  FUTURE = 6;
function DayStrip({
  selected,
  onChange,
  planDates,
}: {
  selected: string;
  onChange: (d: string) => void;
  planDates: Set<string>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const today = todayStr();
  const days = Array.from({ length: PAST + 1 + FUTURE }, (_, i) =>
    addDays(today, i - PAST)
  );
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const idx = days.indexOf(selected);
    if (idx < 0) return;
    const pw = 66,
      gap = 8;
    el.scrollTo({
      left: Math.max(0, idx * (pw + gap) - el.clientWidth / 2 + pw / 2),
      behavior: "smooth",
    });
  }, [selected]);
  return (
    <div ref={ref} className="day-strip-wrap">
      {days.map((d) => {
        const isSel = d === selected,
          isToday = d === today,
          isFuture = d > today,
          hasPlan = planDates.has(d);
        return (
          <button
            key={d}
            onClick={() => onChange(d)}
            className={`day-pill${isSel ? " active" : ""}${
              isToday && !isSel ? " today" : ""
            }${isFuture ? " future" : ""}`}
          >
            <div className="dp-dow">
              {isToday && !isSel
                ? "Today"
                : new Date(d + "T00:00:00").toLocaleDateString("en-GB", {
                    weekday: "short",
                  })}
            </div>
            <div className="dp-num">{new Date(d + "T00:00:00").getDate()}</div>
            <div className="dp-mon">
              {new Date(d + "T00:00:00").toLocaleDateString("en-GB", {
                month: "short",
              })}
            </div>
            {hasPlan && <span className="dp-dot" />}
            {isFuture && <span className="dp-lock">🔒</span>}
          </button>
        );
      })}
    </div>
  );
}

// ── Macro Row ──────────────────────────────────────────────────────────────────
function MacroRow({
  cal,
  protein,
  carbs,
  fat,
}: {
  cal: number;
  protein: number;
  carbs: number;
  fat: number;
}) {
  return (
    <div className="macro-row">
      {[
        {
          val: Math.round(cal),
          label: "Calories",
          unit: "kcal",
          color: "var(--accent)",
        },
        {
          val: Math.round(protein),
          label: "Protein",
          unit: "g",
          color: "#f87171",
        },
        {
          val: Math.round(carbs),
          label: "Carbs",
          unit: "g",
          color: "var(--yellow)",
        },
        {
          val: Math.round(fat),
          label: "Fat",
          unit: "g",
          color: "var(--accent2)",
        },
      ].map((m) => (
        <div className="macro-cell" key={m.label}>
          <div className="mc-val" style={{ color: m.color }}>
            {m.val}
            <span
              style={{ fontSize: 10, fontWeight: 400, color: "var(--muted)" }}
            >
              {m.unit}
            </span>
          </div>
          <div className="mc-label">{m.label}</div>
        </div>
      ))}
    </div>
  );
}

// ── Macro Rings ────────────────────────────────────────────────────────────────
function MacroRings({
  meals,
  checked,
  goals,
}: {
  meals: Meal[];
  checked: Set<string>;
  goals: ClientGoals;
}) {
  const items = meals.flatMap((m) => m.items.filter((i) => checked.has(i.id)));
  const totCal = items.reduce(
    (s, i) =>
      s +
      (i.food
        ? i.food.calories_per_serving * macroScale(i.food, i.quantity)
        : 0),
    0
  );
  const totP = items.reduce(
    (s, i) =>
      s +
      (i.food
        ? i.food.protein_per_serving * macroScale(i.food, i.quantity)
        : 0),
    0
  );
  const totC = items.reduce(
    (s, i) =>
      s +
      (i.food ? i.food.carbs_per_serving * macroScale(i.food, i.quantity) : 0),
    0
  );
  const totF = items.reduce(
    (s, i) =>
      s +
      (i.food ? i.food.fat_per_serving * macroScale(i.food, i.quantity) : 0),
    0
  );
  const macros = [
    {
      label: "Cal",
      val: Math.round(totCal),
      target: goals.calories_target,
      unit: "kcal",
      color: "#a78bfa",
    },
    {
      label: "Protein",
      val: Math.round(totP),
      target: goals.protein_target,
      unit: "g",
      color: "#f87171",
    },
    {
      label: "Carbs",
      val: Math.round(totC),
      target: goals.carbs_target,
      unit: "g",
      color: "#fbbf24",
    },
    {
      label: "Fat",
      val: Math.round(totF),
      target: goals.fat_target,
      unit: "g",
      color: "#34d399",
    },
  ];
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="card-title">
        <span className="icon">📊</span>Macro Progress
      </div>
      <div className="macro-rings-grid">
        {macros.map((m) => {
          const pct =
            m.target > 0
              ? Math.min(100, Math.round((m.val / m.target) * 100))
              : 0;
          const over = m.val > m.target && m.target > 0;
          return (
            <div
              key={m.label}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Ring pct={pct} color={over ? "var(--red)" : m.color} size={60} />
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: over ? "var(--red)" : m.color,
                  }}
                >
                  {m.val}
                  {m.unit}
                </div>
                <div style={{ fontSize: 10, color: "var(--muted)" }}>
                  {m.label}
                </div>
                <div style={{ fontSize: 9, color: "var(--muted)" }}>
                  / {m.target}
                  {m.unit}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── XP Badge ──────────────────────────────────────────────────────────────────
function XPBadge({ totalRaw }: { totalRaw: number }) {
  const xp = rawToXP(Math.max(0, totalRaw));
  const lvl = resolveLevel(xp);
  const tierColors: Record<string, string> = {
    Bronze: "#c97c3a",
    Silver: "#8a8aaa",
    Gold: "#c9a227",
  };
  const tc = lvl.tier ? tierColors[lvl.tier] : lvl.color;
  return (
    <div
      className="xp-card"
      style={{
        background: `${lvl.color}10`,
        border: `1px solid ${lvl.color}40`,
        color: lvl.color,
      }}
    >
      <div
        className="xp-tier-pill"
        style={{
          background: `${tc}20`,
          color: tc,
          border: `1px solid ${tc}50`,
        }}
      >
        {tierEmoji(lvl.tier)} {lvl.displayName}
      </div>
      <div className="xp-number-row">
        <div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 2 }}>
            Total XP
          </div>
          <div className="xp-number" style={{ color: lvl.color }}>
            {xp.toFixed(1)}
            <span
              style={{ fontSize: 16, color: "var(--muted)", fontWeight: 400 }}
            >
              {" "}
              / 100
            </span>
          </div>
        </div>
        <div style={{ fontSize: 32 }}>{lvl.icon}</div>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 11,
          color: "var(--muted)",
          marginBottom: 6,
        }}
      >
        <span>{lvl.xMin} XP</span>
        <span style={{ color: lvl.color, fontWeight: 700 }}>{lvl.pct}%</span>
        <span>{lvl.xMax} XP</span>
      </div>
      <div className="xp-bar-wrap">
        <div
          className="xp-bar-fill"
          style={{
            width: `${lvl.pct}%`,
            background: `linear-gradient(90deg, ${lvl.color}99, ${lvl.color})`,
          }}
        />
      </div>
      {xp < 100 ? (
        <div className="xp-next">
          {(lvl.xMax - xp).toFixed(1)} XP to{" "}
          {resolveLevel(lvl.xMax).displayName}
        </div>
      ) : (
        <div className="xp-next" style={{ color: lvl.color }}>
          👑 Maximum rank — Legend
        </div>
      )}
      <div className="xp-level-row">
        {LEVELS.map((d) => {
          const isActive = lvl.level === d.level,
            isPast = lvl.level > d.level;
          return (
            <div
              key={d.level}
              className="xp-level-dot"
              style={{
                background: isActive
                  ? d.color
                  : isPast
                  ? `${d.color}30`
                  : "var(--surface2)",
                border: isActive
                  ? `2px solid ${d.color}`
                  : "2px solid transparent",
                opacity: isPast ? 0.6 : isActive ? 1 : 0.3,
              }}
            >
              {d.icon}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Heatmap ────────────────────────────────────────────────────────────────────
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
function Heatmap({
  history,
  year,
  type,
}: {
  history: ProgressEntry[];
  year: number;
  type: "diet" | "workout" | "both";
}) {
  const today = todayStr();
  const byDate: Record<string, ProgressEntry> = {};
  history.forEach((p) => {
    byDate[p.date] = p;
  });
  const ys = new Date(year, 0, 1),
    ye = new Date(year, 11, 31);
  const allDays: string[] = [];
  const cur = new Date(ys);
  while (cur <= ye) {
    allDays.push(fmtDate(cur));
    cur.setDate(cur.getDate() + 1);
  }
  const firstDow = ys.getDay();
  const padded: (string | null)[] = [...Array(firstDow).fill(null), ...allDays];
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < padded.length; i += 7) weeks.push(padded.slice(i, i + 7));
  const getPct = (d: string | null) => {
    if (!d) return -1;
    const p = byDate[d];
    if (!p) return 0;
    if (type === "diet") return p.diet_progress;
    if (type === "workout") return p.workout_progress;
    return p.diet_progress === 100 && p.workout_progress === 100 ? 100 : 0;
  };
  const colorFns: Record<string, (p: number) => string> = {
    diet: (p) =>
      p <= 0
        ? "var(--surface2)"
        : p === 100
        ? "#16a34a"
        : p >= 80
        ? "#22c55e"
        : p >= 50
        ? "#4ade80"
        : "#bbf7d020",
    workout: (p) =>
      p <= 0
        ? "var(--surface2)"
        : p === 100
        ? "#1d4ed8"
        : p >= 80
        ? "#3b82f6"
        : p >= 50
        ? "#60a5fa"
        : "#bfdbfe20",
    both: (p) => (p < 100 ? "var(--surface2)" : "#f97316"),
  };
  const cellColor = (d: string | null) => {
    if (!d || d > today) return "var(--surface2)";
    return colorFns[type](getPct(d));
  };
  const CELL = 12,
    GAP = 2,
    colW = CELL + GAP,
    rowH = CELL + GAP;
  const svgW = weeks.length * colW + 28,
    svgH = 7 * rowH + 20;
  const monthLabels: { x: number; label: string }[] = [];
  let lastM = -1;
  weeks.forEach((week, wi) => {
    const fd = week.find((d) => d !== null);
    if (fd) {
      const m = new Date(fd + "T00:00:00").getMonth();
      if (m !== lastM) {
        monthLabels.push({ x: wi * colW, label: MONTHS[m] });
        lastM = m;
      }
    }
  });
  const active = allDays.filter(
    (d) => d <= today && getPct(d) >= (type === "both" ? 100 : 80)
  ).length;
  const total = allDays.filter((d) => d <= today).length;
  return (
    <div className="heatmap-section">
      <div className="heatmap-header">
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text2)" }}>
          {type === "diet"
            ? "🥗 Diet"
            : type === "workout"
            ? "🏋️ Workout"
            : "⚡ Both"}
        </span>
        <span style={{ fontSize: 11, color: "var(--muted)" }}>
          {active}/{total} days
        </span>
      </div>
      <div style={{ overflowX: "auto", paddingBottom: 2 }}>
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          style={{ height: svgH, minWidth: svgW, display: "block" }}
        >
          {monthLabels.map((ml) => (
            <text
              key={ml.label + ml.x}
              x={ml.x + 16}
              y={9}
              fontSize={7}
              fill="var(--muted)"
              fontFamily="Outfit,sans-serif"
            >
              {ml.label}
            </text>
          ))}
          {["S", "M", "T", "W", "T", "F", "S"].map((l, i) => (
            <text
              key={i}
              x={7}
              y={13 + i * rowH + CELL * 0.7}
              fontSize={6}
              fill="var(--muted)"
              fontFamily="sans-serif"
              textAnchor="middle"
            >
              {l}
            </text>
          ))}
          {weeks.map((week, wi) =>
            week.map((d, di) => (
              <rect
                key={`${wi}-${di}`}
                x={16 + wi * colW}
                y={11 + di * rowH}
                width={CELL}
                height={CELL}
                rx={2}
                fill={cellColor(d)}
                opacity={d && d > today ? 0.12 : 1}
              />
            ))
          )}
        </svg>
      </div>
    </div>
  );
}

// ── Workout Card ───────────────────────────────────────────────────────────────
function WorkoutCard({
  item,
  idx,
  done,
  prevLog,
  isFuture,
  onTick,
  onSaveLog,
}: {
  item: WorkoutItem;
  idx: number;
  done: boolean;
  prevLog: WorkoutLog | null;
  isFuture: boolean;
  onTick: () => void;
  onSaveLog: (log: Partial<WorkoutLog>) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState({
    sets: String(item.sets),
    reps: String(item.reps),
    weight: item.weight_kg ? String(item.weight_kg) : "",
    note: "",
  });
  const [saving, setSaving] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdFired = useRef(false);
  useEffect(() => {
    if (prevLog)
      setForm({
        sets: String(prevLog.actual_sets),
        reps: String(prevLog.actual_reps),
        weight: prevLog.actual_weight_kg
          ? String(prevLog.actual_weight_kg)
          : "",
        note: prevLog.note || "",
      });
  }, [prevLog]);
  function down() {
    holdFired.current = false;
    holdTimer.current = setTimeout(() => {
      holdFired.current = true;
      if (!isFuture) setExpanded((e) => !e);
    }, 500);
  }
  function up() {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    if (!holdFired.current && !isFuture) onTick();
  }
  async function save() {
    setSaving(true);
    await onSaveLog({
      actual_sets: parseInt(form.sets) || item.sets,
      actual_reps: parseInt(form.reps) || item.reps,
      actual_weight_kg: form.weight ? parseFloat(form.weight) : null,
      note: form.note,
    });
    setSaving(false);
    setExpanded(false);
  }
  return (
    <div className={`workout-card${done ? " done-card" : ""}`}>
      <div
        className="workout-card-row"
        onPointerDown={down}
        onPointerUp={up}
        onPointerCancel={() =>
          holdTimer.current && clearTimeout(holdTimer.current)
        }
        style={{
          cursor: isFuture ? "default" : "pointer",
          opacity: isFuture ? 0.6 : 1,
        }}
      >
        <div className={`workout-num${done ? " done" : ""}`}>
          {done ? "✓" : idx + 1}
        </div>
        <div className="workout-info">
          <div className={`workout-name${done ? " struck" : ""}`}>
            {item.exercise_name}
          </div>
          <div className="workout-meta">
            {item.sets}×{item.reps}
            {item.weight_kg ? ` · ${item.weight_kg}kg` : ""}
            {item.muscle_group ? ` · ${item.muscle_group}` : ""}
          </div>
          {item.notes && (
            <div
              style={{
                fontSize: 11,
                color: "var(--muted)",
                fontStyle: "italic",
                marginTop: 2,
              }}
            >
              {item.notes}
            </div>
          )}
          {prevLog && (
            <div className="prev-log-chip">
              📈 Last: {prevLog.actual_sets}×{prevLog.actual_reps}
              {prevLog.actual_weight_kg
                ? ` @ ${prevLog.actual_weight_kg}kg`
                : ""}
            </div>
          )}
        </div>
        <div style={{ flexShrink: 0, textAlign: "center" }}>
          {done && (
            <div className="badge badge-green" style={{ fontSize: 10 }}>
              ✓ Done
            </div>
          )}
          {!isFuture && (
            <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 3 }}>
              hold to log
            </div>
          )}
        </div>
      </div>
      {expanded && !isFuture && (
        <div className="workout-log-panel">
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "var(--accent)",
              marginBottom: 12,
            }}
          >
            📝 Log Performance
          </div>
          <div className="log-grid">
            {[
              { label: "Sets", key: "sets", ph: String(item.sets) },
              { label: "Reps", key: "reps", ph: String(item.reps) },
              {
                label: "Weight kg",
                key: "weight",
                ph: item.weight_kg ? String(item.weight_kg) : "—",
              },
            ].map((f) => (
              <div key={f.key}>
                <label className="ff-label">{f.label}</label>
                <input
                  className="ff-input ff-input-sm"
                  type="number"
                  min="0"
                  step="any"
                  placeholder={f.ph}
                  value={(form as any)[f.key]}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, [f.key]: e.target.value }))
                  }
                />
              </div>
            ))}
          </div>
          <div style={{ marginBottom: 12 }}>
            <label className="ff-label">Note</label>
            <input
              className="ff-input ff-input-sm"
              placeholder="Felt strong today…"
              value={form.note}
              onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
            />
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => setExpanded(false)}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={save}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save Log"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function Client() {
  const nav = useNavigate();
  const clientId = localStorage.getItem("client_id") || "";
  const showCodeLS = localStorage.getItem("show_code") || "";

  const [tab, setTab] = useState<Tab>("diet");
  const [client, setClient] = useState<ClientData | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [planDates, setPlanDates] = useState<Set<string>>(new Set());
  const [meals, setMeals] = useState<Meal[]>([]);
  const [checkedMeals, setCheckedMeals] = useState<Set<string>>(new Set());
  const [workoutItems, setWorkoutItems] = useState<WorkoutItem[]>([]);
  const [checkedWorkout, setCheckedWorkout] = useState<Set<string>>(new Set());
  const [loadingDay, setLoadingDay] = useState(false);
  const [progressHistory, setProgressHistory] = useState<ProgressEntry[]>([]);
  const [weightInput, setWeightInput] = useState("");
  const [savingWeight, setSavingWeight] = useState(false);
  const [showCodeBanner, setShowCodeBanner] = useState(!!showCodeLS);
  const [clientGoals, setClientGoals] = useState<ClientGoals | null>(null);
  const [prevWorkoutLogs, setPrevWorkoutLogs] = useState<
    Record<string, WorkoutLog>
  >({});
  const [todayWorkoutLogs, setTodayWorkoutLogs] = useState<
    Record<string, WorkoutLog>
  >({});
  const [coachName, setCoachName] = useState("Coach");
  const [chatOpen, setChatOpen] = useState(false);
  const [showIntake, setShowIntake] = useState(false);
  const [weeklyPhotos, setWeeklyPhotos] = useState<WeeklyProgressPhoto[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [weeklyNote, setWeeklyNote] = useState("");
  const [photosExpanded, setPhotosExpanded] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [heatYear, setHeatYear] = useState(new Date().getFullYear());

  useEffect(() => {
    if (!clientId) {
      nav("/");
      return;
    }
    init();
  }, [clientId]);

  async function init() {
    setLoading(true);
    const { data: c } = await supabase
      .from("clients")
      .select("*")
      .eq("id", clientId)
      .single();
    setClient(c);
    if (c && !c.intake_completed) setShowIntake(true);
    if (c) {
      await Promise.all([
        loadAllPlanDates(clientId),
        loadDayPlan(clientId, todayStr()),
        loadProgressHistory(clientId),
        loadClientGoals(clientId),
        loadCoachName(c),
        loadWeeklyPhotos(clientId),
      ]);
    }
    setLoading(false);
    if (c?.intake_completed) ensureWeek(c.id);
  }

  // Ask the AI to create this week's plan if it doesn't exist yet
  async function ensureWeek(cid: string) {
    try {
      const r = await callAi({ action: "ensure_week", today: todayStr() });
      if (r?.generated) {
        await Promise.all([
          loadAllPlanDates(cid),
          loadDayPlan(cid, todayStr()),
          loadClientGoals(cid),
        ]);
      }
    } catch (e) {
      console.error("ensure_week failed", e);
    }
  }

  async function loadCoachName(c: ClientData) {
    if (!c.coach_id) return;
    const { data } = await supabase
      .from("coaches")
      .select("name")
      .eq("id", c.coach_id)
      .single();
    if (data?.name) setCoachName(data.name);
  }
  async function loadWeeklyPhotos(cid: string) {
    const { data } = await supabase
      .from("weekly_progress_photos")
      .select("*")
      .eq("client_id", cid)
      .order("week_start", { ascending: false });
    setWeeklyPhotos(data || []);
  }
  async function loadClientGoals(cid: string) {
    const { data } = await supabase
      .from("client_goals")
      .select("*")
      .eq("client_id", cid)
      .maybeSingle();
    if (data) setClientGoals(data);
  }
  async function loadAllPlanDates(cid: string) {
    const [{ data: pd }, { data: wpd }] = await Promise.all([
      supabase.from("plan_days").select("plan_date").eq("client_id", cid),
      supabase
        .from("workout_plan_days")
        .select("plan_date")
        .eq("client_id", cid),
    ]);
    const dates = new Set<string>();
    (pd || []).forEach((r: any) => dates.add(r.plan_date));
    (wpd || []).forEach((r: any) => dates.add(r.plan_date));
    setPlanDates(dates);
  }
  async function loadDayPlan(cid: string, date: string) {
    setLoadingDay(true);
    const [{ data: pd }, { data: mealComps }] = await Promise.all([
      supabase
        .from("plan_days")
        .select("*, meals(*, meal_items(*, foods(*)))")
        .eq("client_id", cid)
        .eq("plan_date", date)
        .maybeSingle(),
      supabase
        .from("meal_completions")
        .select("meal_item_id")
        .eq("client_id", cid)
        .eq("completed_date", date),
    ]);
    if (pd?.meals) {
      const sorted = [...pd.meals].sort(
        (a: any, b: any) => a.display_order - b.display_order
      );
      setMeals(
        sorted.map((m: any) => ({
          id: m.id,
          meal_name: m.meal_name,
          meal_number: m.meal_number,
          display_order: m.display_order,
          items: (m.meal_items || []).map((i: any) => ({
            id: i.id,
            food_id: i.food_id,
            quantity: i.quantity,
            unit: i.unit,
            food: i.foods || null,
          })),
        }))
      );
    } else setMeals([]);
    setCheckedMeals(new Set((mealComps || []).map((r: any) => r.meal_item_id)));
    const [{ data: wpd }, { data: workoutComps }] = await Promise.all([
      supabase
        .from("workout_plan_days")
        .select("*, workout_day_items(*, exercises(*))")
        .eq("client_id", cid)
        .eq("plan_date", date)
        .maybeSingle(),
      supabase
        .from("workout_completions")
        .select("workout_item_id")
        .eq("client_id", cid)
        .eq("completed_date", date),
    ]);
    if (wpd?.workout_day_items) {
      const sorted = [...wpd.workout_day_items].sort(
        (a: any, b: any) => a.display_order - b.display_order
      );
      const items: WorkoutItem[] = sorted.map((i: any) => ({
        id: i.id,
        exercise_id: i.exercise_id,
        exercise_name: i.exercises?.name || "Unknown",
        muscle_group: i.exercises?.muscle_group || "",
        notes: i.exercises?.notes || "",
        sets: i.sets,
        reps: i.reps,
        weight_kg: i.weight_kg,
      }));
      setWorkoutItems(items);
      await loadWorkoutLogs(
        cid,
        items.map((i) => i.id),
        date
      );
    } else {
      setWorkoutItems([]);
      setPrevWorkoutLogs({});
      setTodayWorkoutLogs({});
    }
    setCheckedWorkout(
      new Set((workoutComps || []).map((r: any) => r.workout_item_id))
    );
    setLoadingDay(false);
  }
  async function loadWorkoutLogs(cid: string, ids: string[], date: string) {
    if (!ids.length) return;
    const { data } = await supabase
      .from("workout_logs")
      .select("*")
      .eq("client_id", cid)
      .in("workout_item_id", ids)
      .order("log_date", { ascending: false });
    const prev: Record<string, WorkoutLog> = {},
      today: Record<string, WorkoutLog> = {};
    (data || []).forEach((log: WorkoutLog) => {
      if (log.log_date === date) {
        if (!today[log.workout_item_id]) today[log.workout_item_id] = log;
      } else {
        if (!prev[log.workout_item_id]) prev[log.workout_item_id] = log;
      }
    });
    setPrevWorkoutLogs(prev);
    setTodayWorkoutLogs(today);
  }
  async function loadProgressHistory(cid: string) {
    const { data } = await supabase
      .from("progress_entries")
      .select("*")
      .eq("client_id", cid)
      .order("date", { ascending: false })
      .limit(365);
    setProgressHistory(data || []);
  }

  function calcDietPct(cm: Set<string>, ms: Meal[]) {
    const ids = ms.flatMap((m) => m.items.map((i) => i.id));
    return ids.length
      ? Math.round((ids.filter((id) => cm.has(id)).length / ids.length) * 100)
      : 0;
  }
  function calcWorkoutPct(cw: Set<string>, wi: WorkoutItem[]) {
    return wi.length
      ? Math.round((wi.filter((i) => cw.has(i.id)).length / wi.length) * 100)
      : 0;
  }
  async function persistMealTick(next: Set<string>) {
    const date = selectedDate;
    await supabase
      .from("meal_completions")
      .delete()
      .eq("client_id", clientId)
      .eq("completed_date", date);
    if (next.size > 0)
      await supabase.from("meal_completions").insert(
        [...next].map((id) => ({
          client_id: clientId,
          meal_item_id: id,
          completed_date: date,
        }))
      );
    const dp = calcDietPct(next, meals),
      wp = calcWorkoutPct(checkedWorkout, workoutItems);
    const ew = progressHistory.find((p) => p.date === date)?.weight_kg ?? null;
    await supabase.from("progress_entries").upsert(
      {
        client_id: clientId,
        date,
        diet_progress: dp,
        workout_progress: wp,
        weight_kg: ew,
      },
      { onConflict: "client_id,date" }
    );
    await loadProgressHistory(clientId);
  }
  async function persistWorkoutTick(next: Set<string>) {
    const date = selectedDate;
    await supabase
      .from("workout_completions")
      .delete()
      .eq("client_id", clientId)
      .eq("completed_date", date);
    if (next.size > 0)
      await supabase.from("workout_completions").insert(
        [...next].map((id) => ({
          client_id: clientId,
          workout_item_id: id,
          completed_date: date,
        }))
      );
    const dp = calcDietPct(checkedMeals, meals),
      wp = calcWorkoutPct(next, workoutItems);
    const ew = progressHistory.find((p) => p.date === date)?.weight_kg ?? null;
    await supabase.from("progress_entries").upsert(
      {
        client_id: clientId,
        date,
        diet_progress: dp,
        workout_progress: wp,
        weight_kg: ew,
      },
      { onConflict: "client_id,date" }
    );
    await loadProgressHistory(clientId);
  }
  function toggleMeal(id: string) {
    setCheckedMeals((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      persistMealTick(next);
      return next;
    });
  }
  function toggleWorkout(id: string) {
    setCheckedWorkout((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      persistWorkoutTick(next);
      return next;
    });
  }
  async function handleSaveWorkoutLog(
    itemId: string,
    logData: Partial<WorkoutLog>
  ) {
    const existing = todayWorkoutLogs[itemId];
    const payload = {
      client_id: clientId,
      workout_item_id: itemId,
      log_date: selectedDate,
      actual_sets: logData.actual_sets ?? 0,
      actual_reps: logData.actual_reps ?? 0,
      actual_weight_kg: logData.actual_weight_kg ?? null,
      note: logData.note ?? "",
    };
    if (existing?.id)
      await supabase.from("workout_logs").update(payload).eq("id", existing.id);
    else await supabase.from("workout_logs").insert(payload);
    setCheckedWorkout((prev) => {
      const next = new Set(prev);
      if (!next.has(itemId)) {
        next.add(itemId);
        persistWorkoutTick(next);
      }
      return next;
    });
    await loadWorkoutLogs(
      clientId,
      workoutItems.map((i) => i.id),
      selectedDate
    );
    flash("Workout logged! 💪");
  }
  async function handleWeeklyPhotoUpload(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const compressed = await compressImage(file);
      const weekStart = getWeekStart(todayStr());
      const path = `${clientId}/${weekStart}.jpg`;
      await supabase.storage.from("progress-photos").remove([path]);
      const { error: upErr } = await supabase.storage
        .from("progress-photos")
        .upload(path, compressed, { contentType: "image/jpeg", upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage
        .from("progress-photos")
        .getPublicUrl(path);
      await supabase.from("weekly_progress_photos").upsert(
        {
          client_id: clientId,
          week_start: weekStart,
          photo_url: urlData.publicUrl,
          notes: weeklyNote,
        },
        { onConflict: "client_id,week_start" }
      );
      setWeeklyNote("");
      await loadWeeklyPhotos(clientId);
      flash("Photo uploaded! 📸");
    } catch {
      flash("Upload failed. Try again.");
    }
    setUploadingPhoto(false);
    if (photoInputRef.current) photoInputRef.current.value = "";
  }
  async function saveWeight() {
    if (!weightInput) return;
    setSavingWeight(true);
    await supabase.from("progress_entries").upsert(
      {
        client_id: clientId,
        date: selectedDate,
        diet_progress: dietPct,
        workout_progress: workoutPct,
        weight_kg: parseFloat(weightInput),
      },
      { onConflict: "client_id,date" }
    );
    await loadProgressHistory(clientId);
    setWeightInput("");
    flash("Weight logged!");
    setSavingWeight(false);
  }
  function flash(m: string) {
    setMsg(m);
    setTimeout(() => setMsg(""), 3000);
  }
  function handleLogout() {
    localStorage.clear();
    supabase.auth.signOut();
    nav("/");
  }
  async function handleDayChange(date: string) {
    setSelectedDate(date);
    await loadDayPlan(clientId, date);
  }

  const dietPct = calcDietPct(checkedMeals, meals);
  const workoutPct = calcWorkoutPct(checkedWorkout, workoutItems);
  const totalRaw = progressHistory.reduce(
    (acc, p) =>
      acc +
      calcDailyPts(
        p.diet_progress,
        p.workout_progress,
        p.diet_progress > 0 || planDates.has(p.date),
        p.workout_progress > 0 || planDates.has(p.date)
      ),
    0
  );
  const bothStreak = calcStreak(progressHistory, "both");
  const maxStreak = calcMaxStreak(progressHistory);
  const allMealIds = meals.flatMap((m) => m.items.map((i) => i.id));
  const thisWeekStart = getWeekStart(todayStr());
  const thisWeekPhoto = weeklyPhotos.find(
    (p) => p.week_start === thisWeekStart
  );
  const pastPhotos = weeklyPhotos.filter((p) => p.week_start !== thisWeekStart);
  const isFuture = selectedDate > todayStr();
  const latestWeight = progressHistory.find((p) => p.weight_kg)?.weight_kg;
  const currentYear = new Date().getFullYear();
  const years = [
    ...new Set([
      ...progressHistory.map((p) => parseInt(p.date.slice(0, 4))),
      currentYear,
    ]),
  ].sort((a, b) => b - a);

  if (loading)
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
        }}
      >
        <div className="spinner" />
      </div>
    );

  const initials =
    client?.name
      ?.split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?";

  return (
    <div className="app-shell">
      {/* Top Bar */}
      <header className="top-bar">
        <div className="top-bar-logo">
          Forge<span>Fit</span>
        </div>
        <div className="top-bar-actions">
          {client?.coach_id && (
            <button
              className="icon-btn"
              onClick={() => setChatOpen(true)}
              title="Chat with coach"
            >
              💬
            </button>
          )}
          <button className="avatar-btn" onClick={handleLogout} title="Logout">
            {initials}
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="app-main page-enter">
        {msg && <div className="alert alert-success">{msg}</div>}
        {showCodeBanner && (
          <div
            className="alert alert-info"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontSize: 12, marginBottom: 2 }}>
                Your connection code
              </div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 22,
                  fontWeight: 700,
                  letterSpacing: "0.25em",
                }}
              >
                {showCodeLS}
              </div>
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                localStorage.removeItem("show_code");
                setShowCodeBanner(false);
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* ── HOME TAB ── */}
        {tab === "home" && (
          <div className="page-enter">
            <div style={{ paddingTop: 8 }}>
              <h2 style={{ fontSize: 24, fontWeight: 900, marginBottom: 2 }}>
                Hey, {client?.name?.split(" ")[0]} 👋
              </h2>
              <p style={{ color: "var(--text2)", fontSize: 13 }}>
                {dayLabel(todayStr())}
              </p>
            </div>
            <div style={{ height: 14 }} />
            {progressHistory.length > 0 && (
              <div className="streak-banner">
                <div className="streak-left">
                  <div className="streak-flame">🔥</div>
                  <div>
                    <div className="streak-count">{bothStreak}</div>
                    <div className="streak-label">day streak</div>
                  </div>
                </div>
                <div className="streak-right">
                  <div className="streak-best">Best: {maxStreak} days</div>
                  {(() => {
                    const xp = rawToXP(Math.max(0, totalRaw));
                    const lvl = resolveLevel(xp);
                    return (
                      <div className="streak-badge">
                        {lvl.icon} {lvl.displayName}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
            <div className="stats-grid" style={{ marginTop: 14 }}>
              {[
                {
                  label: "Diet Today",
                  val: `${dietPct}%`,
                  color: pctColor(dietPct),
                },
                {
                  label: "Workout Today",
                  val: `${workoutPct}%`,
                  color: pctColor(workoutPct),
                },
                {
                  label: "Current Weight",
                  val: latestWeight ? `${latestWeight} kg` : "—",
                  color: "var(--text)",
                },
                {
                  label: "Days Logged",
                  val: String(progressHistory.length),
                  color: "var(--accent)",
                },
              ].map((s) => (
                <div key={s.label} className="stat-card">
                  <div className="sv" style={{ color: s.color }}>
                    {s.val}
                  </div>
                  <div className="sl">{s.label}</div>
                </div>
              ))}
            </div>
            {meals.length > 0 && (
              <div className="card" style={{ marginTop: 14 }}>
                <div className="card-title">
                  <span className="icon">🥗</span>Today's Diet
                </div>
                <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                  <Ring pct={dietPct} color={pctColor(dietPct)} size={68} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>
                      {checkedMeals.size} / {allMealIds.length} items done
                    </div>
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${dietPct}%`,
                          background: pctColor(dietPct),
                        }}
                      />
                    </div>
                    <button
                      className="btn btn-outline btn-sm btn-full"
                      style={{ marginTop: 10 }}
                      onClick={() => setTab("diet")}
                    >
                      Open Diet Plan →
                    </button>
                  </div>
                </div>
              </div>
            )}
            {workoutItems.length > 0 && (
              <div className="card" style={{ marginTop: 12 }}>
                <div className="card-title">
                  <span className="icon">🏋️</span>Today's Workout
                </div>
                <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                  <Ring
                    pct={workoutPct}
                    color={pctColor(workoutPct)}
                    size={68}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>
                      {checkedWorkout.size} / {workoutItems.length} exercises
                      done
                    </div>
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${workoutPct}%`,
                          background: pctColor(workoutPct),
                        }}
                      />
                    </div>
                    <button
                      className="btn btn-outline btn-sm btn-full"
                      style={{ marginTop: 10 }}
                      onClick={() => setTab("workout")}
                    >
                      Open Workout →
                    </button>
                  </div>
                </div>
              </div>
            )}
            {!client?.coach_id && (
              <div className="card" style={{ marginTop: 14 }}>
                <div className="card-title">
                  <span className="icon">🔗</span>Connect a Coach
                </div>
                <p
                  style={{
                    fontSize: 13,
                    color: "var(--text2)",
                    marginBottom: 12,
                  }}
                >
                  Share this code with your coach.
                </p>
                <div className="code-box">
                  <div className="code-text">{client?.connection_code}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── DIET TAB ── */}
        {tab === "diet" && (
          <div className="page-enter">
            <div className="section-head">
              <div>
                <h2>Diet Plan</h2>
                <p>Tap to check off · swipe for other days</p>
              </div>
              {client?.coach_id && (
                <button className="icon-btn" onClick={() => setChatOpen(true)}>
                  💬
                </button>
              )}
            </div>
            <DayStrip
              selected={selectedDate}
              onChange={handleDayChange}
              planDates={planDates}
            />
            {loadingDay ? (
              <div className="spinner" />
            ) : meals.length === 0 ? (
              <div className="empty-state">
                <div className="es-icon">🍽️</div>
                <div className="es-title">
                  {isFuture ? "No plan yet" : "No diet plan today"}
                </div>
                <div className="es-sub">
                  {isFuture
                    ? "Check back when the day arrives."
                    : "Your coach will set up your plan."}
                </div>
              </div>
            ) : (
              <>
                {isFuture && (
                  <div className="alert alert-info">
                    🔒 Preview mode — ticking unlocks when the day arrives.
                  </div>
                )}
                {!isFuture &&
                  clientGoals?.show_macros_to_client &&
                  clientGoals.calories_target > 0 && (
                    <MacroRings
                      meals={meals}
                      checked={checkedMeals}
                      goals={clientGoals}
                    />
                  )}
                {!isFuture && (
                  <div className="progress-ring-wrap">
                    <Ring pct={dietPct} color={pctColor(dietPct)} size={72} />
                    <div className="ring-info">
                      <div className="ri-label">Diet Progress</div>
                      <div
                        className="ri-count"
                        style={{ color: pctColor(dietPct) }}
                      >
                        {checkedMeals.size}/{allMealIds.length} items
                      </div>
                      <div className="ri-bar">
                        <div
                          className="ri-fill"
                          style={{
                            width: `${dietPct}%`,
                            background: pctColor(dietPct),
                          }}
                        />
                      </div>
                      <div className="ri-day">{dayLabel(selectedDate)}</div>
                    </div>
                  </div>
                )}
                {meals.map((meal) => {
                  const ids = meal.items.map((i) => i.id);
                  const done = ids.filter((id) => checkedMeals.has(id)).length;
                  const pct = ids.length
                    ? Math.round((done / ids.length) * 100)
                    : 0;
                  const allDone = done === ids.length && ids.length > 0;
                  const totCal = meal.items.reduce(
                    (s, i) =>
                      s +
                      (i.food
                        ? Math.round(
                            i.food.calories_per_serving *
                              macroScale(i.food, i.quantity)
                          )
                        : 0),
                    0
                  );
                  return (
                    <div key={meal.id} className="meal-card">
                      <div className="meal-header">
                        <div className="meal-header-left">
                          <div className={`meal-num${allDone ? " done" : ""}`}>
                            {allDone ? "✓" : meal.meal_number}
                          </div>
                          <div>
                            <div className="meal-name-text">
                              {meal.meal_name}
                            </div>
                            <div className="meal-sub">
                              {done}/{ids.length} items · {totCal} kcal
                            </div>
                          </div>
                        </div>
                        <div className="meal-pct-badge">
                          <div className="pct-bar">
                            <div
                              className="pct-fill"
                              style={{
                                width: `${pct}%`,
                                background: pctColor(pct),
                              }}
                            />
                          </div>
                          <div
                            className="pct-text"
                            style={{ color: pctColor(pct) }}
                          >
                            {pct}%
                          </div>
                        </div>
                      </div>
                      {meal.items.map((item) => {
                        const done = checkedMeals.has(item.id);
                        const scale = item.food
                          ? macroScale(item.food, item.quantity)
                          : 0;
                        const kcal = item.food
                          ? Math.round(item.food.calories_per_serving * scale)
                          : 0;
                        return (
                          <div
                            key={item.id}
                            className={`meal-item-row${
                              done ? " done-row" : ""
                            }`}
                            onClick={() => !isFuture && toggleMeal(item.id)}
                            style={{
                              opacity: isFuture ? 0.65 : 1,
                              cursor: isFuture ? "default" : "pointer",
                            }}
                          >
                            <div
                              className={`check-box${done ? " checked" : ""}`}
                            >
                              {done && (
                                <span className="check-box-icon">✓</span>
                              )}
                            </div>
                            <div className="meal-item-info">
                              <div
                                className={`meal-item-name${
                                  done ? " struck" : ""
                                }`}
                              >
                                {item.food?.name || "Unknown"}
                              </div>
                              <div className="meal-item-qty">
                                {item.quantity} {item.unit}
                              </div>
                            </div>
                            <div className="meal-item-kcal">{kcal} kcal</div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
                {meals.length > 0 &&
                  (() => {
                    const allItems = meals.flatMap((m) => m.items);
                    const totCal = allItems.reduce(
                      (s, i) =>
                        s +
                        (i.food
                          ? i.food.calories_per_serving *
                            macroScale(i.food, i.quantity)
                          : 0),
                      0
                    );
                    const totP = allItems.reduce(
                      (s, i) =>
                        s +
                        (i.food
                          ? i.food.protein_per_serving *
                            macroScale(i.food, i.quantity)
                          : 0),
                      0
                    );
                    const totC = allItems.reduce(
                      (s, i) =>
                        s +
                        (i.food
                          ? i.food.carbs_per_serving *
                            macroScale(i.food, i.quantity)
                          : 0),
                      0
                    );
                    const totF = allItems.reduce(
                      (s, i) =>
                        s +
                        (i.food
                          ? i.food.fat_per_serving *
                            macroScale(i.food, i.quantity)
                          : 0),
                      0
                    );
                    return (
                      <MacroRow
                        cal={totCal}
                        protein={totP}
                        carbs={totC}
                        fat={totF}
                      />
                    );
                  })()}
              </>
            )}
          </div>
        )}

        {/* ── WORKOUT TAB ── */}
        {tab === "workout" && (
          <div className="page-enter">
            <div className="section-head">
              <div>
                <h2>Workout</h2>
                <p>Tap done · hold to log sets/reps</p>
              </div>
            </div>
            <DayStrip
              selected={selectedDate}
              onChange={handleDayChange}
              planDates={planDates}
            />
            {loadingDay ? (
              <div className="spinner" />
            ) : workoutItems.length === 0 ? (
              <div className="empty-state">
                <div className="es-icon">🏋️</div>
                <div className="es-title">No workout today</div>
                <div className="es-sub">
                  {isFuture
                    ? "No plan set yet."
                    : "Your coach will assign exercises."}
                </div>
              </div>
            ) : (
              <>
                {isFuture && (
                  <div className="alert alert-info">
                    🔒 Preview — ticking unlocks when the day arrives.
                  </div>
                )}
                {!isFuture && (
                  <div className="progress-ring-wrap">
                    <Ring
                      pct={workoutPct}
                      color={pctColor(workoutPct)}
                      size={72}
                    />
                    <div className="ring-info">
                      <div className="ri-label">Workout Progress</div>
                      <div
                        className="ri-count"
                        style={{ color: pctColor(workoutPct) }}
                      >
                        {checkedWorkout.size}/{workoutItems.length} exercises
                      </div>
                      <div className="ri-bar">
                        <div
                          className="ri-fill"
                          style={{
                            width: `${workoutPct}%`,
                            background: pctColor(workoutPct),
                          }}
                        />
                      </div>
                      <div className="ri-day">{dayLabel(selectedDate)}</div>
                    </div>
                  </div>
                )}
                {workoutItems.map((item, idx) => (
                  <WorkoutCard
                    key={item.id}
                    item={item}
                    idx={idx}
                    done={checkedWorkout.has(item.id)}
                    prevLog={prevWorkoutLogs[item.id] || null}
                    isFuture={isFuture}
                    onTick={() => toggleWorkout(item.id)}
                    onSaveLog={(log) => handleSaveWorkoutLog(item.id, log)}
                  />
                ))}
              </>
            )}
          </div>
        )}

        {/* ── PROGRESS TAB ── */}
        {tab === "progress" && (
          <div className="page-enter">
            <div className="section-head">
              <div>
                <h2>Progress</h2>
                <p>Your stats over time</p>
              </div>
            </div>
            <XPBadgeAnimated totalRaw={Math.max(0, totalRaw)} />
            {progressHistory.length > 0 && (
              <div className="streak-banner" style={{ marginBottom: 14 }}>
                <div className="streak-left">
                  <div className="streak-flame">🔥</div>
                  <div>
                    <div className="streak-count">{bothStreak}</div>
                    <div className="streak-label">day streak</div>
                  </div>
                </div>
                <div className="streak-right">
                  <div className="streak-best">Best: {maxStreak} days</div>
                  <div className="streak-badge">
                    🏆{" "}
                    {maxStreak === bothStreak && maxStreak > 0
                      ? "ON FIRE!"
                      : "Keep going"}
                  </div>
                </div>
              </div>
            )}
            <div className="stats-grid">
              {[
                {
                  label: "Start Weight",
                  val: client?.weight_kg ? `${client.weight_kg} kg` : "—",
                  color: "var(--text)",
                },
                {
                  label: "Latest Weight",
                  val: latestWeight ? `${latestWeight} kg` : "—",
                  color: "var(--text)",
                },
                {
                  label: "Height",
                  val: client?.height_cm ? `${client.height_cm} cm` : "—",
                  color: "var(--text)",
                },
                {
                  label: "Days Logged",
                  val: String(progressHistory.length),
                  color: "var(--accent)",
                },
              ].map((s) => (
                <div key={s.label} className="stat-card">
                  <div className="sv" style={{ color: s.color }}>
                    {s.val}
                  </div>
                  <div className="sl">{s.label}</div>
                </div>
              ))}
            </div>
            {/* Weight log */}
            <div className="card" style={{ marginBottom: 14 }}>
              <div className="card-title">
                <span className="icon">⚖️</span>Log Weight
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <input
                  className="ff-input"
                  type="number"
                  step="0.1"
                  placeholder="e.g. 75.5 kg"
                  value={weightInput}
                  onChange={(e) => setWeightInput(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button
                  className="btn btn-primary"
                  onClick={saveWeight}
                  disabled={savingWeight || !weightInput}
                >
                  {savingWeight ? "…" : "Log"}
                </button>
              </div>
            </div>
            {/* Heatmaps */}
            <div className="card" style={{ marginBottom: 14 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 14,
                }}
              >
                <div className="card-title" style={{ marginBottom: 0 }}>
                  <span className="icon">📅</span>Activity
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  {years.map((y) => (
                    <button
                      key={y}
                      onClick={() => setHeatYear(y)}
                      className={`btn btn-xs${
                        y === heatYear ? " btn-primary" : " btn-outline"
                      }`}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              </div>
              {(["diet", "workout", "both"] as const).map((t) => (
                <Heatmap
                  key={t}
                  history={progressHistory}
                  year={heatYear}
                  type={t}
                />
              ))}
            </div>
            {/* Weekly Photo */}
            <div className="card" style={{ marginBottom: 14 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 12,
                }}
              >
                <div className="card-title" style={{ marginBottom: 0 }}>
                  <span className="icon">📸</span>Weekly Photo
                </div>
                {thisWeekPhoto && (
                  <div className="badge badge-green">✓ Done</div>
                )}
              </div>
              {thisWeekPhoto ? (
                <div
                  style={{
                    borderRadius: 12,
                    overflow: "hidden",
                    marginBottom: 12,
                  }}
                >
                  <img
                    src={thisWeekPhoto.photo_url}
                    alt="This week"
                    style={{
                      width: "100%",
                      maxHeight: 260,
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                </div>
              ) : (
                <div
                  style={{
                    border: "2px dashed var(--border2)",
                    borderRadius: 12,
                    padding: "28px 20px",
                    textAlign: "center",
                    marginBottom: 12,
                    color: "var(--muted)",
                  }}
                >
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📷</div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    No photo this week
                  </div>
                </div>
              )}
              <input
                className="ff-input"
                placeholder="Add a note (optional)"
                value={weeklyNote}
                onChange={(e) => setWeeklyNote(e.target.value)}
                style={{ marginBottom: 10 }}
              />
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: "none" }}
                onChange={handleWeeklyPhotoUpload}
              />
              <button
                className="btn btn-primary btn-full"
                onClick={() => photoInputRef.current?.click()}
                disabled={uploadingPhoto}
              >
                {uploadingPhoto
                  ? "Uploading…"
                  : thisWeekPhoto
                  ? "📸 Replace Photo"
                  : "📸 Upload This Week's Photo"}
              </button>
              {pastPhotos.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <button
                    onClick={() => setPhotosExpanded((p) => !p)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--accent)",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 600,
                      padding: 0,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    {photosExpanded ? "▼" : "▶"} Past photos (
                    {pastPhotos.length})
                  </button>
                  {photosExpanded && (
                    <div className="photo-grid" style={{ marginTop: 10 }}>
                      {pastPhotos.map((p) => (
                        <div key={p.id} className="photo-card">
                          <img
                            src={p.photo_url}
                            alt=""
                            onClick={() => window.open(p.photo_url, "_blank")}
                          />
                          <div className="photo-card-meta">
                            Week of{" "}
                            {new Date(
                              p.week_start + "T00:00:00"
                            ).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* History table */}
            {progressHistory.length > 0 && (
              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <table className="ff-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Diet</th>
                      <th>Workout</th>
                      <th>Weight</th>
                      <th>Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {progressHistory.slice(0, 30).map((p) => {
                      const pts = calcDailyPts(
                        p.diet_progress,
                        p.workout_progress,
                        p.diet_progress > 0 || planDates.has(p.date),
                        p.workout_progress > 0 || planDates.has(p.date)
                      );
                      return (
                        <tr key={p.id}>
                          <td style={{ fontSize: 12 }}>
                            {new Date(p.date + "T00:00:00").toLocaleDateString(
                              "en-GB",
                              { day: "numeric", month: "short" }
                            )}
                          </td>
                          <td>
                            <span
                              style={{
                                color: pctColor(p.diet_progress),
                                fontWeight: 700,
                                fontSize: 13,
                              }}
                            >
                              {p.diet_progress}%
                            </span>
                          </td>
                          <td>
                            <span
                              style={{
                                color: pctColor(p.workout_progress),
                                fontWeight: 700,
                                fontSize: 13,
                              }}
                            >
                              {p.workout_progress}%
                            </span>
                          </td>
                          <td style={{ fontSize: 12 }}>
                            {p.weight_kg ? (
                              `${p.weight_kg} kg`
                            ) : (
                              <span style={{ color: "var(--muted)" }}>—</span>
                            )}
                          </td>
                          <td
                            style={{
                              fontWeight: 700,
                              fontSize: 12,
                              color: pts >= 0 ? "var(--green)" : "var(--red)",
                            }}
                          >
                            {pts >= 0 ? `+${pts}` : pts}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── PROFILE TAB ── */}
        {tab === "profile" && (
          <div className="page-enter">
            <div className="section-head">
              <div>
                <h2>Profile</h2>
                <p>Your account settings</p>
              </div>
            </div>
            <div
              className="card"
              style={{ textAlign: "center", padding: 32, marginBottom: 14 }}
            >
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, var(--accent), #a855f7)",
                  color: "#fff",
                  fontSize: 26,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 12px",
                }}
              >
                {initials}
              </div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>
                {client?.name}
              </div>
              <div
                style={{ color: "var(--text2)", fontSize: 13, marginTop: 4 }}
              >
                Age {client?.age} · {client?.height_cm} cm · {client?.weight_kg}{" "}
                kg
              </div>
            </div>
            {client?.coach_id && (
              <div className="card" style={{ marginBottom: 14 }}>
                <div className="card-title">
                  <span className="icon">👨‍💼</span>Coach
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{coachName}</div>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => setChatOpen(true)}
                  >
                    💬 Chat
                  </button>
                </div>
              </div>
            )}
            {!client?.coach_id && (
              <div className="card" style={{ marginBottom: 14 }}>
                <div className="card-title">
                  <span className="icon">🔗</span>Connect Coach
                </div>
                <p
                  style={{
                    fontSize: 13,
                    color: "var(--text2)",
                    marginBottom: 12,
                  }}
                >
                  Share this code with your coach.
                </p>
                <div className="code-box">
                  <div className="code-text">{client?.connection_code}</div>
                </div>
              </div>
            )}
            <button className="btn btn-danger btn-full" onClick={handleLogout}>
              ⎋ Log Out
            </button>
          </div>
        )}
      </main>

      {/* Bottom Tab Bar */}
      <nav className="bottom-bar">
        {(
          [
            { id: "home", icon: "🏠", label: "Home" },
            { id: "diet", icon: "🥗", label: "Diet" },
            { id: "workout", icon: "🏋️", label: "Workout" },
            { id: "progress", icon: "📊", label: "Progress" },
            { id: "profile", icon: "👤", label: "Profile" },
          ] as { id: Tab; icon: string; label: string }[]
        ).map((t) => (
          <button
            key={t.id}
            className={`tab-btn${tab === t.id ? " active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            <span className="tab-icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      {showIntake && (
        <AiIntake
          today={todayStr()}
          onSkip={() => setShowIntake(false)}
          onDone={() => {
            setShowIntake(false);
            init();
          }}
        />
      )}

      {/* Chat */}
      {chatOpen && client?.coach_id && (
        <Chat
          clientId={clientId}
          coachId={client.coach_id}
          senderType="client"
          peerName={coachName}
          onClose={() => setChatOpen(false)}
        />
      )}
    </div>
  );
}