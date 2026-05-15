// XPBadge.tsx — XP display component for Client.tsx dashboard

import {
  resolveLevel,
  tierEmoji,
  xpToNextMilestone,
  rawPtsToXP,
} from "../xpSystem";

interface XPBadgeProps {
  totalRawPts: number;
}

export default function XPBadge({ totalRawPts }: XPBadgeProps) {
  const xp = rawPtsToXP(totalRawPts);
  const lvl = resolveLevel(xp);
  const next = xpToNextMilestone(xp);

  const tierColors: Record<string, string> = {
    Bronze: "#c97c3a",
    Silver: "#8a8aaa",
    Gold: "#c9a227",
  };
  const tierBg: Record<string, string> = {
    Bronze: "rgba(201,124,58,0.12)",
    Silver: "rgba(138,138,170,0.12)",
    Gold: "rgba(201,162,39,0.12)",
  };
  const tierColor = lvl.tier ? tierColors[lvl.tier] : lvl.color;
  const tierBgColor = lvl.tier ? tierBg[lvl.tier] : `${lvl.color}18`;

  return (
    <div
      style={{
        background: `${lvl.color}10`,
        border: `1px solid ${lvl.color}40`,
        borderRadius: 14,
        padding: "1rem",
        marginBottom: "1rem",
      }}
    >
      {/* Top row — rank badge + XP number */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "0.75rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <div
            style={{
              background: tierBgColor,
              border: `1px solid ${tierColor}60`,
              borderRadius: 10,
              padding: "0.3rem 0.75rem",
              fontSize: 13,
              fontWeight: 700,
              fontFamily: "Syne, sans-serif",
              color: tierColor,
              letterSpacing: "0.02em",
            }}
          >
            {tierEmoji(lvl.tier)} {lvl.displayName}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>Total XP</div>
          <div
            style={{
              fontFamily: "Syne, sans-serif",
              fontWeight: 800,
              fontSize: 18,
              color: lvl.color,
            }}
          >
            {xp.toFixed(1)}
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
            marginBottom: 4,
          }}
        >
          <span>{lvl.xpMin} XP</span>
          <span>{lvl.xpMax} XP</span>
        </div>
        <div
          style={{
            height: 8,
            borderRadius: 999,
            background: "var(--surface2)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${lvl.progressPct}%`,
              background: lvl.color,
              borderRadius: 999,
              transition: "width 0.6s cubic-bezier(0.34,1.56,0.64,1)",
            }}
          />
        </div>
      </div>

      {/* Next milestone */}
      {next ? (
        <div style={{ fontSize: 12, color: "var(--muted)" }}>
          <span style={{ color: lvl.color, fontWeight: 600 }}>
            {next.xpNeeded} XP
          </span>{" "}
          to <span style={{ fontWeight: 600 }}>{next.label}</span>
        </div>
      ) : (
        <div style={{ fontSize: 12, fontWeight: 700, color: lvl.color }}>
          👑 Maximum rank achieved
        </div>
      )}
    </div>
  );
}
