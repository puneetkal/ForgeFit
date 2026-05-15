// Client.tsx — mobile-first with hamburger sidebar + XP Level System

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";

// ── Types ──────────────────────────────────────────────────────────────────────
type Tab = "diet" | "workout" | "dashboard";

interface ClientData {
  id: string;
  name: string;
  age: number;
  height_cm: number;
  weight_kg: number;
  connection_code: string;
  coach_id: string | null;
}

interface FoodRef {
  name: string;
  calories_per_100g: number;
  protein_g_per_100g: number;
  carbs_g_per_100g: number;
  fat_g_per_100g: number;
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

interface ProgressEntry {
  id: string;
  date: string;
  diet_progress: number;
  workout_progress: number;
  weight_kg: number | null;
}

// ── XP SYSTEM ─────────────────────────────────────────────────────────────────
// Daily points:
//   Workout 100% = +15 pts (pro-rata for partial, -3 if skipped with plan)
//   Diet 100%    = +10 pts (pro-rata for partial, -2 if skipped with plan)
//
// XP curve: rawPts mapped to 0–100 via a ^0.45 exponent
//   Max raw pts over 4 years of ~80% consistency ≈ 21,024
//   The curve makes early XP fast, later XP brutally slow (PUBG-style)
//
// 8 Levels: Rookie → Hustler → Warrior → Beast → Titan → Elite → Apex → Legend
//   Levels 1–6 have Bronze / Silver / Gold sub-tiers (every 5 XP)
//   Apex and Legend have no sub-tiers

const MAX_RAW_PTS = 21024;

function rawPtsToXP(rawPts: number): number {
  if (rawPts <= 0) return 0;
  const clamped = Math.min(rawPts, MAX_RAW_PTS);
  const xp = 100 * Math.pow(clamped / MAX_RAW_PTS, 0.45);
  return Math.min(100, Math.round(xp * 10) / 10);
}

function calcDailyPts(
  dietPct: number,
  workoutPct: number,
  hasDietPlan: boolean,
  hasWorkoutPlan: boolean
): number {
  let pts = 0;
  if (hasWorkoutPlan) {
    if (workoutPct === 0) pts -= 3;
    else pts += Math.round((workoutPct / 100) * 15);
  }
  if (hasDietPlan) {
    if (dietPct === 0) pts -= 2;
    else pts += Math.round((dietPct / 100) * 10);
  }
  return pts;
}

interface LevelTier {
  tier: string;
  xpMin: number;
  xpMax: number;
}

interface LevelDef {
  level: number;
  name: string;
  color: string;
  icon: string;
  xpStart: number;
  xpEnd: number;
  tiers: LevelTier[] | null;
}

const LEVEL_DEFS: LevelDef[] = [
  {
    level: 1,
    name: "Rookie",
    color: "#888780",
    icon: "🌱",
    xpStart: 0,
    xpEnd: 15,
    tiers: [
      { tier: "Bronze", xpMin: 0, xpMax: 5 },
      { tier: "Silver", xpMin: 5, xpMax: 10 },
      { tier: "Gold", xpMin: 10, xpMax: 15 },
    ],
  },
  {
    level: 2,
    name: "Hustler",
    color: "#7c6af7",
    icon: "💪",
    xpStart: 15,
    xpEnd: 30,
    tiers: [
      { tier: "Bronze", xpMin: 15, xpMax: 20 },
      { tier: "Silver", xpMin: 20, xpMax: 25 },
      { tier: "Gold", xpMin: 25, xpMax: 30 },
    ],
  },
  {
    level: 3,
    name: "Warrior",
    color: "#1d9e75",
    icon: "⚔️",
    xpStart: 30,
    xpEnd: 45,
    tiers: [
      { tier: "Bronze", xpMin: 30, xpMax: 35 },
      { tier: "Silver", xpMin: 35, xpMax: 40 },
      { tier: "Gold", xpMin: 40, xpMax: 45 },
    ],
  },
  {
    level: 4,
    name: "Beast",
    color: "#d85a30",
    icon: "🔥",
    xpStart: 45,
    xpEnd: 60,
    tiers: [
      { tier: "Bronze", xpMin: 45, xpMax: 50 },
      { tier: "Silver", xpMin: 50, xpMax: 55 },
      { tier: "Gold", xpMin: 55, xpMax: 60 },
    ],
  },
  {
    level: 5,
    name: "Titan",
    color: "#d4537e",
    icon: "⚡",
    xpStart: 60,
    xpEnd: 75,
    tiers: [
      { tier: "Bronze", xpMin: 60, xpMax: 65 },
      { tier: "Silver", xpMin: 65, xpMax: 70 },
      { tier: "Gold", xpMin: 70, xpMax: 75 },
    ],
  },
  {
    level: 6,
    name: "Elite",
    color: "#3b82f6",
    icon: "🏆",
    xpStart: 75,
    xpEnd: 85,
    tiers: [
      { tier: "Bronze", xpMin: 75, xpMax: 79 },
      { tier: "Silver", xpMin: 79, xpMax: 82 },
      { tier: "Gold", xpMin: 82, xpMax: 85 },
    ],
  },
  {
    level: 7,
    name: "Apex",
    color: "#ba7517",
    icon: "💎",
    xpStart: 85,
    xpEnd: 95,
    tiers: null,
  },
  {
    level: 8,
    name: "Legend",
    color: "#a32d2d",
    icon: "👑",
    xpStart: 95,
    xpEnd: 100,
    tiers: null,
  },
];

interface ResolvedLevel {
  level: number;
  name: string;
  tier: string | null;
  displayName: string;
  color: string;
  icon: string;
  xpMin: number;
  xpMax: number;
  progressPct: number;
}

function resolveLevel(xp: number): ResolvedLevel {
  let activeDef: LevelDef = LEVEL_DEFS[0];
  for (const def of LEVEL_DEFS) {
    if (xp >= def.xpStart) activeDef = def;
    else break;
  }

  if (!activeDef.tiers) {
    const range = activeDef.xpEnd - activeDef.xpStart;
    const progressPct =
      range > 0
        ? Math.min(100, Math.round(((xp - activeDef.xpStart) / range) * 100))
        : 100;
    return {
      level: activeDef.level,
      name: activeDef.name,
      tier: null,
      displayName: activeDef.name,
      color: activeDef.color,
      icon: activeDef.icon,
      xpMin: activeDef.xpStart,
      xpMax: activeDef.xpEnd,
      progressPct,
    };
  }

  let activeTier = activeDef.tiers[0];
  for (const t of activeDef.tiers) {
    if (xp >= t.xpMin) activeTier = t;
    else break;
  }

  const tRange = activeTier.xpMax - activeTier.xpMin;
  const progressPct =
    tRange > 0
      ? Math.min(100, Math.round(((xp - activeTier.xpMin) / tRange) * 100))
      : 100;

  return {
    level: activeDef.level,
    name: activeDef.name,
    tier: activeTier.tier,
    displayName: `${activeDef.name} ${activeTier.tier}`,
    color: activeDef.color,
    icon: activeDef.icon,
    xpMin: activeTier.xpMin,
    xpMax: activeTier.xpMax,
    progressPct,
  };
}

function tierEmoji(tier: string | null): string {
  if (tier === "Bronze") return "🥉";
  if (tier === "Silver") return "🥈";
  if (tier === "Gold") return "🥇";
  return "👑";
}

// ── XP Badge Component ─────────────────────────────────────────────────────────
function XPBadge({ totalRawPts }: { totalRawPts: number }) {
  const xp = rawPtsToXP(Math.max(0, totalRawPts));
  const lvl = resolveLevel(xp);

  // next milestone label
  let nextLabel = "";
  let nextXpNeeded = 0;
  if (xp < 100) {
    const nextXP = lvl.xpMax;
    nextXpNeeded = Math.max(0, Math.round((nextXP - xp) * 10) / 10);
    const nextLvl = resolveLevel(nextXP);
    nextLabel = nextLvl.displayName;
  }

  const tierBgMap: Record<string, string> = {
    Bronze: "rgba(201,124,58,0.15)",
    Silver: "rgba(138,138,170,0.15)",
    Gold: "rgba(201,162,39,0.15)",
  };
  const tierColorMap: Record<string, string> = {
    Bronze: "#c97c3a",
    Silver: "#8a8aaa",
    Gold: "#c9a227",
  };
  const tierBg = lvl.tier ? tierBgMap[lvl.tier] : `${lvl.color}18`;
  const tierColor = lvl.tier ? tierColorMap[lvl.tier] : lvl.color;

  return (
    <div
      style={{
        background: `${lvl.color}0d`,
        border: `1px solid ${lvl.color}50`,
        borderRadius: 14,
        padding: "1rem",
        marginBottom: "1.5rem",
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "0.85rem",
          flexWrap: "wrap",
          gap: "0.5rem",
        }}
      >
        {/* Rank badge pill */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            background: tierBg,
            border: `1px solid ${tierColor}60`,
            borderRadius: 99,
            padding: "0.3rem 0.85rem",
            fontSize: 14,
            fontWeight: 700,
            fontFamily: "Syne, sans-serif",
            color: tierColor,
            letterSpacing: "0.01em",
          }}
        >
          {tierEmoji(lvl.tier)} {lvl.displayName}
        </div>

        {/* XP number */}
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 1 }}>
            Total XP
          </div>
          <div
            style={{
              fontFamily: "Syne, sans-serif",
              fontWeight: 800,
              fontSize: 20,
              color: lvl.color,
              lineHeight: 1,
            }}
          >
            {xp.toFixed(1)}
            <span
              style={{
                fontSize: 12,
                fontWeight: 400,
                color: "var(--muted)",
                marginLeft: 2,
              }}
            >
              / 100
            </span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: "0.5rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 11,
            color: "var(--muted)",
            marginBottom: 5,
          }}
        >
          <span>{lvl.xpMin} XP</span>
          <span style={{ fontWeight: 600, color: lvl.color }}>
            {lvl.progressPct}%
          </span>
          <span>{lvl.xpMax} XP</span>
        </div>
        <div
          style={{
            height: 10,
            borderRadius: 999,
            background: "var(--surface2)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${lvl.progressPct}%`,
              background: `linear-gradient(90deg, ${lvl.color}bb, ${lvl.color})`,
              borderRadius: 999,
              transition: "width 0.7s cubic-bezier(0.34,1.56,0.64,1)",
            }}
          />
        </div>
      </div>

      {/* Next milestone */}
      {xp < 100 ? (
        <div style={{ fontSize: 12, color: "var(--muted)" }}>
          <span style={{ color: lvl.color, fontWeight: 700 }}>
            {nextXpNeeded} XP
          </span>{" "}
          away from{" "}
          <span style={{ fontWeight: 600, color: "var(--text)" }}>
            {nextLabel}
          </span>
        </div>
      ) : (
        <div style={{ fontSize: 13, fontWeight: 700, color: lvl.color }}>
          👑 Maximum rank achieved — you are a Legend
        </div>
      )}

      {/* Level map mini row */}
      <div
        style={{
          display: "flex",
          gap: 4,
          marginTop: "0.85rem",
          paddingTop: "0.75rem",
          borderTop: "1px solid var(--border)",
          overflowX: "auto",
        }}
      >
        {LEVEL_DEFS.map((def) => {
          const isActive = lvl.level === def.level;
          const isPast = lvl.level > def.level;
          return (
            <div
              key={def.level}
              title={def.name}
              style={{
                flexShrink: 0,
                width: 28,
                height: 28,
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                background: isActive
                  ? def.color
                  : isPast
                  ? `${def.color}30`
                  : "var(--surface2)",
                border: isActive
                  ? `2px solid ${def.color}`
                  : "2px solid transparent",
                opacity: isPast ? 0.6 : isActive ? 1 : 0.35,
                transition: "all 0.2s",
              }}
            >
              {def.icon}
            </div>
          );
        })}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 9,
          color: "var(--muted)",
          marginTop: 3,
          paddingRight: 2,
        }}
      >
        <span>Rookie</span>
        <span>Legend</span>
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtDate(d: Date) {
  return d.toISOString().split("T")[0];
}
function todayStr() {
  return fmtDate(new Date());
}
function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return fmtDate(d);
}
function dayLabel(dateStr: string) {
  const today = todayStr();
  const tmrw = addDays(today, 1);
  const yest = addDays(today, -1);
  if (dateStr === today) return "Today";
  if (dateStr === tmrw) return "Tomorrow";
  if (dateStr === yest) return "Yesterday";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
function pctColor(v: number) {
  if (v >= 80) return "var(--green)";
  if (v >= 50) return "#facc15";
  return "var(--red)";
}

// ── Streak helpers ─────────────────────────────────────────────────────────────
function calcStreak(
  history: ProgressEntry[],
  type: "diet" | "workout" | "both"
): number {
  const today = todayStr();
  const active = new Set(
    history
      .filter((p) => {
        if (type === "diet") return p.diet_progress === 100;
        if (type === "workout") return p.workout_progress === 100;
        return p.diet_progress === 100 && p.workout_progress === 100;
      })
      .map((p) => p.date)
  );
  let streak = 0;
  let cursor = active.has(today) ? today : addDays(today, -1);
  while (active.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

function calcMaxStreak(
  history: ProgressEntry[],
  type: "diet" | "workout" | "both"
): number {
  const active = new Set(
    history
      .filter((p) => {
        if (type === "diet") return p.diet_progress === 100;
        if (type === "workout") return p.workout_progress === 100;
        return p.diet_progress === 100 && p.workout_progress === 100;
      })
      .map((p) => p.date)
  );
  if (active.size === 0) return 0;
  const sortedDates = [...active].sort();
  let maxStreak = 1;
  let currentStreak = 1;
  for (let i = 1; i < sortedDates.length; i++) {
    const prev = new Date(sortedDates[i - 1] + "T00:00:00");
    const curr = new Date(sortedDates[i] + "T00:00:00");
    const diffDays = Math.round(
      (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diffDays === 1) {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 1;
    }
  }
  return maxStreak;
}

// ── Streak Banner ──────────────────────────────────────────────────────────────
function StreakBanner({ history }: { history: ProgressEntry[] }) {
  const bothStreak = calcStreak(history, "both");
  const maxStreak = calcMaxStreak(history, "both");
  const dietStreak = calcStreak(history, "diet");
  const workoutStreak = calcStreak(history, "workout");
  const color = "#f97316";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        padding: "0.75rem 1rem",
        borderRadius: 12,
        background: `${color}18`,
        border: `1px solid ${color}40`,
      }}
    >
      <style>{`
        @keyframes ff-flame { 0%,100%{transform:scale(1) rotate(-3deg)} 50%{transform:scale(1.18) rotate(3deg)} }
        .ff-flame { animation: ff-flame 0.9s ease-in-out infinite; display:inline-block; }
      `}</style>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.6rem",
          flexWrap: "wrap",
        }}
      >
        <span className="ff-flame" style={{ fontSize: 22 }}>
          🔥
        </span>
        <span
          style={{
            fontSize: 20,
            fontFamily: "Syne,sans-serif",
            fontWeight: 800,
            color,
          }}
        >
          {bothStreak}
        </span>
        <span style={{ color: "var(--muted)", fontWeight: 500, fontSize: 13 }}>
          day streak (diet + workout 100%)
        </span>
        <div
          style={{
            display: "flex",
            gap: "0.4rem",
            marginLeft: "auto",
            flexWrap: "wrap",
          }}
        >
          {dietStreak > 0 && (
            <span
              style={{
                fontSize: 11,
                background: "#22c55e20",
                color: "#22c55e",
                padding: "2px 8px",
                borderRadius: 20,
                fontWeight: 700,
              }}
            >
              🥗 {dietStreak}d
            </span>
          )}
          {workoutStreak > 0 && (
            <span
              style={{
                fontSize: 11,
                background: "#3b82f620",
                color: "#3b82f6",
                padding: "2px 8px",
                borderRadius: 20,
                fontWeight: 700,
              }}
            >
              🏋️ {workoutStreak}d
            </span>
          )}
          {bothStreak > 0 && (
            <span
              style={{
                fontSize: 11,
                background: "#f9731620",
                color: "#f97316",
                padding: "2px 8px",
                borderRadius: 20,
                fontWeight: 700,
              }}
            >
              ⚡ {bothStreak}d
            </span>
          )}
        </div>
      </div>
      {maxStreak > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            fontSize: 12,
            color: "var(--muted)",
          }}
        >
          <span style={{ fontSize: 14 }}>🏆</span>
          <span>
            Max streak:{" "}
            <strong style={{ color, fontFamily: "Syne, sans-serif" }}>
              {maxStreak} day{maxStreak !== 1 ? "s" : ""}
            </strong>
          </span>
          {bothStreak === maxStreak && maxStreak > 0 && (
            <span
              style={{
                fontSize: 10,
                background: `${color}20`,
                color,
                padding: "1px 6px",
                borderRadius: 10,
                fontWeight: 700,
              }}
            >
              ON FIRE 🔥
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Year Heatmaps ──────────────────────────────────────────────────────────────
const MONTH_NAMES = [
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
type HeatmapType = "diet" | "workout" | "both";

interface HeatmapConfig {
  type: HeatmapType;
  label: string;
  emoji: string;
  colorFn: (pct: number) => string;
}

const HEATMAP_CONFIGS: HeatmapConfig[] = [
  {
    type: "diet",
    label: "Diet Completion",
    emoji: "🥗",
    colorFn: (pct) => {
      if (pct <= 0) return "var(--surface2)";
      if (pct === 100) return "#16a34a";
      if (pct >= 80) return "#22c55e";
      if (pct >= 50) return "#4ade80";
      return "#bbf7d0";
    },
  },
  {
    type: "workout",
    label: "Workout Completion",
    emoji: "🏋️",
    colorFn: (pct) => {
      if (pct <= 0) return "var(--surface2)";
      if (pct === 100) return "#1d4ed8";
      if (pct >= 80) return "#3b82f6";
      if (pct >= 50) return "#60a5fa";
      return "#bfdbfe";
    },
  },
  {
    type: "both",
    label: "Full Streak (Both 100%)",
    emoji: "⚡",
    colorFn: (pct) => (pct < 100 ? "var(--surface2)" : "#f97316"),
  },
];

function SingleYearHeatmap({
  history,
  year,
  config,
}: {
  history: ProgressEntry[];
  year: number;
  config: HeatmapConfig;
}) {
  const today = todayStr();
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);
  const byDate: Record<string, ProgressEntry> = {};
  history.forEach((p) => {
    byDate[p.date] = p;
  });

  const allDays: string[] = [];
  const cursor = new Date(yearStart);
  while (cursor <= yearEnd) {
    allDays.push(fmtDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  const firstDow = yearStart.getDay();
  const paddedDays: (string | null)[] = [
    ...Array(firstDow).fill(null),
    ...allDays,
  ];
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < paddedDays.length; i += 7)
    weeks.push(paddedDays.slice(i, i + 7));

  function getPct(d: string | null): number {
    if (!d) return -1;
    const p = byDate[d];
    if (!p) return 0;
    if (config.type === "diet") return p.diet_progress;
    if (config.type === "workout") return p.workout_progress;
    return p.diet_progress === 100 && p.workout_progress === 100 ? 100 : 0;
  }

  function cellColor(d: string | null): string {
    if (!d || d > today) return "var(--surface2)";
    return config.colorFn(getPct(d));
  }

  const CELL = 13,
    GAP = 2;
  const colW = CELL + GAP,
    rowH = CELL + GAP;
  const svgW = weeks.length * colW + 30;
  const svgH = 7 * rowH + 22;

  const monthLabels: { x: number; label: string }[] = [];
  let lastMonth = -1;
  weeks.forEach((week, wi) => {
    const firstDay = week.find((d) => d !== null);
    if (firstDay) {
      const m = new Date(firstDay + "T00:00:00").getMonth();
      if (m !== lastMonth) {
        monthLabels.push({ x: wi * colW, label: MONTH_NAMES[m] });
        lastMonth = m;
      }
    }
  });

  const DOW_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
  const activeDays = allDays.filter((d) => {
    if (d > today) return false;
    const pct = getPct(d);
    if (config.type === "both") return pct === 100;
    return pct >= 80;
  }).length;
  const totalPastDays = allDays.filter((d) => d <= today).length;

  return (
    <div style={{ marginBottom: "1.25rem" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "0.5rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: 16 }}>{config.emoji}</span>
          <span
            style={{
              fontFamily: "Syne, sans-serif",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            {config.label}
          </span>
        </div>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>
          {activeDays} / {totalPastDays} days
        </span>
      </div>
      <div style={{ overflowX: "auto", paddingBottom: 4 }}>
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          style={{ height: svgH, minWidth: svgW, display: "block" }}
        >
          {monthLabels.map((ml) => (
            <text
              key={ml.label + ml.x}
              x={ml.x + 18}
              y={9}
              fontSize={7}
              fill="var(--muted)"
              fontFamily="sans-serif"
            >
              {ml.label}
            </text>
          ))}
          {DOW_LABELS.map((l, i) => (
            <text
              key={i}
              x={8}
              y={14 + i * rowH + CELL * 0.75}
              fontSize={6}
              fill="var(--muted)"
              fontFamily="sans-serif"
              textAnchor="middle"
            >
              {l}
            </text>
          ))}
          {weeks.map((week, wi) =>
            week.map((d, di) => {
              const x = 18 + wi * colW,
                y = 12 + di * rowH;
              const isFuture = d && d > today;
              return (
                <rect
                  key={`${wi}-${di}`}
                  x={x}
                  y={y}
                  width={CELL}
                  height={CELL}
                  rx={2}
                  ry={2}
                  fill={cellColor(d)}
                  opacity={isFuture ? 0.15 : 1}
                />
              );
            })
          )}
        </svg>
      </div>
      {config.type !== "both" ? (
        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            marginTop: "0.35rem",
            fontSize: 11,
            color: "var(--muted)",
            alignItems: "center",
          }}
        >
          <span>Less</span>
          {[0.1, 0.4, 0.65, 0.85, 1.0].map((v, i) => (
            <span
              key={i}
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: config.colorFn(Math.round(v * 100)),
                display: "inline-block",
              }}
            />
          ))}
          <span>More</span>
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            marginTop: "0.35rem",
            fontSize: 11,
            color: "var(--muted)",
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              background: "var(--surface2)",
              display: "inline-block",
            }}
          />
          <span>Incomplete</span>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              background: "#f97316",
              display: "inline-block",
              marginLeft: 8,
            }}
          />
          <span>Both 100% 🔥</span>
        </div>
      )}
    </div>
  );
}

function YearHeatmapSection({ history }: { history: ProgressEntry[] }) {
  const currentYear = new Date().getFullYear();
  const yearsInHistory = [
    ...new Set(history.map((p) => parseInt(p.date.slice(0, 4)))),
  ];
  const allYears = [...new Set([...yearsInHistory, currentYear])].sort(
    (a, b) => b - a
  );
  const [selectedYear, setSelectedYear] = useState(currentYear);

  return (
    <div className="card" style={{ marginBottom: "1.5rem" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "1rem",
        }}
      >
        <div className="section-title" style={{ margin: 0 }}>
          Activity Heatmaps
        </div>
        <div style={{ display: "flex", gap: "0.35rem" }}>
          {allYears.map((yr) => (
            <button
              key={yr}
              onClick={() => setSelectedYear(yr)}
              style={{
                padding: "3px 10px",
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 700,
                fontFamily: "Syne, sans-serif",
                cursor: "pointer",
                border:
                  selectedYear === yr
                    ? "2px solid var(--accent)"
                    : "2px solid var(--border)",
                background:
                  selectedYear === yr ? "var(--accent)" : "var(--surface2)",
                color: selectedYear === yr ? "#fff" : "var(--muted)",
                transition: "all 0.15s",
              }}
            >
              {yr}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {HEATMAP_CONFIGS.map((cfg) => (
          <SingleYearHeatmap
            key={cfg.type}
            history={history}
            year={selectedYear}
            config={cfg}
          />
        ))}
      </div>
    </div>
  );
}

// ── Hamburger Button ───────────────────────────────────────────────────────────
function HamburgerBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Open menu"
      style={{
        position: "fixed",
        top: 14,
        left: 14,
        zIndex: 98,
        width: 42,
        height: 42,
        borderRadius: 10,
        background: "var(--surface2)",
        border: "1px solid var(--border)",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 5,
        padding: 0,
      }}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 18,
            height: 2,
            background: "#ffffff",
            borderRadius: 1,
            display: "block",
          }}
        />
      ))}
    </button>
  );
}

// ── Weight Chart ───────────────────────────────────────────────────────────────
function WeightChart({ entries }: { entries: ProgressEntry[] }) {
  const data = entries
    .filter((e) => e.weight_kg !== null)
    .map((e) => ({ date: e.date, w: e.weight_kg as number }))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (data.length < 2)
    return (
      <div
        style={{
          textAlign: "center",
          color: "var(--muted)",
          padding: "1.5rem",
          fontSize: 13,
        }}
      >
        Need at least 2 weight entries to show a chart.
      </div>
    );

  const W = 360,
    H = 110;
  const padL = 34,
    padR = 10,
    padT = 10,
    padB = 24;
  const cW = W - padL - padR,
    cH = H - padT - padB;
  const weights = data.map((d) => d.w);
  const minW = Math.min(...weights),
    maxW = Math.max(...weights);
  const range = maxW - minW || 1;
  const xp = (i: number) => padL + (i / Math.max(data.length - 1, 1)) * cW;
  const yp = (w: number) => padT + ((maxW - w) / range) * cH;
  const pts = data.map((d, i) => `${xp(i)},${yp(d.w)}`);
  const fillPts = `${padL},${padT + cH} ${pts.join(" ")} ${xp(
    data.length - 1
  )},${padT + cH}`;
  const gridVals = [minW, (minW + maxW) / 2, maxW];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{
        width: "100%",
        height: "auto",
        maxHeight: 120,
        overflow: "visible",
      }}
    >
      {gridVals.map((w, i) => (
        <g key={i}>
          <line
            x1={padL}
            x2={W - padR}
            y1={yp(w)}
            y2={yp(w)}
            stroke="var(--border)"
            strokeWidth={0.5}
            strokeDasharray="4,4"
          />
          <text
            x={padL - 3}
            y={yp(w) + 3.5}
            fontSize={7}
            fill="var(--muted)"
            textAnchor="end"
          >
            {w.toFixed(1)}
          </text>
        </g>
      ))}
      <polygon points={fillPts} fill="var(--accent)" fillOpacity={0.08} />
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {data.map((d, i) => (
        <circle
          key={i}
          cx={xp(i)}
          cy={yp(d.w)}
          r={3.5}
          fill="var(--accent)"
          stroke="var(--bg,#0d0d18)"
          strokeWidth={1.5}
        />
      ))}
      <text
        x={xp(0)}
        y={H - 5}
        fontSize={7}
        fill="var(--muted)"
        textAnchor="middle"
      >
        {data[0].date.slice(5).replace("-", "/")}
      </text>
      {data.length > 3 && (
        <text
          x={xp(Math.floor(data.length / 2))}
          y={H - 5}
          fontSize={7}
          fill="var(--muted)"
          textAnchor="middle"
        >
          {data[Math.floor(data.length / 2)].date.slice(5).replace("-", "/")}
        </text>
      )}
      <text
        x={xp(data.length - 1)}
        y={H - 5}
        fontSize={7}
        fill="var(--muted)"
        textAnchor="middle"
      >
        {data[data.length - 1].date.slice(5).replace("-", "/")}
      </text>
    </svg>
  );
}

// ── Day Slider ─────────────────────────────────────────────────────────────────
const PAST_DAYS = 7;
const FUTURE_DAYS = 6;

function DayStrip({
  selected,
  onChange,
  planDates,
}: {
  selected: string;
  onChange: (d: string) => void;
  planDates: Set<string>;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const today = todayStr();
  const days = Array.from({ length: PAST_DAYS + 1 + FUTURE_DAYS }, (_, i) =>
    addDays(today, i - PAST_DAYS)
  );

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const idx = days.indexOf(selected);
    if (idx < 0) return;
    const pillW = 80,
      gap = 8;
    const pillCenter = idx * (pillW + gap) + pillW / 2;
    container.scrollTo({
      left: Math.max(0, pillCenter - container.clientWidth / 2),
      behavior: "smooth",
    });
  }, [selected]);

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <div
        ref={scrollRef}
        style={
          {
            display: "flex",
            gap: 8,
            overflowX: "auto",
            paddingBottom: 6,
            scrollbarWidth: "none",
            WebkitOverflowScrolling: "touch",
          } as React.CSSProperties
        }
      >
        {days.map((d) => {
          const isSel = d === selected,
            isToday = d === today,
            isFuture = d > today,
            hasPlan = planDates.has(d);
          return (
            <button
              key={d}
              onClick={() => onChange(d)}
              style={{
                flexShrink: 0,
                width: 80,
                padding: "0.6rem 0.4rem",
                borderRadius: 10,
                cursor: "pointer",
                border: isSel
                  ? "2px solid var(--accent)"
                  : isToday
                  ? "2px solid rgba(124,106,247,0.4)"
                  : "2px solid var(--border)",
                background: isSel ? "var(--accent)" : "var(--surface2)",
                color: isSel ? "#fff" : isFuture ? "var(--muted)" : "inherit",
                fontFamily: "Syne, sans-serif",
                fontWeight: isSel || isToday ? 700 : 400,
                fontSize: 12,
                position: "relative",
                textAlign: "center",
                lineHeight: 1.3,
                opacity: isFuture ? 0.65 : 1,
                transition: "all 0.15s",
              }}
            >
              <div style={{ fontSize: 11, marginBottom: 2 }}>
                {isToday && !isSel
                  ? "Today"
                  : new Date(d + "T00:00:00").toLocaleDateString("en-GB", {
                      weekday: "short",
                    })}
              </div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>
                {new Date(d + "T00:00:00").getDate()}
              </div>
              <div style={{ fontSize: 10, opacity: 0.7 }}>
                {new Date(d + "T00:00:00").toLocaleDateString("en-GB", {
                  month: "short",
                })}
              </div>
              {hasPlan && !isSel && (
                <span
                  style={{
                    position: "absolute",
                    bottom: 4,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: 4,
                    height: 4,
                    borderRadius: "50%",
                    background: isFuture ? "var(--muted)" : "var(--accent2)",
                    display: "block",
                  }}
                />
              )}
              {isFuture && (
                <span
                  style={{
                    position: "absolute",
                    top: 3,
                    right: 5,
                    fontSize: 8,
                    opacity: 0.5,
                  }}
                >
                  🔒
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Progress Ring ──────────────────────────────────────────────────────────────
function ProgressRing({
  pct,
  color,
  label,
}: {
  pct: number;
  color: string;
  label: string;
}) {
  const r = 28,
    c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
      }}
    >
      <svg width={68} height={68} viewBox="0 0 68 68">
        <circle
          cx={34}
          cy={34}
          r={r}
          fill="none"
          stroke="var(--surface2)"
          strokeWidth={6}
        />
        <circle
          cx={34}
          cy={34}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={6}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 34 34)"
          style={{ transition: "stroke-dashoffset 0.5s" }}
        />
        <text
          x={34}
          y={34}
          textAnchor="middle"
          dominantBaseline="central"
          fill="currentColor"
          fontSize={13}
          fontWeight={700}
        >
          {pct}%
        </text>
      </svg>
      <span style={{ fontSize: 12, color: "var(--muted)" }}>{label}</span>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function Client() {
  const nav = useNavigate();
  const clientId = localStorage.getItem("client_id") || "";
  const showCodeLS = localStorage.getItem("show_code") || "";

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("diet");
  const [client, setClient] = useState<ClientData | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [planDates, setPlanDates] = useState<Set<string>>(new Set());

  const [meals, setMeals] = useState<Meal[]>([]);
  const [checkedMealItems, setCheckedMealItems] = useState<Set<string>>(
    new Set()
  );

  const [workoutItems, setWorkoutItems] = useState<WorkoutItem[]>([]);
  const [checkedWorkoutItems, setCheckedWorkoutItems] = useState<Set<string>>(
    new Set()
  );

  const [loadingDay, setLoadingDay] = useState(false);
  const [savingProgress, setSavingProgress] = useState(false);

  const [progressHistory, setProgressHistory] = useState<ProgressEntry[]>([]);
  const [weightInput, setWeightInput] = useState("");

  const [showCodeBanner, setShowCodeBanner] = useState(!!showCodeLS);

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
    if (c) {
      await Promise.all([
        loadAllPlanDates(clientId),
        loadDayPlan(clientId, todayStr()),
        loadProgressHistory(clientId),
      ]);
    }
    setLoading(false);
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
    } else {
      setMeals([]);
    }
    setCheckedMealItems(
      new Set((mealComps || []).map((r: any) => r.meal_item_id))
    );

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
      setWorkoutItems(
        sorted.map((i: any) => ({
          id: i.id,
          exercise_id: i.exercise_id,
          exercise_name: i.exercises?.name || "Unknown",
          muscle_group: i.exercises?.muscle_group || "",
          notes: i.exercises?.notes || "",
          sets: i.sets,
          reps: i.reps,
          weight_kg: i.weight_kg,
        }))
      );
    } else {
      setWorkoutItems([]);
    }
    setCheckedWorkoutItems(
      new Set((workoutComps || []).map((r: any) => r.workout_item_id))
    );
    setLoadingDay(false);
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

  async function handleDayChange(date: string) {
    setSelectedDate(date);
    await loadDayPlan(clientId, date);
  }

  function calcDietPct(checked: Set<string>, currentMeals: Meal[]) {
    const ids = currentMeals.flatMap((m) => m.items.map((i) => i.id));
    return ids.length > 0
      ? Math.round(
          (ids.filter((id) => checked.has(id)).length / ids.length) * 100
        )
      : 0;
  }

  function calcWorkoutPct(checked: Set<string>, currentItems: WorkoutItem[]) {
    return currentItems.length > 0
      ? Math.round(
          (currentItems.filter((i) => checked.has(i.id)).length /
            currentItems.length) *
            100
        )
      : 0;
  }

  async function persistMealTick(nextChecked: Set<string>) {
    const date = selectedDate;
    await supabase
      .from("meal_completions")
      .delete()
      .eq("client_id", clientId)
      .eq("completed_date", date);
    if (nextChecked.size > 0) {
      await supabase
        .from("meal_completions")
        .insert(
          [...nextChecked].map((meal_item_id) => ({
            client_id: clientId,
            meal_item_id,
            completed_date: date,
          }))
        );
    }
    const dp = calcDietPct(nextChecked, meals);
    const wp = calcWorkoutPct(checkedWorkoutItems, workoutItems);
    const existingWeight =
      progressHistory.find((p) => p.date === date)?.weight_kg ?? null;
    await supabase
      .from("progress_entries")
      .upsert(
        {
          client_id: clientId,
          date,
          diet_progress: dp,
          workout_progress: wp,
          weight_kg: existingWeight,
        },
        { onConflict: "client_id,date" }
      );
    await loadProgressHistory(clientId);
  }

  async function persistWorkoutTick(nextChecked: Set<string>) {
    const date = selectedDate;
    await supabase
      .from("workout_completions")
      .delete()
      .eq("client_id", clientId)
      .eq("completed_date", date);
    if (nextChecked.size > 0) {
      await supabase
        .from("workout_completions")
        .insert(
          [...nextChecked].map((workout_item_id) => ({
            client_id: clientId,
            workout_item_id,
            completed_date: date,
          }))
        );
    }
    const dp = calcDietPct(checkedMealItems, meals);
    const wp = calcWorkoutPct(nextChecked, workoutItems);
    const existingWeight =
      progressHistory.find((p) => p.date === date)?.weight_kg ?? null;
    await supabase
      .from("progress_entries")
      .upsert(
        {
          client_id: clientId,
          date,
          diet_progress: dp,
          workout_progress: wp,
          weight_kg: existingWeight,
        },
        { onConflict: "client_id,date" }
      );
    await loadProgressHistory(clientId);
  }

  function toggleMealItem(id: string) {
    setCheckedMealItems((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      persistMealTick(next);
      return next;
    });
  }

  function toggleWorkoutItem(id: string) {
    setCheckedWorkoutItems((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      persistWorkoutTick(next);
      return next;
    });
  }

  const allMealItemIds = meals.flatMap((m) => m.items.map((i) => i.id));
  const dietPct = calcDietPct(checkedMealItems, meals);
  const workoutPct = calcWorkoutPct(checkedWorkoutItems, workoutItems);

  // ── XP: sum all raw points from progress history ───────────────────────────
  // For each logged day: if diet_progress > 0 OR it was a plan day → hasDietPlan
  // We approximate: if any progress was logged > 0 on either, treat it as a plan day
  const totalRawPts = progressHistory.reduce((acc, p) => {
    const hasDietPlan = p.diet_progress > 0 || planDates.has(p.date);
    const hasWorkoutPlan = p.workout_progress > 0 || planDates.has(p.date);
    return (
      acc +
      calcDailyPts(
        p.diet_progress,
        p.workout_progress,
        hasDietPlan,
        hasWorkoutPlan
      )
    );
  }, 0);

  async function saveWeightOnly() {
    if (!weightInput) return;
    setSavingProgress(true);
    await supabase
      .from("progress_entries")
      .upsert(
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
    setMsg("Weight logged!");
    setTimeout(() => setMsg(""), 3000);
    setSavingProgress(false);
  }

  function handleLogout() {
    localStorage.clear();
    supabase.auth.signOut();
    nav("/");
  }

  function navTo(t: Tab) {
    setTab(t);
    setSidebarOpen(false);
  }

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

  return (
    <div style={{ minHeight: "100vh" }}>
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            zIndex: 99,
            backdropFilter: "blur(2px)",
          }}
        />
      )}

      <aside
        className="sidebar"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          height: "100vh",
          width: 240,
          zIndex: 100,
          transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1)",
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "1.25rem 1rem 0.75rem",
          }}
        >
          <div className="sidebar-logo" style={{ margin: 0 }}>
            ForgeFit
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--muted)",
              fontSize: 20,
              padding: 4,
            }}
          >
            ✕
          </button>
        </div>

        {/* Compact XP rank in sidebar */}
        <div style={{ padding: "0 0.75rem 0.75rem" }}>
          {(() => {
            const xp = rawPtsToXP(Math.max(0, totalRawPts));
            const lvl = resolveLevel(xp);
            return (
              <div
                style={{
                  background: `${lvl.color}15`,
                  border: `1px solid ${lvl.color}40`,
                  borderRadius: 10,
                  padding: "0.5rem 0.75rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <span style={{ fontSize: 18 }}>{lvl.icon}</span>
                <div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      fontFamily: "Syne, sans-serif",
                      color: lvl.color,
                    }}
                  >
                    {lvl.displayName}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--muted)" }}>
                    {xp.toFixed(1)} XP
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        <nav style={{ flex: 1, padding: "0.5rem" }}>
          <button
            className={`sidebar-item ${tab === "diet" ? "active" : ""}`}
            style={{ width: "100%" }}
            onClick={() => navTo("diet")}
          >
            🥗 Diet Plan
          </button>
          <button
            className={`sidebar-item ${tab === "workout" ? "active" : ""}`}
            style={{ width: "100%" }}
            onClick={() => navTo("workout")}
          >
            🏋️ Workouts
          </button>
          <button
            className={`sidebar-item ${tab === "dashboard" ? "active" : ""}`}
            style={{ width: "100%" }}
            onClick={() => navTo("dashboard")}
          >
            📊 Dashboard
          </button>
        </nav>

        <div
          style={{
            padding: "1rem 0.5rem",
            borderTop: "1px solid var(--border)",
          }}
        >
          <div
            style={{
              padding: "0.5rem 0.75rem",
              marginBottom: "0.25rem",
              fontSize: 13,
            }}
          >
            <div style={{ color: "var(--muted)", fontSize: 11 }}>
              Logged in as
            </div>
            <div style={{ fontWeight: 600 }}>{client?.name}</div>
          </div>
          <button
            className="sidebar-item"
            style={{ width: "100%", color: "var(--red)" }}
            onClick={handleLogout}
          >
            ⎋ Logout
          </button>
        </div>
      </aside>

      <HamburgerBtn onClick={() => setSidebarOpen(true)} />

      <main
        style={{ padding: "4.5rem 1rem 3rem", maxWidth: 720, margin: "0 auto" }}
      >
        {/* Streak Banner */}
        {progressHistory.length > 0 && (
          <div style={{ marginBottom: "1rem" }}>
            <StreakBanner history={progressHistory} />
          </div>
        )}

        {/* Connection code banner */}
        {showCodeBanner && (
          <div
            className="alert alert-info"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1.5rem",
            }}
          >
            <div>
              <strong>Your connection code: </strong>
              <span
                style={{
                  fontFamily: "Syne, monospace",
                  fontSize: "1.2rem",
                  letterSpacing: "0.2em",
                  fontWeight: 800,
                }}
              >
                {showCodeLS}
              </span>
              <div style={{ fontSize: 12, marginTop: 4 }}>
                Send this to your coach to get connected.
              </div>
            </div>
            <button
              className="btn btn-sm"
              style={{
                background: "rgba(124,106,247,0.2)",
                color: "var(--accent)",
              }}
              onClick={() => {
                localStorage.removeItem("show_code");
                setShowCodeBanner(false);
              }}
            >
              Dismiss
            </button>
          </div>
        )}

        {msg && (
          <div className="alert alert-success" style={{ marginBottom: "1rem" }}>
            {msg}
          </div>
        )}

        {/* ── DIET TAB ── */}
        {tab === "diet" && (
          <>
            <div className="main-header">
              <h2>Diet Plan</h2>
              <p>
                Swipe to browse days · tap to select · future days are preview
                only
              </p>
            </div>
            <DayStrip
              selected={selectedDate}
              onChange={handleDayChange}
              planDates={planDates}
            />
            {(() => {
              const isFuture = selectedDate > todayStr();
              return loadingDay ? (
                <div style={{ textAlign: "center", padding: "3rem" }}>
                  <div className="spinner" />
                </div>
              ) : meals.length === 0 ? (
                <div
                  className="card"
                  style={{
                    textAlign: "center",
                    padding: "3rem",
                    color: "var(--muted)",
                  }}
                >
                  {isFuture
                    ? "No plan set for this day yet."
                    : "No diet plan for this day yet. Your coach will set it up soon."}
                </div>
              ) : (
                <>
                  {isFuture && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.75rem",
                        padding: "0.75rem 1rem",
                        borderRadius: 10,
                        background: "rgba(124,106,247,0.1)",
                        border: "1px solid rgba(124,106,247,0.3)",
                        marginBottom: "1rem",
                        fontSize: 13,
                        color: "var(--muted)",
                      }}
                    >
                      <span style={{ fontSize: 18 }}>🔒</span>
                      <span>
                        This is a{" "}
                        <strong style={{ color: "var(--accent)" }}>
                          preview
                        </strong>{" "}
                        of your upcoming plan. Ticking unlocks when the day
                        arrives.
                      </span>
                    </div>
                  )}
                  {!isFuture && (
                    <div
                      className="card"
                      style={{
                        marginBottom: "1.5rem",
                        display: "flex",
                        gap: "2rem",
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <ProgressRing
                        pct={dietPct}
                        color={pctColor(dietPct)}
                        label="Diet"
                      />
                      <div style={{ flex: 1 }}>
                        <div
                          style={{ fontWeight: 600, marginBottom: "0.5rem" }}
                        >
                          {checkedMealItems.size} / {allMealItemIds.length}{" "}
                          items completed
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
                        <div
                          style={{
                            fontSize: 12,
                            color: "var(--muted)",
                            marginTop: "0.5rem",
                          }}
                        >
                          {dayLabel(selectedDate)}
                        </div>
                      </div>
                    </div>
                  )}
                  {meals.map((meal) => {
                    const mealItemIds = meal.items.map((i) => i.id);
                    const doneCount = mealItemIds.filter((id) =>
                      checkedMealItems.has(id)
                    ).length;
                    const mealPct =
                      mealItemIds.length > 0
                        ? Math.round((doneCount / mealItemIds.length) * 100)
                        : 0;
                    const allDone =
                      doneCount === mealItemIds.length &&
                      mealItemIds.length > 0;
                    return (
                      <div
                        key={meal.id}
                        className="card"
                        style={{
                          marginBottom: "1rem",
                          padding: 0,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "0.75rem 1rem",
                            background: allDone
                              ? "rgba(34,197,94,0.08)"
                              : "var(--surface2)",
                            borderBottom: "1px solid var(--border)",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "0.75rem",
                            }}
                          >
                            <div
                              style={{
                                background: allDone
                                  ? "var(--green)"
                                  : "var(--accent)",
                                color: "#fff",
                                borderRadius: "50%",
                                width: 28,
                                height: 28,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 12,
                                fontWeight: 700,
                                flexShrink: 0,
                              }}
                            >
                              {allDone ? "✓" : meal.meal_number}
                            </div>
                            <div>
                              <div
                                style={{
                                  fontFamily: "Syne, sans-serif",
                                  fontWeight: 700,
                                  fontSize: "0.95rem",
                                }}
                              >
                                {meal.meal_name}
                              </div>
                              <div
                                style={{ fontSize: 12, color: "var(--muted)" }}
                              >
                                {doneCount}/{mealItemIds.length} items
                              </div>
                            </div>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "0.75rem",
                            }}
                          >
                            <div className="progress-bar" style={{ width: 80 }}>
                              <div
                                className="progress-fill"
                                style={{
                                  width: `${mealPct}%`,
                                  background: pctColor(mealPct),
                                }}
                              />
                            </div>
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: pctColor(mealPct),
                                minWidth: 34,
                              }}
                            >
                              {mealPct}%
                            </span>
                          </div>
                        </div>
                        <div style={{ padding: "0.5rem 0" }}>
                          {meal.items.map((item) => {
                            const done = checkedMealItems.has(item.id);
                            return (
                              <div
                                key={item.id}
                                onClick={() =>
                                  !isFuture && toggleMealItem(item.id)
                                }
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "0.75rem",
                                  padding: "0.65rem 1rem",
                                  cursor: isFuture ? "default" : "pointer",
                                  background: done
                                    ? "rgba(34,197,94,0.04)"
                                    : "transparent",
                                  borderBottom: "1px solid var(--border)",
                                  transition: "background 0.15s",
                                  opacity: isFuture ? 0.6 : 1,
                                }}
                                onMouseEnter={(e) => {
                                  if (!done && !isFuture)
                                    e.currentTarget.style.background =
                                      "var(--surface2)";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = done
                                    ? "rgba(34,197,94,0.04)"
                                    : "transparent";
                                }}
                              >
                                <div
                                  style={{
                                    width: 22,
                                    height: 22,
                                    borderRadius: 6,
                                    flexShrink: 0,
                                    border: done
                                      ? "2px solid var(--green)"
                                      : "2px solid var(--border)",
                                    background: done
                                      ? "var(--green)"
                                      : "transparent",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    transition: "all 0.15s",
                                  }}
                                >
                                  {done && (
                                    <span
                                      style={{
                                        color: "#fff",
                                        fontSize: 13,
                                        fontWeight: 700,
                                      }}
                                    >
                                      ✓
                                    </span>
                                  )}
                                </div>
                                <div style={{ flex: 1 }}>
                                  <div
                                    style={{
                                      fontWeight: 600,
                                      fontSize: "0.95rem",
                                      textDecoration: done
                                        ? "line-through"
                                        : "none",
                                      color: done ? "var(--muted)" : "inherit",
                                    }}
                                  >
                                    {item.food?.name || "Unknown food"}{" "}
                                    <span
                                      style={{
                                        fontWeight: 400,
                                        color: "var(--muted)",
                                        fontSize: 14,
                                      }}
                                    >
                                      {item.quantity} {item.unit}
                                    </span>
                                  </div>
                                  {item.food && (
                                    <div
                                      style={{
                                        fontSize: 12,
                                        color: "var(--muted)",
                                        marginTop: 2,
                                      }}
                                    >
                                      ~
                                      {Math.round(
                                        ((item.food.calories_per_100g *
                                          item.food.serving_size) /
                                          100) *
                                          item.quantity
                                      )}{" "}
                                      kcal per serving{" · "}
                                      P:{" "}
                                      {Math.round(
                                        (item.food.protein_g_per_100g *
                                          item.food.serving_size) /
                                          100
                                      )}
                                      g{" · "}
                                      C:{" "}
                                      {Math.round(
                                        (item.food.carbs_g_per_100g *
                                          item.food.serving_size) /
                                          100
                                      )}
                                      g{" · "}
                                      F:{" "}
                                      {Math.round(
                                        (item.food.fat_g_per_100g *
                                          item.food.serving_size) /
                                          100
                                      )}
                                      g
                                    </div>
                                  )}
                                </div>
                                {done && (
                                  <span
                                    className="badge badge-green"
                                    style={{ flexShrink: 0 }}
                                  >
                                    ✓
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </>
              );
            })()}
          </>
        )}

        {/* ── WORKOUT TAB ── */}
        {tab === "workout" && (
          <>
            <div className="main-header">
              <h2>Workout</h2>
              <p>
                Swipe to browse days · tap to select · future days are preview
                only
              </p>
            </div>
            <DayStrip
              selected={selectedDate}
              onChange={handleDayChange}
              planDates={planDates}
            />
            {(() => {
              const isFuture = selectedDate > todayStr();
              return loadingDay ? (
                <div style={{ textAlign: "center", padding: "3rem" }}>
                  <div className="spinner" />
                </div>
              ) : workoutItems.length === 0 ? (
                <div
                  className="card"
                  style={{
                    textAlign: "center",
                    padding: "3rem",
                    color: "var(--muted)",
                  }}
                >
                  No workout plan for this day.{" "}
                  {isFuture
                    ? "No plan set yet."
                    : "Your coach will assign exercises soon."}
                </div>
              ) : (
                <>
                  {isFuture && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.75rem",
                        padding: "0.75rem 1rem",
                        borderRadius: 10,
                        background: "rgba(124,106,247,0.1)",
                        border: "1px solid rgba(124,106,247,0.3)",
                        marginBottom: "1rem",
                        fontSize: 13,
                        color: "var(--muted)",
                      }}
                    >
                      <span style={{ fontSize: 18 }}>🔒</span>
                      <span>
                        Preview of your upcoming workout. Ticking unlocks when
                        the day arrives.
                      </span>
                    </div>
                  )}
                  {!isFuture && (
                    <div
                      className="card"
                      style={{
                        marginBottom: "1.5rem",
                        display: "flex",
                        gap: "2rem",
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <ProgressRing
                        pct={workoutPct}
                        color={pctColor(workoutPct)}
                        label="Workout"
                      />
                      <div style={{ flex: 1 }}>
                        <div
                          style={{ fontWeight: 600, marginBottom: "0.5rem" }}
                        >
                          {checkedWorkoutItems.size} / {workoutItems.length}{" "}
                          exercises done
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
                        <div
                          style={{
                            fontSize: 12,
                            color: "var(--muted)",
                            marginTop: "0.5rem",
                          }}
                        >
                          {dayLabel(selectedDate)}
                        </div>
                      </div>
                    </div>
                  )}
                  <div style={{ display: "grid", gap: "0.5rem" }}>
                    {workoutItems.map((item, idx) => {
                      const done = checkedWorkoutItems.has(item.id);
                      return (
                        <div
                          key={item.id}
                          onClick={() =>
                            !isFuture && toggleWorkoutItem(item.id)
                          }
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "1rem",
                            padding: "1rem",
                            borderRadius: 12,
                            cursor: isFuture ? "default" : "pointer",
                            background: done
                              ? "rgba(34,197,94,0.08)"
                              : "var(--surface2)",
                            border: `2px solid ${
                              done ? "var(--green)" : "var(--border)"
                            }`,
                            transition: "all 0.15s",
                            opacity: isFuture ? 0.65 : 1,
                          }}
                        >
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: "50%",
                              flexShrink: 0,
                              background: done
                                ? "var(--green)"
                                : "rgba(124,106,247,0.15)",
                              color: done ? "#fff" : "var(--accent)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 700,
                              fontSize: 14,
                              transition: "all 0.15s",
                            }}
                          >
                            {done ? "✓" : idx + 1}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div
                              style={{
                                fontWeight: 700,
                                fontFamily: "Syne, sans-serif",
                                textDecoration: done ? "line-through" : "none",
                                color: done ? "var(--muted)" : "inherit",
                                fontSize: "0.95rem",
                              }}
                            >
                              {item.exercise_name}
                            </div>
                            <div
                              style={{
                                fontSize: 13,
                                color: "var(--muted)",
                                marginTop: 2,
                              }}
                            >
                              {item.sets} sets × {item.reps} reps
                              {item.weight_kg ? ` · ${item.weight_kg} kg` : ""}
                              {item.muscle_group
                                ? ` · ${item.muscle_group}`
                                : ""}
                            </div>
                            {item.notes && (
                              <div
                                style={{
                                  fontSize: 12,
                                  color: "var(--muted)",
                                  fontStyle: "italic",
                                  marginTop: 2,
                                }}
                              >
                                {item.notes}
                              </div>
                            )}
                          </div>
                          {done && (
                            <span
                              className="badge badge-green"
                              style={{ flexShrink: 0 }}
                            >
                              ✓ Done
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </>
        )}

        {/* ── DASHBOARD TAB ── */}
        {tab === "dashboard" && (
          <>
            <div className="main-header">
              <h2>Dashboard</h2>
              <p>Your stats and progress over time</p>
            </div>

            {/* ── XP RANK CARD ── */}
            <XPBadge totalRawPts={Math.max(0, totalRawPts)} />

            {/* Stats grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: "0.75rem",
                marginBottom: "1.5rem",
              }}
            >
              {[
                {
                  label: "Starting Weight",
                  val: client?.weight_kg ? `${client.weight_kg} kg` : "—",
                  color: "inherit",
                },
                {
                  label: "Latest Weight",
                  val: progressHistory[0]?.weight_kg
                    ? `${progressHistory[0].weight_kg} kg`
                    : "—",
                  color: "inherit",
                },
                {
                  label: "Height",
                  val: client?.height_cm ? `${client.height_cm} cm` : "—",
                  color: "inherit",
                },
                {
                  label: "Days Logged",
                  val: String(progressHistory.length),
                  color: "var(--accent)",
                },
              ].map((s) => (
                <div
                  key={s.label}
                  className="card"
                  style={{ padding: "0.85rem 1rem" }}
                >
                  <div
                    style={{
                      fontFamily: "Syne,sans-serif",
                      fontWeight: 800,
                      fontSize: "1.4rem",
                      color: s.color,
                    }}
                  >
                    {s.val}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--muted)",
                      marginTop: 2,
                    }}
                  >
                    {s.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Weight Chart */}
            <div className="card" style={{ marginBottom: "1.5rem" }}>
              <div
                className="section-title"
                style={{ marginBottom: "0.75rem" }}
              >
                Weight Over Time (kg)
              </div>
              <WeightChart entries={progressHistory} />
            </div>

            {/* Today's rings */}
            {(meals.length > 0 || workoutItems.length > 0) && (
              <div
                className="card"
                style={{
                  marginBottom: "1.5rem",
                  display: "flex",
                  gap: "2rem",
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div
                    style={{
                      fontFamily: "Syne, sans-serif",
                      fontWeight: 700,
                      marginBottom: "0.75rem",
                    }}
                  >
                    Today's Progress
                  </div>
                  <div style={{ display: "flex", gap: "1.5rem" }}>
                    <ProgressRing
                      pct={dietPct}
                      color={pctColor(dietPct)}
                      label="Diet"
                    />
                    <ProgressRing
                      pct={workoutPct}
                      color={pctColor(workoutPct)}
                      label="Workout"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Log weight */}
            <div
              className="card"
              style={{
                marginBottom: "1.5rem",
                display: "flex",
                gap: "1rem",
                alignItems: "flex-end",
              }}
            >
              <div style={{ flex: 1 }}>
                <label className="label">Log Today's Weight (kg)</label>
                <input
                  className="input"
                  type="number"
                  step="0.1"
                  placeholder="e.g. 75.5"
                  value={weightInput}
                  onChange={(e) => setWeightInput(e.target.value)}
                />
              </div>
              <button
                className="btn btn-primary"
                onClick={saveWeightOnly}
                disabled={savingProgress || !weightInput}
              >
                {savingProgress ? "…" : "Log"}
              </button>
            </div>

            {/* Three Heatmaps */}
            <YearHeatmapSection history={progressHistory} />

            {/* Progress history table */}
            {progressHistory.length === 0 ? (
              <div
                className="card"
                style={{
                  textAlign: "center",
                  padding: "2rem",
                  color: "var(--muted)",
                }}
              >
                No progress logged yet. Start checking off your diet and
                workouts!
              </div>
            ) : (
              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <table className="table">
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
                    {progressHistory.map((p) => {
                      const pts = calcDailyPts(
                        p.diet_progress,
                        p.workout_progress,
                        p.diet_progress > 0 || planDates.has(p.date),
                        p.workout_progress > 0 || planDates.has(p.date)
                      );
                      return (
                        <tr key={p.id}>
                          <td style={{ fontSize: 13 }}>
                            {new Date(p.date + "T00:00:00").toLocaleDateString(
                              "en-GB",
                              { day: "numeric", month: "short" }
                            )}
                          </td>
                          <td>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.4rem",
                              }}
                            >
                              <div
                                className="progress-bar"
                                style={{ flex: 1, maxWidth: 60 }}
                              >
                                <div
                                  className="progress-fill"
                                  style={{
                                    width: `${p.diet_progress}%`,
                                    background: pctColor(p.diet_progress),
                                  }}
                                />
                              </div>
                              <span
                                style={{
                                  color: pctColor(p.diet_progress),
                                  fontSize: 12,
                                  fontWeight: 600,
                                }}
                              >
                                {p.diet_progress}%
                              </span>
                            </div>
                          </td>
                          <td>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.4rem",
                              }}
                            >
                              <div
                                className="progress-bar"
                                style={{ flex: 1, maxWidth: 60 }}
                              >
                                <div
                                  className="progress-fill"
                                  style={{
                                    width: `${p.workout_progress}%`,
                                    background: pctColor(p.workout_progress),
                                  }}
                                />
                              </div>
                              <span
                                style={{
                                  color: pctColor(p.workout_progress),
                                  fontSize: 12,
                                  fontWeight: 600,
                                }}
                              >
                                {p.workout_progress}%
                              </span>
                            </div>
                          </td>
                          <td style={{ fontSize: 13 }}>
                            {p.weight_kg ? (
                              `${p.weight_kg} kg`
                            ) : (
                              <span style={{ color: "var(--muted)" }}>—</span>
                            )}
                          </td>
                          <td
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
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

            {/* Connection code if no coach */}
            {client && !client.coach_id && (
              <div className="card" style={{ marginTop: "1.5rem" }}>
                <div className="section-title">
                  Not connected to a coach yet
                </div>
                <p
                  style={{
                    color: "var(--muted)",
                    marginBottom: "1rem",
                    fontSize: 14,
                  }}
                >
                  Share this code with your coach to link your account.
                </p>
                <div className="code-box">
                  <div className="code-text">{client.connection_code}</div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
