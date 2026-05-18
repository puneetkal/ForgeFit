// components/XPBadgeAnimated.tsx
// Drop-in replacement for the inline XPBadge in Client.tsx
// Requires: npm install framer-motion --legacy-peer-deps

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ── XP logic ──────────────────────────────────────────────────────────────────
const MAX_RAW = 21024;

function rawToXP(r: number) {
  return (
    Math.round(
      100 * Math.pow(Math.min(Math.max(r, 0), MAX_RAW) / MAX_RAW, 0.45) * 10
    ) / 10
  );
}

interface TierDef {
  tier: string;
  xn: number;
  xx: number;
}

interface LevelDef {
  level: number;
  name: string;
  color: string;
  icon: string;
  xs: number;
  xe: number;
  tiers: TierDef[] | null;
}

const LEVELS: LevelDef[] = [
  {
    level: 1,
    name: "Rookie",
    color: "#9e9b90",
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
    color: "#c0392b",
    icon: "👑",
    xs: 95,
    xe: 100,
    tiers: null,
  },
];

const TIER_COLORS: Record<string, string> = {
  Bronze: "#c97c3a",
  Silver: "#8a8aaa",
  Gold: "#c9a227",
};

type ResolvedLevel = LevelDef & {
  tier: string | null;
  displayName: string;
  xMin: number;
  xMax: number;
  pct: number;
};

function resolveLevel(xp: number): ResolvedLevel {
  let def: LevelDef = LEVELS[0];
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

  let t: TierDef = def.tiers[0];
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

// ── Roadmap types ─────────────────────────────────────────────────────────────
interface TierNode {
  levelNum: number;
  levelName: string;
  levelColor: string;
  levelIcon: string;
  tier: string | null;
  xn: number;
  xx: number;
  displayName: string;
  tileColor: string;
}

function buildRoadmap(): TierNode[] {
  const result: TierNode[] = [];
  for (const lvl of LEVELS) {
    if (lvl.tiers) {
      for (const t of lvl.tiers) {
        result.push({
          levelNum: lvl.level,
          levelName: lvl.name,
          levelColor: lvl.color,
          levelIcon: lvl.icon,
          tier: t.tier,
          xn: t.xn,
          xx: t.xx,
          displayName: `${lvl.name}\n${t.tier}`,
          tileColor: TIER_COLORS[t.tier],
        });
      }
    } else {
      result.push({
        levelNum: lvl.level,
        levelName: lvl.name,
        levelColor: lvl.color,
        levelIcon: lvl.icon,
        tier: null,
        xn: lvl.xs,
        xx: lvl.xe,
        displayName: lvl.name,
        tileColor: lvl.color,
      });
    }
  }
  return result;
}

const ROADMAP = buildRoadmap();

// ── Animated counter hook ─────────────────────────────────────────────────────
function useCountUp(target: number, durationMs = 1600, delayMs = 300) {
  const [value, setValue] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    const delayTimer = setTimeout(() => {
      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        const t = Math.min((Date.now() - startTime) / durationMs, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        setValue(parseFloat((target * eased).toFixed(1)));
        if (t >= 1) {
          clearInterval(timerRef.current!);
          setValue(target);
        }
      }, 16);
    }, delayMs);
    return () => {
      clearTimeout(delayTimer);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [target, durationMs, delayMs]);
  return value;
}

// ── Floating particle ─────────────────────────────────────────────────────────
function FloatParticle({
  color,
  x,
  delay,
}: {
  color: string;
  x: number;
  delay: number;
}) {
  return (
    <motion.div
      animate={{ y: [0, -28, -56], opacity: [0, 0.9, 0] }}
      transition={{ repeat: Infinity, duration: 2.2, delay, ease: "easeOut" }}
      style={{
        position: "absolute",
        bottom: 8,
        left: `${x}%`,
        width: 5,
        height: 5,
        borderRadius: "50%",
        background: color,
        boxShadow: `0 0 6px ${color}`,
        pointerEvents: "none",
      }}
    />
  );
}

// ── Tier roadmap ──────────────────────────────────────────────────────────────
function TierRoadmap({ xp }: { xp: number }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const active = el.querySelector<HTMLElement>("[data-current='true']");
    if (active)
      setTimeout(
        () =>
          active.scrollIntoView({
            behavior: "smooth",
            inline: "center",
            block: "nearest",
          }),
        900
      );
  }, [xp]);

  return (
    <div
      style={{
        marginTop: "1rem",
        paddingTop: "0.8rem",
        borderTop: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      <div
        style={{
          fontSize: 9,
          color: "var(--muted)",
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          marginBottom: 8,
        }}
      >
        Your Path to Glory
      </div>
      <div
        ref={scrollRef}
        style={{
          display: "flex",
          gap: 5,
          overflowX: "auto",
          paddingBottom: 6,
          scrollbarWidth: "none",
        }}
      >
        {ROADMAP.map((node, idx) => {
          const achieved = xp >= node.xx;
          const current = xp >= node.xn && xp < node.xx;
          const future = xp < node.xn;
          const col = node.tileColor;
          return (
            <motion.div
              key={idx}
              data-current={current ? "true" : "false"}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: future ? 0.38 : 1, y: 0 }}
              transition={{ delay: idx * 0.03, duration: 0.4 }}
              style={{
                flexShrink: 0,
                width: 52,
                borderRadius: 10,
                padding: "7px 4px 5px",
                textAlign: "center",
                border: current
                  ? `1.5px solid ${col}`
                  : achieved
                  ? `1px solid ${col}55`
                  : "1px solid rgba(255,255,255,0.06)",
                background: current
                  ? `${col}28`
                  : achieved
                  ? `${col}10`
                  : "rgba(255,255,255,0.03)",
                position: "relative",
                boxShadow: current ? `0 0 12px ${col}40` : "none",
              }}
            >
              <div
                style={{
                  fontSize: 17,
                  lineHeight: 1,
                  marginBottom: 3,
                  filter: future ? "grayscale(0.7) brightness(0.6)" : "none",
                }}
              >
                {achieved
                  ? "✅"
                  : current
                  ? node.levelIcon
                  : future
                  ? "🔒"
                  : node.levelIcon}
              </div>
              <div
                style={{
                  fontSize: 7.5,
                  fontWeight: 800,
                  lineHeight: 1.25,
                  whiteSpace: "pre-line",
                  color: current
                    ? col
                    : achieved
                    ? `${col}cc`
                    : "rgba(255,255,255,0.3)",
                }}
              >
                {node.tier ? `${node.levelName}\n${node.tier}` : node.levelName}
              </div>
              <div
                style={{
                  fontSize: 6.5,
                  color: "var(--muted)",
                  marginTop: 2,
                  opacity: 0.7,
                }}
              >
                {node.xn}–{node.xx} XP
              </div>
              {current && (
                <motion.div
                  animate={{ opacity: [1, 0.2, 1], scale: [1, 1.4, 1] }}
                  transition={{ repeat: Infinity, duration: 1.2 }}
                  style={{
                    position: "absolute",
                    bottom: -5,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: col,
                    boxShadow: `0 0 8px ${col}`,
                  }}
                />
              )}
              {achieved && (
                <motion.div
                  animate={{ x: ["-120%", "220%"] }}
                  transition={{
                    repeat: Infinity,
                    duration: 3,
                    ease: "linear",
                    delay: idx * 0.2,
                  }}
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: `linear-gradient(90deg, transparent, ${col}22, transparent)`,
                    borderRadius: 10,
                    pointerEvents: "none",
                    width: "50%",
                  }}
                />
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
interface XPBadgeAnimatedProps {
  totalRaw: number;
}

export default function XPBadgeAnimated({ totalRaw }: XPBadgeAnimatedProps) {
  const xp = Math.min(100, rawToXP(Math.max(0, totalRaw)));
  const lvl = resolveLevel(xp);
  const tierColor = lvl.tier ? TIER_COLORS[lvl.tier] : lvl.color;
  const displayXP = useCountUp(xp, 1600, 300);

  const [barReady, setBarReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setBarReady(true), 500);
    return () => clearTimeout(t);
  }, []);

  const nextMilestone = (() => {
    for (const node of ROADMAP) {
      if (xp < node.xx)
        return {
          name: node.displayName.replace("\n", " "),
          needed: parseFloat((node.xx - xp).toFixed(1)),
          color: node.tileColor,
          icon: node.levelIcon,
        };
    }
    return null;
  })();

  const particles = useRef(
    Array.from({ length: 5 }, (_, i) => ({ x: 12 + i * 18, delay: i * 0.38 }))
  );

  return (
    <>
      <style>{`
        @keyframes xpbadge-outer-glow {
          0%,100% { box-shadow: 0 0 14px ${lvl.color}35, 0 0 28px ${lvl.color}18; }
          50%      { box-shadow: 0 0 24px ${lvl.color}65, 0 0 48px ${lvl.color}30; }
        }
        @keyframes xpbadge-pill-glow {
          0%,100% { box-shadow: 0 0 8px ${tierColor}45; }
          50%      { box-shadow: 0 0 18px ${tierColor}85, 0 0 32px ${tierColor}35; }
        }
      `}</style>

      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        style={{
          position: "relative",
          borderRadius: 18,
          padding: "1.1rem 1rem 0.9rem",
          marginBottom: "1rem",
          overflow: "hidden",
          background: `${lvl.color}0e`,
          border: `1px solid ${lvl.color}45`,
          animation: "xpbadge-outer-glow 3.5s ease-in-out infinite",
        }}
      >
        {/* Background bloom */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background: `radial-gradient(ellipse at 85% 15%, ${lvl.color}1e 0%, transparent 55%),
                       radial-gradient(ellipse at 10% 85%, ${tierColor}10 0%, transparent 45%)`,
          }}
        />

        {/* Floating particles */}
        {particles.current.map((p, i) => (
          <FloatParticle key={i} color={lvl.color} x={p.x} delay={p.delay} />
        ))}

        {/* Ghost icon */}
        <motion.div
          animate={{ rotate: [-4, 4, -4], y: [0, -3, 0] }}
          transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
          style={{
            position: "absolute",
            top: 10,
            right: 12,
            fontSize: 52,
            opacity: 0.1,
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          {lvl.icon}
        </motion.div>

        {/* Top row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "0.85rem",
            position: "relative",
          }}
        >
          <motion.div
            initial={{ scale: 0.75, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{
              delay: 0.15,
              type: "spring",
              stiffness: 280,
              damping: 18,
            }}
            style={{
              background: `${tierColor}20`,
              border: `1.5px solid ${tierColor}65`,
              borderRadius: 10,
              padding: "0.35rem 0.9rem",
              fontSize: 13,
              fontWeight: 800,
              color: tierColor,
              letterSpacing: "0.03em",
              fontFamily: "Syne, sans-serif",
              animation: "xpbadge-pill-glow 2.8s ease-in-out infinite",
            }}
          >
            {tierEmoji(lvl.tier)}&nbsp;{lvl.displayName}
          </motion.div>

          <div style={{ textAlign: "right" }}>
            <div
              style={{ fontSize: 9, color: "var(--muted)", marginBottom: 1 }}
            >
              Total XP
            </div>
            <div
              style={{
                fontFamily: "Syne, sans-serif",
                fontWeight: 900,
                fontSize: 24,
                color: lvl.color,
                lineHeight: 1,
                letterSpacing: "-0.02em",
              }}
            >
              {displayXP.toFixed(1)}
              <span
                style={{
                  fontSize: 12,
                  color: "var(--muted)",
                  fontWeight: 400,
                  marginLeft: 2,
                }}
              >
                / 100
              </span>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom: "0.65rem" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 10,
              color: "var(--muted)",
              marginBottom: 6,
            }}
          >
            <span>{lvl.xMin} XP</span>
            <span style={{ color: lvl.color, fontWeight: 700 }}>
              {lvl.pct}%
            </span>
            <span>{lvl.xMax} XP</span>
          </div>
          <div
            style={{
              height: 10,
              borderRadius: 999,
              background: "rgba(255,255,255,0.07)",
              position: "relative",
            }}
          >
            <motion.div
              initial={{ width: "0%" }}
              animate={{ width: barReady ? `${lvl.pct}%` : "0%" }}
              transition={{
                duration: 1.6,
                delay: 0.4,
                ease: [0.34, 1.38, 0.64, 1],
              }}
              style={{
                height: "100%",
                borderRadius: 999,
                overflow: "hidden",
                background: `linear-gradient(90deg, ${lvl.color}80, ${lvl.color}, ${lvl.color}ee)`,
                boxShadow: `0 0 10px ${lvl.color}60`,
                position: "relative",
              }}
            >
              <motion.div
                animate={{ x: ["-100%", "280%"] }}
                transition={{
                  repeat: Infinity,
                  duration: 2.4,
                  ease: "linear",
                  delay: 1.8,
                }}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "38%",
                  background:
                    "linear-gradient(90deg, transparent, rgba(255,255,255,0.38), transparent)",
                  borderRadius: 999,
                }}
              />
            </motion.div>

            <AnimatePresence>
              {lvl.pct > 4 && lvl.pct < 100 && barReady && (
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: [0.7, 1, 0.7], scale: [1, 1.25, 1] }}
                  transition={{ duration: 1.4, repeat: Infinity, delay: 0.2 }}
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: `${lvl.pct}%`,
                    transform: "translate(-50%, -50%)",
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    background: lvl.color,
                    boxShadow: `0 0 10px ${lvl.color}, 0 0 22px ${lvl.color}80`,
                    zIndex: 2,
                  }}
                />
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Next milestone */}
        <AnimatePresence>
          {nextMilestone ? (
            <motion.div
              key="next"
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.9 }}
              style={{ fontSize: 12, color: "var(--muted)", marginBottom: 2 }}
            >
              <span style={{ color: nextMilestone.color, fontWeight: 800 }}>
                {nextMilestone.needed} XP
              </span>{" "}
              to unlock{" "}
              <span style={{ fontWeight: 700, color: "var(--text2)" }}>
                {nextMilestone.icon} {nextMilestone.name}
              </span>
            </motion.div>
          ) : (
            <motion.div
              key="max"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ fontSize: 12, fontWeight: 800, color: lvl.color }}
            >
              👑 Maximum rank — Legend achieved
            </motion.div>
          )}
        </AnimatePresence>

        <TierRoadmap xp={xp} />
      </motion.div>
    </>
  );
}
