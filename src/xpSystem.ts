// xpSystem.ts — ForgeFit XP & Level Engine

export interface XPLevel {
  level: number;
  name: string;
  tier: string | null; // 'Bronze' | 'Silver' | 'Gold' | null
  displayName: string; // e.g. "Warrior Gold" or "Apex"
  color: string;
  xpMin: number; // XP threshold to enter this sub-level
  xpMax: number; // XP threshold of next sub-level
  progressPct: number; // 0–100 within the current sub-level range
}

// ── XP Thresholds ─────────────────────────────────────────────────────────────
// Total XP scale: 0 → 100
// 4-year grind at ~80% consistency:
//   365 days × 4 years × 0.8 = 1168 "active" days
//   Max daily pts: 25 (15 workout + 10 diet)
//   Expected daily avg at 80%: ~18 pts/day
//   Cumulative pts after 4 years: ~21,024
//   We map these raw points onto a 0–100 XP scale via a curve.
//
// The curve is: XP = 100 × (raw_pts / MAX_RAW)^0.45
// This means early XP is fast, later XP is brutally slow.
// MAX_RAW = 21,024 (4-year perfect-avg total)

export const MAX_RAW_PTS = 21024;

// Raw pts → XP (0–100), exponential decay curve
export function rawPtsToXP(rawPts: number): number {
  if (rawPts <= 0) return 0;
  const clamped = Math.min(rawPts, MAX_RAW_PTS);
  const xp = 100 * Math.pow(clamped / MAX_RAW_PTS, 0.45);
  return Math.min(100, Math.round(xp * 10) / 10); // 1 decimal
}

// ── Point calculation ──────────────────────────────────────────────────────────
// diet_progress and workout_progress are 0–100 (percent)
// A "plan exists" flag determines if 0% counts as a skip (penalty) or rest day

export function calcDailyPts(
  dietPct: number,
  workoutPct: number,
  hasDietPlan: boolean,
  hasWorkoutPlan: boolean
): number {
  let pts = 0;

  // Workout: max +15, scale linearly. Skip = -3
  if (hasWorkoutPlan) {
    if (workoutPct === 0) {
      pts -= 3;
    } else {
      pts += Math.round((workoutPct / 100) * 15);
    }
  }

  // Diet: max +10, scale linearly. Skip = -2
  if (hasDietPlan) {
    if (dietPct === 0) {
      pts -= 2;
    } else {
      pts += Math.round((dietPct / 100) * 10);
    }
  }

  return pts;
}

// ── Level definitions ──────────────────────────────────────────────────────────
// Each entry: [level, name, color, xpStart, xpEnd, tiers (null = no sub-tiers)]
// Tiers split their range into thirds (roughly)

interface LevelDef {
  level: number;
  name: string;
  color: string;
  xpStart: number;
  xpEnd: number;
  tiers: { tier: string; xpMin: number; xpMax: number }[] | null;
}

export const LEVEL_DEFS: LevelDef[] = [
  {
    level: 1,
    name: "Rookie",
    color: "#888780",
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
    xpStart: 85,
    xpEnd: 95,
    tiers: null,
  },
  {
    level: 8,
    name: "Legend",
    color: "#a32d2d",
    xpStart: 95,
    xpEnd: 100,
    tiers: null,
  },
];

// ── Resolve current level from XP ─────────────────────────────────────────────
export function resolveLevel(xp: number): XPLevel {
  let activeDef: LevelDef = LEVEL_DEFS[0];
  for (const def of LEVEL_DEFS) {
    if (xp >= def.xpStart) activeDef = def;
    else break;
  }

  // No sub-tiers (Apex / Legend)
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
      xpMin: activeDef.xpStart,
      xpMax: activeDef.xpEnd,
      progressPct,
    };
  }

  // Find active tier
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
    xpMin: activeTier.xpMin,
    xpMax: activeTier.xpMax,
    progressPct,
  };
}

// Tier emoji badges
export function tierEmoji(tier: string | null): string {
  if (tier === "Bronze") return "🥉";
  if (tier === "Silver") return "🥈";
  if (tier === "Gold") return "🥇";
  return "👑";
}

// XP needed for next sub-level/level milestone
export function xpToNextMilestone(
  xp: number
): { label: string; xpNeeded: number } | null {
  const current = resolveLevel(xp);
  if (xp >= 100) return null;
  const gap = current.xpMax - xp;
  const nextXPLevel = resolveLevel(current.xpMax);
  return {
    label: nextXPLevel.displayName,
    xpNeeded: Math.max(0, Math.round(gap * 10) / 10),
  };
}
