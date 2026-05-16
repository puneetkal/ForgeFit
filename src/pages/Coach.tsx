// Coach.tsx — Full rewrite with:
// + Delete food/exercise from database
// + Search and sort clients list
// + Weekly progress photos tab
// + WhatsApp-style chat overlay

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import CoachSelf from "../components/CoachSelf";
import Chat from "./Chat";

// ── Types ──────────────────────────────────────────────────────────────────────
type CoachView = "clients" | "client_detail" | "foods" | "exercises";
type PlanTab = "diet" | "workout" | "progress" | "goals" | "photos";
type CopyPlanType = "diet" | "workout";

interface ClientGoals {
  id?: string;
  client_id: string;
  calories_target: number;
  protein_target: number;
  carbs_target: number;
  fat_target: number;
  show_macros_to_client: boolean;
}

interface ClientRow {
  id: string;
  name: string;
  age: number;
  height_cm: number;
  weight_kg: number;
  connection_code: string;
  coach_id: string | null;
}

interface Food {
  id: string;
  name: string;
  serving_size: number;
  serving_unit: string;
  calories_per_serving: number;
  protein_per_serving: number;
  carbs_per_serving: number;
  fat_per_serving: number;
}

interface Exercise {
  id: string;
  name: string;
  muscle_group: string;
  notes: string;
}

interface MealItemDraft {
  food_id: string;
  quantity: number;
  unit: string;
  food?: Food;
}

interface MealDraft {
  meal_name: string;
  items: MealItemDraft[];
}

interface WorkoutItemDraft {
  exercise_id: string;
  sets: number;
  reps: number;
  weight_kg: number | null;
  exercise?: Exercise;
}

interface ProgressEntry {
  id: string;
  date: string;
  diet_progress: number;
  workout_progress: number;
  weight_kg: number | null;
}

interface WeeklyPhoto {
  id: string;
  client_id: string;
  week_start: string;
  photo_url: string;
  notes: string;
  uploaded_at: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtDate(d: Date) {
  return d.toISOString().split("T")[0];
}
function todayStr() {
  return fmtDate(new Date());
}
function pctColor(v: number) {
  if (v >= 80) return "var(--green)";
  if (v >= 50) return "#facc15";
  return "var(--red)";
}
function macroScale(food: Food, quantity: number): number {
  return quantity / (food.serving_size || 1);
}
function servingLabel(food: Food): string {
  const sz = food.serving_size === 1 ? "" : `${food.serving_size} `;
  return `${sz}${food.serving_unit}`;
}

const SERVING_UNIT_SUGGESTIONS = [
  "g",
  "ml",
  "unit",
  "tbsp",
  "tsp",
  "cup",
  "slice",
  "scoop",
  "piece",
  "bowl",
  "roti",
];

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
            background: "white",
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
    H = 110,
    padL = 34,
    padR = 10,
    padT = 10,
    padB = 24,
    cW = W - padL - padR,
    cH = H - padT - padB;
  const weights = data.map((d) => d.w),
    minW = Math.min(...weights),
    maxW = Math.max(...weights),
    range = maxW - minW || 1;
  const xp = (i: number) => padL + (i / Math.max(data.length - 1, 1)) * cW;
  const yp = (w: number) => padT + ((maxW - w) / range) * cH;
  const pts = data.map((d, i) => `${xp(i)},${yp(d.w)}`);
  const fillPts = `${padL},${padT + cH} ${pts.join(" ")} ${xp(
    data.length - 1
  )},${padT + cH}`;
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
      {[minW, (minW + maxW) / 2, maxW].map((w, i) => (
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

// ── Mini Calendar ──────────────────────────────────────────────────────────────
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function MiniCalendar({
  selected,
  onSelect,
  highlighted,
}: {
  selected: string;
  onSelect: (d: string) => void;
  highlighted: Set<string>;
}) {
  const [vy, setVy] = useState(() =>
    new Date(selected + "T00:00:00").getFullYear()
  );
  const [vm, setVm] = useState(() =>
    new Date(selected + "T00:00:00").getMonth()
  );
  const firstDow = new Date(vy, vm, 1).getDay();
  const daysInMonth = new Date(vy, vm + 1, 0).getDate();
  const todayS = todayStr();
  function prev() {
    if (vm === 0) {
      setVy((y) => y - 1);
      setVm(11);
    } else setVm((m) => m - 1);
  }
  function next() {
    if (vm === 11) {
      setVy((y) => y + 1);
      setVm(0);
    } else setVm((m) => m + 1);
  }
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let i = 1; i <= daysInMonth; i++) cells.push(i);
  return (
    <div style={{ userSelect: "none" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "0.75rem",
        }}
      >
        <button
          className="btn btn-sm btn-outline"
          style={{ padding: "2px 12px", fontSize: 18 }}
          onClick={prev}
        >
          ‹
        </button>
        <span
          style={{
            fontFamily: "Syne,sans-serif",
            fontWeight: 700,
            fontSize: 15,
          }}
        >
          {MONTHS[vm]} {vy}
        </span>
        <button
          className="btn btn-sm btn-outline"
          style={{ padding: "2px 12px", fontSize: 18 }}
          onClick={next}
        >
          ›
        </button>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7,1fr)",
          gap: 3,
        }}
      >
        {DOW.map((d) => (
          <div
            key={d}
            style={{
              fontSize: 10,
              color: "var(--muted)",
              textAlign: "center",
              fontWeight: 600,
              paddingBottom: 3,
            }}
          >
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const ds = `${vy}-${String(vm + 1).padStart(2, "0")}-${String(
            day
          ).padStart(2, "0")}`;
          const isSel = ds === selected,
            isToday = ds === todayS,
            hasPlan = highlighted.has(ds);
          return (
            <button
              key={i}
              onClick={() => onSelect(ds)}
              style={{
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 12,
                padding: "5px 0",
                position: "relative",
                textAlign: "center",
                background: isSel ? "var(--accent)" : "transparent",
                color: isSel ? "#fff" : isToday ? "var(--accent)" : "inherit",
                fontWeight: isSel || isToday ? 700 : 400,
                outline: isToday && !isSel ? "2px solid var(--accent)" : "none",
                outlineOffset: -2,
              }}
            >
              {day}
              {hasPlan && (
                <span
                  style={{
                    position: "absolute",
                    bottom: 2,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: 4,
                    height: 4,
                    borderRadius: "50%",
                    background: isSel
                      ? "rgba(255,255,255,0.7)"
                      : "var(--accent2)",
                    display: "block",
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
      <div
        style={{
          display: "flex",
          gap: "1rem",
          marginTop: "0.6rem",
          fontSize: 11,
          color: "var(--muted)",
        }}
      >
        <span>● has plan</span>
        <span style={{ color: "var(--accent)" }}>■ selected</span>
      </div>
    </div>
  );
}

// ── Add Food Modal ─────────────────────────────────────────────────────────────
interface NewFoodState {
  name: string;
  serving_size: string;
  serving_unit: string;
  calories_per_serving: string;
  protein_per_serving: string;
  carbs_per_serving: string;
  fat_per_serving: string;
}
const EMPTY_FOOD: NewFoodState = {
  name: "",
  serving_size: "1",
  serving_unit: "unit",
  calories_per_serving: "",
  protein_per_serving: "",
  carbs_per_serving: "",
  fat_per_serving: "",
};

function AddFoodModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (food: NewFoodState) => Promise<void>;
}) {
  const [form, setForm] = useState<NewFoodState>(EMPTY_FOOD);
  const [saving, setSaving] = useState(false);
  const [customUnit, setCustomUnit] = useState(false);
  function set(k: keyof NewFoodState, v: string) {
    setForm((p) => ({ ...p, [k]: v }));
  }
  const previewCal = parseFloat(form.calories_per_serving) || 0;
  const previewP = parseFloat(form.protein_per_serving) || 0;
  const previewC = parseFloat(form.carbs_per_serving) || 0;
  const previewF = parseFloat(form.fat_per_serving) || 0;
  const servingDisplay = `${form.serving_size} ${form.serving_unit}`.trim();
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.serving_unit) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
  }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 480, width: "95vw" }}
      >
        <div className="modal-title">Add New Food</div>
        <form
          onSubmit={handleSave}
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          <div>
            <label className="label">Food Name</label>
            <input
              className="input"
              required
              placeholder="e.g. Egg, Peanut Butter, Brown Rice"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>
          <div>
            <label className="label">Serving Size</label>
            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                alignItems: "flex-start",
                flexWrap: "wrap",
              }}
            >
              <input
                className="input"
                type="number"
                min="0.1"
                step="0.1"
                required
                style={{ width: 90, flexShrink: 0 }}
                placeholder="1"
                value={form.serving_size}
                onChange={(e) => set("serving_size", e.target.value)}
              />
              <div style={{ flex: 1, minWidth: 160 }}>
                {customUnit ? (
                  <input
                    className="input"
                    placeholder="e.g. banana, roti, chapati"
                    value={form.serving_unit}
                    onChange={(e) => set("serving_unit", e.target.value)}
                    autoFocus
                  />
                ) : (
                  <select
                    className="input"
                    value={
                      SERVING_UNIT_SUGGESTIONS.includes(form.serving_unit)
                        ? form.serving_unit
                        : "__custom"
                    }
                    onChange={(e) => {
                      if (e.target.value === "__custom") {
                        setCustomUnit(true);
                        set("serving_unit", "");
                      } else set("serving_unit", e.target.value);
                    }}
                  >
                    {SERVING_UNIT_SUGGESTIONS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                    <option value="__custom">custom…</option>
                  </select>
                )}
              </div>
            </div>
            <div
              style={{
                marginTop: "0.5rem",
                fontSize: 12,
                color: "var(--muted)",
              }}
            >
              ℹ️ Enter macros for exactly{" "}
              <strong style={{ color: "var(--text)" }}>
                {servingDisplay || "1 serving"}
              </strong>{" "}
              below.
            </div>
          </div>
          <div>
            <label className="label">
              Macros for 1 serving ({servingDisplay || "serving"})
            </label>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "0.6rem",
              }}
            >
              {[
                {
                  key: "calories_per_serving",
                  label: "Calories (kcal)",
                  color: "inherit",
                },
                {
                  key: "protein_per_serving",
                  label: "Protein (g)",
                  color: "#f87171",
                },
                {
                  key: "carbs_per_serving",
                  label: "Carbs (g)",
                  color: "#facc15",
                },
                {
                  key: "fat_per_serving",
                  label: "Fat (g)",
                  color: "var(--accent2)",
                },
              ].map(({ key, label, color }) => (
                <div key={key}>
                  <label className="label" style={{ color, fontSize: 11 }}>
                    {label}
                  </label>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.1"
                    required
                    placeholder="0"
                    value={(form as any)[key]}
                    onChange={(e) =>
                      set(key as keyof NewFoodState, e.target.value)
                    }
                  />
                </div>
              ))}
            </div>
          </div>
          {previewCal > 0 && (
            <div
              style={{
                background: "var(--surface2)",
                borderRadius: 10,
                padding: "0.65rem 1rem",
                fontSize: 13,
                display: "flex",
                gap: "1rem",
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontWeight: 700, color: "var(--accent)" }}>
                Preview ({servingDisplay}):
              </span>
              <span>{previewCal} kcal</span>
              <span style={{ color: "#f87171" }}>P {previewP}g</span>
              <span style={{ color: "#facc15" }}>C {previewC}g</span>
              <span style={{ color: "var(--accent2)" }}>F {previewF}g</span>
            </div>
          )}
          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              justifyContent: "flex-end",
            }}
          >
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Adding…" : "Add Food"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Macro Rings for Client Diet Plan ──────────────────────────────────────────
function ClientMacroRings({
  meals,
  goals,
}: {
  meals: MealDraft[];
  goals: ClientGoals | null;
}) {
  if (!goals || goals.calories_target === 0) return null;
  const allItems = meals.flatMap((m) => m.items);
  const totCal = allItems.reduce(
    (s, i) =>
      s +
      (i.food
        ? i.food.calories_per_serving * macroScale(i.food, i.quantity)
        : 0),
    0
  );
  const totP = allItems.reduce(
    (s, i) =>
      s +
      (i.food
        ? i.food.protein_per_serving * macroScale(i.food, i.quantity)
        : 0),
    0
  );
  const totC = allItems.reduce(
    (s, i) =>
      s +
      (i.food ? i.food.carbs_per_serving * macroScale(i.food, i.quantity) : 0),
    0
  );
  const totF = allItems.reduce(
    (s, i) =>
      s +
      (i.food ? i.food.fat_per_serving * macroScale(i.food, i.quantity) : 0),
    0
  );
  const macros = [
    {
      label: "Calories",
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
      color: "#facc15",
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
    <div className="card" style={{ marginBottom: "1.25rem" }}>
      <div
        style={{
          fontFamily: "Syne, sans-serif",
          fontWeight: 700,
          fontSize: 14,
          marginBottom: "0.85rem",
        }}
      >
        📊 Plan Macro Preview (vs client targets)
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "0.5rem",
        }}
      >
        {macros.map(({ label, val, target, unit, color }) => {
          const pct =
            target > 0 ? Math.min(100, Math.round((val / target) * 100)) : 0;
          const r = 24,
            circ = 2 * Math.PI * r,
            offset = circ - (pct / 100) * circ;
          const over = val > target && target > 0;
          return (
            <div
              key={label}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
              }}
            >
              <svg width={60} height={60} viewBox="0 0 60 60">
                <circle
                  cx={30}
                  cy={30}
                  r={r}
                  fill="none"
                  stroke="var(--surface2)"
                  strokeWidth={5}
                />
                <circle
                  cx={30}
                  cy={30}
                  r={r}
                  fill="none"
                  stroke={over ? "var(--red)" : color}
                  strokeWidth={5}
                  strokeDasharray={circ}
                  strokeDashoffset={offset}
                  strokeLinecap="round"
                  transform="rotate(-90 30 30)"
                  style={{ transition: "stroke-dashoffset 0.5s" }}
                />
                <text
                  x={30}
                  y={30}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="currentColor"
                  fontSize={10}
                  fontWeight={700}
                >
                  {pct}%
                </text>
              </svg>
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: over ? "var(--red)" : color,
                  }}
                >
                  {val}
                  {unit}
                </div>
                <div style={{ fontSize: 10, color: "var(--muted)" }}>
                  {label}
                </div>
                <div style={{ fontSize: 10, color: "var(--muted)" }}>
                  / {target}
                  {unit}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Copy Plan Modal ────────────────────────────────────────────────────────────
function CopyPlanModal({
  type,
  planDates,
  currentDate,
  onClose,
  onCopy,
}: {
  type: CopyPlanType;
  planDates: Set<string>;
  currentDate: string;
  onClose: () => void;
  onCopy: (fromDate: string) => Promise<void>;
}) {
  const availableDates = Array.from(planDates)
    .filter((d) => d !== currentDate)
    .sort((a, b) => b.localeCompare(a));
  const [selected, setSelected] = useState<string>(availableDates[0] || "");
  const [copying, setCopying] = useState(false);
  async function handleCopy() {
    if (!selected) return;
    setCopying(true);
    await onCopy(selected);
    setCopying(false);
  }
  const typeLabel = type === "diet" ? "Diet" : "Workout";
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 420, width: "95vw" }}
      >
        <div className="modal-title">
          {type === "diet" ? "🥗" : "🏋️"} Copy {typeLabel} Plan
        </div>
        <p
          style={{
            color: "var(--muted)",
            fontSize: 14,
            marginBottom: "1.25rem",
            marginTop: 0,
          }}
        >
          Select a date to copy the {typeLabel.toLowerCase()} plan from. It will
          replace the current plan for{" "}
          <strong style={{ color: "var(--accent)" }}>
            {new Date(currentDate + "T00:00:00").toLocaleDateString("en-GB", {
              weekday: "short",
              day: "numeric",
              month: "short",
            })}
          </strong>
          .
        </p>
        {availableDates.length === 0 ? (
          <div
            style={{
              background: "var(--surface2)",
              borderRadius: 10,
              padding: "1.5rem",
              textAlign: "center",
              color: "var(--muted)",
              fontSize: 14,
              marginBottom: "1rem",
            }}
          >
            No other planned dates found.
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.4rem",
              maxHeight: 280,
              overflowY: "auto",
              marginBottom: "1.25rem",
            }}
          >
            {availableDates.map((date) => {
              const display = new Date(date + "T00:00:00").toLocaleDateString(
                "en-GB",
                {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                }
              );
              const isSelected = date === selected;
              return (
                <button
                  key={date}
                  onClick={() => setSelected(date)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "0.65rem 0.9rem",
                    borderRadius: 10,
                    cursor: "pointer",
                    textAlign: "left",
                    color: "inherit",
                    border: isSelected
                      ? "2px solid var(--accent)"
                      : "1px solid var(--border)",
                    background: isSelected
                      ? "rgba(124,106,247,0.1)"
                      : "var(--surface2)",
                  }}
                >
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      flexShrink: 0,
                      border: isSelected
                        ? "5px solid var(--accent)"
                        : "2px solid var(--border)",
                      background: isSelected ? "var(--accent)" : "transparent",
                    }}
                  />
                  <div>
                    <div
                      style={{
                        fontWeight: isSelected ? 700 : 400,
                        fontSize: 14,
                      }}
                    >
                      {display}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--muted)",
                        marginTop: 1,
                      }}
                    >
                      {date}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
        {availableDates.length > 0 && (
          <div
            style={{
              background: "rgba(248,113,113,0.08)",
              border: "1px solid rgba(248,113,113,0.2)",
              borderRadius: 8,
              padding: "0.6rem 0.9rem",
              fontSize: 12,
              color: "#f87171",
              marginBottom: "1.25rem",
            }}
          >
            ⚠️ This will overwrite the existing {typeLabel.toLowerCase()} plan
            for the selected date.
          </div>
        )}
        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            justifyContent: "flex-end",
          }}
        >
          <button className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleCopy}
            disabled={copying || !selected || availableDates.length === 0}
          >
            {copying ? "Copying…" : `Copy ${typeLabel} Plan`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Coach Component ────────────────────────────────────────────────────────────
export default function Coach() {
  const nav = useNavigate();
  const coachId = localStorage.getItem("coach_id") || "";
  const coachName = localStorage.getItem("coach_name") || "Coach";

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [view, setView] = useState<CoachView>("clients");
  const [showSelfJourney, setShowSelfJourney] = useState(false);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientRow | null>(null);
  const [foods, setFoods] = useState<Food[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const [connectCode, setConnectCode] = useState("");
  const [connecting, setConnecting] = useState(false);

  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [planTab, setPlanTab] = useState<PlanTab>("diet");
  const [planDates, setPlanDates] = useState<Set<string>>(new Set());
  const [calendarOpen, setCalendarOpen] = useState(true);

  const [meals, setMeals] = useState<MealDraft[]>([]);
  const [dietNote, setDietNote] = useState("");
  const [savingDiet, setSavingDiet] = useState(false);

  const [workoutItems, setWorkoutItems] = useState<WorkoutItemDraft[]>([]);
  const [savingWorkout, setSavingWorkout] = useState(false);

  const [clientProgress, setClientProgress] = useState<ProgressEntry[]>([]);

  const [showAddFood, setShowAddFood] = useState(false);
  const [foodSearch, setFoodSearch] = useState("");
  const [showCopyModal, setShowCopyModal] = useState<CopyPlanType | null>(null);

  const [clientGoals, setClientGoals] = useState<ClientGoals | null>(null);
  const [goalsForm, setGoalsForm] = useState({
    calories_target: "",
    protein_target: "",
    carbs_target: "",
    fat_target: "",
    show_macros_to_client: false,
  });
  const [savingGoals, setSavingGoals] = useState(false);

  const [showAddExercise, setShowAddExercise] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [newExercise, setNewExercise] = useState({
    name: "",
    muscle_group: "",
    notes: "",
  });
  const [savingExercise, setSavingExercise] = useState(false);

  // ── NEW: Client search / sort ──────────────────────────────────────────────
  const [clientSearch, setClientSearch] = useState("");
  const [clientSort, setClientSort] = useState<"name" | "recent">("name");

  // ── NEW: Weekly photos ─────────────────────────────────────────────────────
  const [weeklyPhotos, setWeeklyPhotos] = useState<WeeklyPhoto[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);

  // ── NEW: Chat overlay ──────────────────────────────────────────────────────
  const [chatOpen, setChatOpen] = useState(false);
  const [chatClientId, setChatClientId] = useState("");
  const [chatClientName, setChatClientName] = useState("");

  useEffect(() => {
    if (!coachId) {
      nav("/");
      return;
    }
    loadBase();
  }, [coachId]);

  async function loadBase() {
    setLoading(true);
    const [{ data: cl }, { data: fo }, { data: ex }] = await Promise.all([
      supabase.from("clients").select("*").eq("coach_id", coachId),
      supabase.from("foods").select("*").order("name"),
      supabase.from("exercises").select("*").order("name"),
    ]);
    setClients(cl || []);
    setFoods(fo || []);
    setExercises(ex || []);
    setLoading(false);
  }

  async function loadClientDates(clientId: string) {
    const [{ data: pd }, { data: wpd }] = await Promise.all([
      supabase.from("plan_days").select("plan_date").eq("client_id", clientId),
      supabase
        .from("workout_plan_days")
        .select("plan_date")
        .eq("client_id", clientId),
    ]);
    const dates = new Set<string>();
    (pd || []).forEach((r: any) => dates.add(r.plan_date));
    (wpd || []).forEach((r: any) => dates.add(r.plan_date));
    setPlanDates(dates);
  }

  async function loadPlanForDate(clientId: string, date: string) {
    setLoadingPlan(true);
    const { data: pd } = await supabase
      .from("plan_days")
      .select("*, meals(*, meal_items(*, foods(*)))")
      .eq("client_id", clientId)
      .eq("plan_date", date)
      .maybeSingle();
    if (pd) {
      setDietNote(pd.diet_note || "");
      const sm = [...(pd.meals || [])].sort(
        (a: any, b: any) => a.display_order - b.display_order
      );
      setMeals(
        sm.map((m: any) => ({
          meal_name: m.meal_name,
          items: (m.meal_items || []).map((i: any) => ({
            food_id: i.food_id,
            quantity: i.quantity,
            unit: i.unit,
            food: i.foods,
          })),
        }))
      );
    } else {
      setDietNote("");
      setMeals([]);
    }

    const { data: wpd } = await supabase
      .from("workout_plan_days")
      .select("*, workout_day_items(*, exercises(*))")
      .eq("client_id", clientId)
      .eq("plan_date", date)
      .maybeSingle();
    if (wpd) {
      const sw = [...(wpd.workout_day_items || [])].sort(
        (a: any, b: any) => a.display_order - b.display_order
      );
      setWorkoutItems(
        sw.map((i: any) => ({
          exercise_id: i.exercise_id,
          sets: i.sets,
          reps: i.reps,
          weight_kg: i.weight_kg,
          exercise: i.exercises,
        }))
      );
    } else {
      setWorkoutItems([]);
    }
    setLoadingPlan(false);
  }

  async function loadClientProgress(clientId: string) {
    const { data } = await supabase
      .from("progress_entries")
      .select("*")
      .eq("client_id", clientId)
      .order("date", { ascending: false })
      .limit(30);
    setClientProgress(data || []);
  }

  async function loadClientGoals(clientId: string) {
    const { data } = await supabase
      .from("client_goals")
      .select("*")
      .eq("client_id", clientId)
      .maybeSingle();
    if (data) {
      setClientGoals(data);
      setGoalsForm({
        calories_target: String(data.calories_target || ""),
        protein_target: String(data.protein_target || ""),
        carbs_target: String(data.carbs_target || ""),
        fat_target: String(data.fat_target || ""),
        show_macros_to_client: data.show_macros_to_client || false,
      });
    } else {
      setClientGoals(null);
      setGoalsForm({
        calories_target: "",
        protein_target: "",
        carbs_target: "",
        fat_target: "",
        show_macros_to_client: false,
      });
    }
  }

  // ── NEW: Load weekly progress photos ──────────────────────────────────────
  async function loadWeeklyPhotos(clientId: string) {
    setLoadingPhotos(true);
    const { data } = await supabase
      .from("weekly_progress_photos")
      .select("*")
      .eq("client_id", clientId)
      .order("week_start", { ascending: false });
    setWeeklyPhotos(data || []);
    setLoadingPhotos(false);
  }

  // ── NEW: Download single photo ─────────────────────────────────────────────
  async function downloadPhoto(url: string, filename: string) {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(url, "_blank");
    }
  }

  // ── NEW: Download all photos ───────────────────────────────────────────────
  async function downloadAllPhotos() {
    if (!weeklyPhotos.length) return;
    for (let i = 0; i < weeklyPhotos.length; i++) {
      const p = weeklyPhotos[i];
      await downloadPhoto(
        p.photo_url,
        `${selectedClient?.name ?? "client"}-week-${p.week_start}.jpg`
      );
      if (i < weeklyPhotos.length - 1)
        await new Promise((r) => setTimeout(r, 600));
    }
    flash("All photos downloaded!");
  }

  // ── NEW: Delete food item ──────────────────────────────────────────────────
  async function deleteFoodItem(foodId: string, foodName: string) {
    if (
      !confirm(
        `Delete "${foodName}" from the food database?\nThis cannot be undone and may affect existing plans.`
      )
    )
      return;
    const { error: de } = await supabase
      .from("foods")
      .delete()
      .eq("id", foodId);
    if (de) {
      setError(de.message);
      return;
    }
    setFoods((prev) => prev.filter((f) => f.id !== foodId));
    flash(`"${foodName}" deleted.`);
  }

  // ── NEW: Delete exercise item ──────────────────────────────────────────────
  async function deleteExerciseItem(exerciseId: string, exerciseName: string) {
    if (
      !confirm(
        `Delete "${exerciseName}" from the exercise library?\nThis cannot be undone and may affect existing workout plans.`
      )
    )
      return;
    const { error: de } = await supabase
      .from("exercises")
      .delete()
      .eq("id", exerciseId);
    if (de) {
      setError(de.message);
      return;
    }
    setExercises((prev) => prev.filter((e) => e.id !== exerciseId));
    flash(`"${exerciseName}" deleted.`);
  }

  async function saveClientGoals() {
    if (!selectedClient) return;
    setSavingGoals(true);
    const payload = {
      client_id: selectedClient.id,
      calories_target: parseFloat(goalsForm.calories_target) || 0,
      protein_target: parseFloat(goalsForm.protein_target) || 0,
      carbs_target: parseFloat(goalsForm.carbs_target) || 0,
      fat_target: parseFloat(goalsForm.fat_target) || 0,
      show_macros_to_client: goalsForm.show_macros_to_client,
    };
    const { data, error: ge } = await supabase
      .from("client_goals")
      .upsert(payload, { onConflict: "client_id" })
      .select()
      .single();
    if (ge) setError(ge.message);
    else {
      setClientGoals(data);
      flash("Goals saved!");
    }
    setSavingGoals(false);
  }

  async function openClient(c: ClientRow) {
    setSelectedClient(c);
    setView("client_detail");
    setPlanTab("diet");
    setSidebarOpen(false);
    const today = todayStr();
    setSelectedDate(today);
    await Promise.all([
      loadClientDates(c.id),
      loadPlanForDate(c.id, today),
      loadClientProgress(c.id),
      loadClientGoals(c.id),
      loadWeeklyPhotos(c.id), // ← NEW
    ]);
  }

  async function handleDateSelect(date: string) {
    setSelectedDate(date);
    setCalendarOpen(false);
    if (selectedClient) await loadPlanForDate(selectedClient.id, date);
  }

  async function connectClient() {
    setConnecting(true);
    setError("");
    const code = connectCode.trim().toUpperCase();
    const { data: found, error: fe } = await supabase
      .from("clients")
      .select("*")
      .eq("connection_code", code)
      .single();
    if (fe || !found) {
      setError("Code not found.");
      setConnecting(false);
      return;
    }
    if (found.coach_id) {
      setError("Already connected to another coach.");
      setConnecting(false);
      return;
    }
    const { error: ue } = await supabase
      .from("clients")
      .update({ coach_id: coachId })
      .eq("id", found.id);
    if (ue) {
      setError(ue.message);
      setConnecting(false);
      return;
    }
    setConnectCode("");
    flash("✓ " + found.name + " connected!");
    await loadBase();
    setConnecting(false);
  }

  async function saveDietPlan() {
    if (!selectedClient) return;
    setSavingDiet(true);
    const { data: pd, error: pe } = await supabase
      .from("plan_days")
      .upsert(
        {
          client_id: selectedClient.id,
          coach_id: coachId,
          plan_date: selectedDate,
          diet_note: dietNote,
        },
        { onConflict: "client_id,plan_date" }
      )
      .select()
      .single();
    if (pe) {
      setError(pe.message);
      setSavingDiet(false);
      return;
    }
    const { data: oldMeals } = await supabase
      .from("meals")
      .select("id")
      .eq("plan_day_id", pd.id);
    if (oldMeals?.length) {
      await supabase
        .from("meal_items")
        .delete()
        .in(
          "meal_id",
          oldMeals.map((m: any) => m.id)
        );
      await supabase.from("meals").delete().eq("plan_day_id", pd.id);
    }
    for (let mi = 0; mi < meals.length; mi++) {
      const m = meals[mi];
      const { data: mRow } = await supabase
        .from("meals")
        .insert({
          plan_day_id: pd.id,
          meal_name: m.meal_name,
          meal_number: mi + 1,
          display_order: mi + 1,
        })
        .select()
        .single();
      if (mRow && m.items.length > 0) {
        await supabase
          .from("meal_items")
          .insert(
            m.items.map((i) => ({
              meal_id: mRow.id,
              food_id: i.food_id,
              quantity: i.quantity,
              unit: i.unit,
            }))
          );
      }
    }
    setPlanDates((prev) => new Set([...prev, selectedDate]));
    flash("Diet plan saved!");
    setSavingDiet(false);
  }

  async function deleteDietPlan() {
    if (!selectedClient) return;
    if (
      !confirm(
        `Delete diet plan for ${new Date(
          selectedDate + "T00:00:00"
        ).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}?`
      )
    )
      return;
    const { data: pd } = await supabase
      .from("plan_days")
      .select("id")
      .eq("client_id", selectedClient.id)
      .eq("plan_date", selectedDate)
      .maybeSingle();
    if (pd) {
      const { data: oldMeals } = await supabase
        .from("meals")
        .select("id")
        .eq("plan_day_id", pd.id);
      if (oldMeals?.length) {
        await supabase
          .from("meal_items")
          .delete()
          .in(
            "meal_id",
            oldMeals.map((m: any) => m.id)
          );
        await supabase.from("meals").delete().eq("plan_day_id", pd.id);
      }
      await supabase.from("plan_days").delete().eq("id", pd.id);
      await supabase
        .from("meal_completions")
        .delete()
        .eq("client_id", selectedClient.id)
        .eq("completed_date", selectedDate);
    }
    setMeals([]);
    setDietNote("");
    await loadClientDates(selectedClient.id);
    flash("Diet plan removed.");
  }

  async function saveWorkoutPlan() {
    if (!selectedClient) return;
    setSavingWorkout(true);
    const { data: wpd, error: we } = await supabase
      .from("workout_plan_days")
      .upsert(
        {
          client_id: selectedClient.id,
          coach_id: coachId,
          plan_date: selectedDate,
        },
        { onConflict: "client_id,plan_date" }
      )
      .select()
      .single();
    if (we) {
      setError(we.message);
      setSavingWorkout(false);
      return;
    }
    await supabase
      .from("workout_day_items")
      .delete()
      .eq("workout_plan_day_id", wpd.id);
    if (workoutItems.length > 0) {
      await supabase
        .from("workout_day_items")
        .insert(
          workoutItems.map((i, idx) => ({
            workout_plan_day_id: wpd.id,
            exercise_id: i.exercise_id,
            sets: i.sets,
            reps: i.reps,
            weight_kg: i.weight_kg || null,
            display_order: idx + 1,
          }))
        );
    }
    setPlanDates((prev) => new Set([...prev, selectedDate]));
    flash("Workout plan saved!");
    setSavingWorkout(false);
  }

  async function deleteWorkoutPlan() {
    if (!selectedClient) return;
    if (
      !confirm(
        `Delete workout plan for ${new Date(
          selectedDate + "T00:00:00"
        ).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}?`
      )
    )
      return;
    const { data: wpd } = await supabase
      .from("workout_plan_days")
      .select("id")
      .eq("client_id", selectedClient.id)
      .eq("plan_date", selectedDate)
      .maybeSingle();
    if (wpd) {
      await supabase
        .from("workout_day_items")
        .delete()
        .eq("workout_plan_day_id", wpd.id);
      await supabase.from("workout_plan_days").delete().eq("id", wpd.id);
      await supabase
        .from("workout_completions")
        .delete()
        .eq("client_id", selectedClient.id)
        .eq("completed_date", selectedDate);
    }
    setWorkoutItems([]);
    await loadClientDates(selectedClient.id);
    flash("Workout plan removed.");
  }

  async function handleCopyDietPlan(fromDate: string) {
    if (!selectedClient) return;
    const { data: pd } = await supabase
      .from("plan_days")
      .select("*, meals(*, meal_items(*, foods(*)))")
      .eq("client_id", selectedClient.id)
      .eq("plan_date", fromDate)
      .maybeSingle();
    if (!pd) {
      setError("No diet plan found for that date.");
      setShowCopyModal(null);
      return;
    }
    setDietNote(pd.diet_note || "");
    const sm = [...(pd.meals || [])].sort(
      (a: any, b: any) => a.display_order - b.display_order
    );
    setMeals(
      sm.map((m: any) => ({
        meal_name: m.meal_name,
        items: (m.meal_items || []).map((i: any) => ({
          food_id: i.food_id,
          quantity: i.quantity,
          unit: i.unit,
          food: i.foods,
        })),
      }))
    );
    setShowCopyModal(null);
    flash(
      `✓ Diet copied from ${new Date(fromDate + "T00:00:00").toLocaleDateString(
        "en-GB",
        { day: "numeric", month: "short" }
      )} — remember to save!`
    );
  }

  async function handleCopyWorkoutPlan(fromDate: string) {
    if (!selectedClient) return;
    const { data: wpd } = await supabase
      .from("workout_plan_days")
      .select("*, workout_day_items(*, exercises(*))")
      .eq("client_id", selectedClient.id)
      .eq("plan_date", fromDate)
      .maybeSingle();
    if (!wpd) {
      setError("No workout plan found for that date.");
      setShowCopyModal(null);
      return;
    }
    const sw = [...(wpd.workout_day_items || [])].sort(
      (a: any, b: any) => a.display_order - b.display_order
    );
    setWorkoutItems(
      sw.map((i: any) => ({
        exercise_id: i.exercise_id,
        sets: i.sets,
        reps: i.reps,
        weight_kg: i.weight_kg,
        exercise: i.exercises,
      }))
    );
    setShowCopyModal(null);
    flash(
      `✓ Workout copied from ${new Date(
        fromDate + "T00:00:00"
      ).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
      })} — remember to save!`
    );
  }

  async function handleAddFood(form: NewFoodState) {
    const { data, error: fe } = await supabase
      .from("foods")
      .insert({
        name: form.name,
        serving_size: parseFloat(form.serving_size),
        serving_unit: form.serving_unit.trim(),
        calories_per_serving: parseFloat(form.calories_per_serving),
        protein_per_serving: parseFloat(form.protein_per_serving),
        carbs_per_serving: parseFloat(form.carbs_per_serving),
        fat_per_serving: parseFloat(form.fat_per_serving),
      })
      .select()
      .single();
    if (fe) {
      setError(fe.message);
      return;
    }
    setFoods((prev) =>
      [...prev, data].sort((a, b) => a.name.localeCompare(b.name))
    );
    setShowAddFood(false);
    flash("Food added!");
  }

  async function handleAddExercise() {
    if (!newExercise.name.trim()) return;
    setSavingExercise(true);
    const { data, error: ee } = await supabase
      .from("exercises")
      .insert({
        name: newExercise.name.trim(),
        muscle_group: newExercise.muscle_group.trim(),
        notes: newExercise.notes.trim(),
      })
      .select()
      .single();
    if (ee) {
      setError(ee.message);
    } else {
      setExercises((prev) =>
        [...prev, data].sort((a, b) => a.name.localeCompare(b.name))
      );
      setNewExercise({ name: "", muscle_group: "", notes: "" });
      setShowAddExercise(false);
      flash("Exercise added!");
    }
    setSavingExercise(false);
  }

  function flash(m: string) {
    setMsg(m);
    setTimeout(() => setMsg(""), 3500);
  }

  const MEAL_NAMES = [
    "Breakfast",
    "Mid-Morning Snack",
    "Lunch",
    "Evening Snack",
    "Dinner",
    "Pre-Workout",
    "Post-Workout",
  ];

  function addMeal() {
    setMeals((prev) => [
      ...prev,
      {
        meal_name: MEAL_NAMES[prev.length] || `Meal ${prev.length + 1}`,
        items: [],
      },
    ]);
  }
  function removeMeal(mi: number) {
    setMeals((prev) => prev.filter((_, i) => i !== mi));
  }
  function addMealItem(mi: number) {
    if (!foods.length) return;
    const f = foods[0];
    setMeals((prev) =>
      prev.map((m, i) =>
        i !== mi
          ? m
          : {
              ...m,
              items: [
                ...m.items,
                {
                  food_id: f.id,
                  quantity: f.serving_size,
                  unit: f.serving_unit,
                  food: f,
                },
              ],
            }
      )
    );
  }
  function updateMealItem(mi: number, ii: number, field: string, value: any) {
    setMeals((prev) =>
      prev.map((m, i) => {
        if (i !== mi) return m;
        const items = m.items.map((it, j) => {
          if (j !== ii) return it;
          if (field === "food_id") {
            const f = foods.find((x) => x.id === value);
            return {
              ...it,
              food_id: value,
              food: f,
              unit: f?.serving_unit || "unit",
              quantity: f?.serving_size || 1,
            };
          }
          return { ...it, [field]: value };
        });
        return { ...m, items };
      })
    );
  }
  function removeMealItem(mi: number, ii: number) {
    setMeals((prev) =>
      prev.map((m, i) =>
        i !== mi ? m : { ...m, items: m.items.filter((_, j) => j !== ii) }
      )
    );
  }
  function addWorkoutItem() {
    if (!exercises.length) return;
    const ex = exercises[0];
    setWorkoutItems((prev) => [
      ...prev,
      { exercise_id: ex.id, sets: 3, reps: 10, weight_kg: null, exercise: ex },
    ]);
  }
  function updateWorkoutItem(idx: number, field: string, value: any) {
    setWorkoutItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        if (field === "exercise_id") {
          const ex = exercises.find((x) => x.id === value);
          return { ...it, exercise_id: value, exercise: ex };
        }
        return { ...it, [field]: value };
      })
    );
  }

  function handleLogout() {
    localStorage.clear();
    supabase.auth.signOut();
    nav("/");
  }
  function navTo(v: CoachView) {
    setView(v);
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

  if (showSelfJourney) {
    return (
      <CoachSelf
        coachId={coachId}
        coachName={coachName}
        foods={foods}
        exercises={exercises}
        onClose={() => setShowSelfJourney(false)}
      />
    );
  }

  const selDateDisplay = new Date(
    selectedDate + "T00:00:00"
  ).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const avgDiet = clientProgress.length
    ? Math.round(
        clientProgress.reduce((s, p) => s + p.diet_progress, 0) /
          clientProgress.length
      )
    : 0;
  const avgWorkout = clientProgress.length
    ? Math.round(
        clientProgress.reduce((s, p) => s + p.workout_progress, 0) /
          clientProgress.length
      )
    : 0;
  const latestWeight = clientProgress.find((p) => p.weight_kg)?.weight_kg;
  const filteredFoods = foods.filter(
    (f) =>
      !foodSearch || f.name.toLowerCase().includes(foodSearch.toLowerCase())
  );

  // ── NEW: Filtered + sorted clients ────────────────────────────────────────
  const filteredClients = clients
    .filter(
      (c) =>
        !clientSearch ||
        c.name.toLowerCase().includes(clientSearch.toLowerCase())
    )
    .sort((a, b) =>
      clientSort === "name"
        ? a.name.localeCompare(b.name)
        : b.weight_kg - a.weight_kg
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
        <div style={{ padding: "0 0.75rem 0.75rem" }}>
          <button
            onClick={() => {
              setShowSelfJourney(true);
              setSidebarOpen(false);
            }}
            style={{
              width: "100%",
              padding: "0.65rem 0.85rem",
              borderRadius: 12,
              background:
                "linear-gradient(135deg, var(--accent) 0%, #a855f7 100%)",
              border: "none",
              color: "#fff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.65rem",
              fontFamily: "Syne, sans-serif",
              fontWeight: 700,
              fontSize: 13,
              boxShadow: "0 4px 14px rgba(124,106,247,0.35)",
            }}
          >
            <span style={{ fontSize: 18 }}>🏅</span>
            <div style={{ textAlign: "left" }}>
              <div>My Journey</div>
              <div style={{ fontSize: 10, fontWeight: 400, opacity: 0.8 }}>
                Track your own fitness
              </div>
            </div>
          </button>
        </div>
        <nav style={{ flex: 1, padding: "0.5rem" }}>
          <button
            className={`sidebar-item ${view === "clients" ? "active" : ""}`}
            style={{ width: "100%" }}
            onClick={() => navTo("clients")}
          >
            👥 My Clients
          </button>
          <button
            className={`sidebar-item ${view === "foods" ? "active" : ""}`}
            style={{ width: "100%" }}
            onClick={() => navTo("foods")}
          >
            🥑 Food Database
          </button>
          <button
            className={`sidebar-item ${view === "exercises" ? "active" : ""}`}
            style={{ width: "100%" }}
            onClick={() => navTo("exercises")}
          >
            🏃 Exercise Library
          </button>
        </nav>
        <div
          style={{
            padding: "1rem 0.5rem",
            borderTop: "1px solid var(--border)",
          }}
        >
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
        {msg && (
          <div className="alert alert-success" style={{ marginBottom: "1rem" }}>
            {msg}
          </div>
        )}
        {error && (
          <div
            className="alert alert-error"
            style={{
              marginBottom: "1rem",
              display: "flex",
              justifyContent: "space-between",
              cursor: "pointer",
            }}
            onClick={() => setError("")}
          >
            <span>{error}</span>
            <span>✕</span>
          </div>
        )}

        {/* ── CLIENTS VIEW ── */}
        {view === "clients" && (
          <>
            <div className="main-header">
              <h2>My Clients</h2>
              <p>
                {clients.length} connected client
                {clients.length !== 1 ? "s" : ""}
              </p>
            </div>

            {/* Coach self journey card */}
            <div
              onClick={() => setShowSelfJourney(true)}
              style={{
                background:
                  "linear-gradient(135deg, rgba(124,106,247,0.15) 0%, rgba(168,85,247,0.1) 100%)",
                border: "2px solid var(--accent)",
                borderRadius: 14,
                padding: "1rem 1.25rem",
                marginBottom: "1.5rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                transition: "all 0.15s",
                position: "relative",
                overflow: "hidden",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.transform = "translateY(-1px)")
              }
              onMouseLeave={(e) => (e.currentTarget.style.transform = "none")}
            >
              <div
                style={{
                  position: "absolute",
                  top: -20,
                  right: -20,
                  width: 80,
                  height: 80,
                  borderRadius: "50%",
                  background: "var(--accent)",
                  opacity: 0.08,
                  filter: "blur(20px)",
                }}
              />
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  flexShrink: 0,
                  background:
                    "linear-gradient(135deg, var(--accent) 0%, #a855f7 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                  boxShadow: "0 4px 14px rgba(124,106,247,0.4)",
                }}
              >
                🏅
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontFamily: "Syne, sans-serif",
                    fontWeight: 800,
                    fontSize: "1.05rem",
                    color: "var(--accent)",
                  }}
                >
                  {coachName}
                  <span
                    style={{
                      marginLeft: "0.5rem",
                      fontSize: 11,
                      fontWeight: 500,
                      background: "var(--accent)",
                      color: "#fff",
                      padding: "2px 8px",
                      borderRadius: 20,
                    }}
                  >
                    YOU
                  </span>
                </div>
                <div
                  style={{ color: "var(--muted)", fontSize: 13, marginTop: 2 }}
                >
                  Track your own diet, workouts & progress
                </div>
              </div>
              <div
                style={{
                  padding: "0.4rem 0.9rem",
                  borderRadius: 8,
                  background: "var(--accent)",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                Open →
              </div>
            </div>

            {/* Connect client */}
            <div className="card" style={{ marginBottom: "1.5rem" }}>
              <div className="section-title">Connect a Client</div>
              <p
                style={{
                  color: "var(--muted)",
                  fontSize: 14,
                  marginBottom: "1rem",
                }}
              >
                Enter the 6-character code from your client's signup.
              </p>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <input
                  className="input"
                  style={{
                    textTransform: "uppercase",
                    letterSpacing: "0.2em",
                    fontSize: "1.1rem",
                    flex: 1,
                  }}
                  placeholder="ABC123"
                  maxLength={6}
                  value={connectCode}
                  onChange={(e) => setConnectCode(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" &&
                    connectCode.length >= 6 &&
                    connectClient()
                  }
                />
                <button
                  className="btn btn-primary"
                  onClick={connectClient}
                  disabled={connecting || connectCode.length < 6}
                >
                  {connecting ? "…" : "Connect"}
                </button>
              </div>
            </div>

            {/* ── NEW: Search + Sort bar ── */}
            {clients.length > 0 && (
              <div
                style={{
                  display: "flex",
                  gap: "0.75rem",
                  marginBottom: "1rem",
                  flexWrap: "wrap",
                }}
              >
                <input
                  className="input"
                  style={{ flex: 1, minWidth: 180 }}
                  placeholder="Search clients…"
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                />
                <div style={{ display: "flex", gap: "0.4rem" }}>
                  {(["name", "recent"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setClientSort(s)}
                      style={{
                        padding: "0 0.85rem",
                        height: 42,
                        borderRadius: 10,
                        cursor: "pointer",
                        fontWeight: 600,
                        fontSize: 13,
                        border:
                          clientSort === s
                            ? "2px solid var(--accent)"
                            : "1px solid var(--border)",
                        background:
                          clientSort === s
                            ? "rgba(124,106,247,0.15)"
                            : "var(--surface2)",
                        color:
                          clientSort === s ? "var(--accent)" : "var(--muted)",
                      }}
                    >
                      {s === "name" ? "A–Z" : "Recent"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {filteredClients.length === 0 && clients.length === 0 ? (
              <div
                className="card"
                style={{
                  textAlign: "center",
                  padding: "3rem",
                  color: "var(--muted)",
                }}
              >
                No clients yet. Connect your first client above.
              </div>
            ) : filteredClients.length === 0 ? (
              <div
                className="card"
                style={{
                  textAlign: "center",
                  padding: "2rem",
                  color: "var(--muted)",
                }}
              >
                No clients match "{clientSearch}".
              </div>
            ) : (
              <div style={{ display: "grid", gap: "0.75rem" }}>
                {filteredClients.map((c) => (
                  <div
                    key={c.id}
                    className="card"
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      cursor: "pointer",
                    }}
                    onClick={() => openClient(c)}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.borderColor = "var(--accent)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.borderColor = "var(--border)")
                    }
                  >
                    <div>
                      <div
                        style={{
                          fontFamily: "Syne,sans-serif",
                          fontWeight: 700,
                          fontSize: "1.05rem",
                        }}
                      >
                        {c.name}
                      </div>
                      <div style={{ color: "var(--muted)", fontSize: 13 }}>
                        Age {c.age} · {c.height_cm} cm · {c.weight_kg} kg
                      </div>
                    </div>
                    <button className="btn btn-outline btn-sm">Open →</button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── CLIENT DETAIL ── */}
        {view === "client_detail" && selectedClient && (
          <>
            <div
              style={{
                display: "flex",
                gap: "0.75rem",
                alignItems: "center",
                marginBottom: "1.25rem",
                flexWrap: "wrap",
              }}
            >
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setView("clients")}
              >
                ← Back
              </button>
              <div style={{ flex: 1 }}>
                <h2 style={{ margin: 0 }}>{selectedClient.name}</h2>
                <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>
                  Age {selectedClient.age} · {selectedClient.height_cm} cm ·{" "}
                  {selectedClient.weight_kg} kg
                </p>
              </div>
              {/* ── NEW: Chat button ── */}
              <button
                className="btn btn-outline btn-sm"
                style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
                onClick={() => {
                  setChatClientId(selectedClient.id);
                  setChatClientName(selectedClient.name);
                  setChatOpen(true);
                }}
              >
                💬 Chat
              </button>
            </div>

            {/* Calendar */}
            <div
              className="card"
              style={{ marginBottom: "1.25rem", padding: "0.85rem 1rem" }}
            >
              <button
                onClick={() => setCalendarOpen((o) => !o)}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  width: "100%",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  color: "inherit",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                  }}
                >
                  <span style={{ fontSize: 18 }}>📅</span>
                  <div style={{ textAlign: "left" }}>
                    <div
                      style={{
                        fontFamily: "Syne,sans-serif",
                        fontWeight: 700,
                        fontSize: "0.95rem",
                      }}
                    >
                      {selDateDisplay}
                    </div>
                    <div
                      style={{ display: "flex", gap: "0.35rem", marginTop: 3 }}
                    >
                      {planDates.has(selectedDate) && (
                        <span className="badge badge-green">Has plan</span>
                      )}
                      {selectedDate === todayStr() && (
                        <span className="badge badge-orange">Today</span>
                      )}
                    </div>
                  </div>
                </div>
                <span
                  style={{
                    color: "var(--muted)",
                    fontSize: 16,
                    transform: calendarOpen ? "rotate(180deg)" : "none",
                    transition: "transform 0.2s",
                    marginLeft: "auto",
                  }}
                >
                  ▼
                </span>
              </button>
              {calendarOpen && (
                <div
                  style={{
                    marginTop: "1rem",
                    paddingTop: "1rem",
                    borderTop: "1px solid var(--border)",
                  }}
                >
                  <MiniCalendar
                    selected={selectedDate}
                    onSelect={handleDateSelect}
                    highlighted={planDates}
                  />
                </div>
              )}
            </div>

            {/* Plan tabs */}
            <div className="tab-bar" style={{ marginBottom: "1.25rem" }}>
              <button
                className={`tab ${planTab === "diet" ? "active" : ""}`}
                onClick={() => setPlanTab("diet")}
              >
                🥗 Diet
              </button>
              <button
                className={`tab ${planTab === "workout" ? "active" : ""}`}
                onClick={() => setPlanTab("workout")}
              >
                🏋️ Workout
              </button>
              <button
                className={`tab ${planTab === "progress" ? "active" : ""}`}
                onClick={() => setPlanTab("progress")}
              >
                📊 Progress
              </button>
              <button
                className={`tab ${planTab === "goals" ? "active" : ""}`}
                onClick={() => setPlanTab("goals")}
              >
                🎯 Goals
              </button>
              {/* ── NEW: Photos tab ── */}
              <button
                className={`tab ${planTab === "photos" ? "active" : ""}`}
                onClick={() => {
                  setPlanTab("photos");
                  if (selectedClient) loadWeeklyPhotos(selectedClient.id);
                }}
              >
                📸 Photos
              </button>
            </div>

            {loadingPlan && planTab !== "progress" && planTab !== "photos" ? (
              <div style={{ textAlign: "center", padding: "3rem" }}>
                <div className="spinner" />
              </div>
            ) : planTab === "diet" ? (
              <>
                {clientGoals && clientGoals.calories_target > 0 && (
                  <ClientMacroRings meals={meals} goals={clientGoals} />
                )}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "var(--surface2)",
                    borderRadius: 10,
                    padding: "0.6rem 0.9rem",
                    marginBottom: "1rem",
                    gap: "0.75rem",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ fontSize: 13, color: "var(--muted)" }}>
                    📋{" "}
                    <span style={{ color: "var(--text)" }}>
                      Reuse or manage plans
                    </span>
                  </div>
                  <div
                    style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}
                  >
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => setShowCopyModal("diet")}
                      disabled={planDates.size === 0}
                    >
                      Copy Plan
                    </button>
                    {meals.length > 0 && (
                      <button
                        className="btn btn-sm"
                        style={{
                          background: "rgba(248,113,113,0.15)",
                          color: "var(--red)",
                        }}
                        onClick={deleteDietPlan}
                      >
                        🗑 Remove
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ marginBottom: "1rem" }}>
                  <label className="label">Day Note (optional)</label>
                  <input
                    className="input"
                    placeholder="e.g. High carb day…"
                    value={dietNote}
                    onChange={(e) => setDietNote(e.target.value)}
                  />
                </div>
                {meals.length === 0 && (
                  <div
                    className="card"
                    style={{
                      textAlign: "center",
                      padding: "2rem",
                      color: "var(--muted)",
                      marginBottom: "1rem",
                    }}
                  >
                    No meals yet. Click "+ Add Meal" to build the plan.
                  </div>
                )}
                {meals.map((meal, mi) => {
                  const totalCal = meal.items.reduce(
                    (s, it) =>
                      s +
                      (it.food
                        ? it.food.calories_per_serving *
                          macroScale(it.food, it.quantity)
                        : 0),
                    0
                  );
                  const totalP = meal.items.reduce(
                    (s, it) =>
                      s +
                      (it.food
                        ? it.food.protein_per_serving *
                          macroScale(it.food, it.quantity)
                        : 0),
                    0
                  );
                  const totalC = meal.items.reduce(
                    (s, it) =>
                      s +
                      (it.food
                        ? it.food.carbs_per_serving *
                          macroScale(it.food, it.quantity)
                        : 0),
                    0
                  );
                  const totalF = meal.items.reduce(
                    (s, it) =>
                      s +
                      (it.food
                        ? it.food.fat_per_serving *
                          macroScale(it.food, it.quantity)
                        : 0),
                    0
                  );
                  return (
                    <div
                      key={mi}
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
                          gap: "0.6rem",
                          alignItems: "center",
                          padding: "0.75rem 0.9rem",
                          background: "var(--surface2)",
                          borderBottom: "1px solid var(--border)",
                        }}
                      >
                        <div
                          style={{
                            background: "var(--accent)",
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
                          {mi + 1}
                        </div>
                        <input
                          className="input"
                          style={{
                            flex: 1,
                            fontWeight: 600,
                            fontFamily: "Syne,sans-serif",
                          }}
                          value={meal.meal_name}
                          onChange={(e) =>
                            setMeals((prev) =>
                              prev.map((m, i) =>
                                i !== mi
                                  ? m
                                  : { ...m, meal_name: e.target.value }
                              )
                            )
                          }
                        />
                        <button
                          className="btn btn-sm"
                          style={{
                            background: "rgba(248,113,113,0.15)",
                            color: "var(--red)",
                            flexShrink: 0,
                          }}
                          onClick={() => removeMeal(mi)}
                        >
                          Remove
                        </button>
                      </div>
                      {meal.items.length > 0 && (
                        <div
                          style={{
                            display: "flex",
                            gap: "1rem",
                            padding: "0.45rem 1rem",
                            background: "rgba(124,106,247,0.05)",
                            borderBottom: "1px solid var(--border)",
                            fontSize: 12,
                            flexWrap: "wrap",
                          }}
                        >
                          <span
                            style={{ fontWeight: 700, color: "var(--accent)" }}
                          >
                            {Math.round(totalCal)} kcal
                          </span>
                          <span style={{ color: "#f87171" }}>
                            P {totalP.toFixed(1)}g
                          </span>
                          <span style={{ color: "#facc15" }}>
                            C {totalC.toFixed(1)}g
                          </span>
                          <span style={{ color: "var(--accent2)" }}>
                            F {totalF.toFixed(1)}g
                          </span>
                        </div>
                      )}
                      <div style={{ padding: "0.5rem 0.9rem" }}>
                        {meal.items.length === 0 && (
                          <p
                            style={{
                              color: "var(--muted)",
                              fontSize: 13,
                              marginBottom: "0.5rem",
                            }}
                          >
                            No foods yet.
                          </p>
                        )}
                        {meal.items.map((item, ii) => {
                          const food = item.food;
                          const itemCal = food
                            ? Math.round(
                                food.calories_per_serving *
                                  macroScale(food, item.quantity)
                              )
                            : 0;
                          return (
                            <div
                              key={ii}
                              style={{
                                background: "var(--bg,#0d0d18)",
                                borderRadius: 8,
                                padding: "0.6rem 0.7rem",
                                marginBottom: "0.5rem",
                              }}
                            >
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "1fr 80px 32px",
                                  gap: "0.4rem",
                                  alignItems: "center",
                                }}
                              >
                                <select
                                  className="input"
                                  style={{ fontSize: 13 }}
                                  value={item.food_id}
                                  onChange={(e) =>
                                    updateMealItem(
                                      mi,
                                      ii,
                                      "food_id",
                                      e.target.value
                                    )
                                  }
                                >
                                  {foods.map((fo) => (
                                    <option key={fo.id} value={fo.id}>
                                      {fo.name}
                                    </option>
                                  ))}
                                </select>
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 4,
                                  }}
                                >
                                  <input
                                    className="input"
                                    type="number"
                                    min="0.1"
                                    step="any"
                                    style={{
                                      fontSize: 13,
                                      flex: 1,
                                      minWidth: 0,
                                    }}
                                    value={item.quantity}
                                    onChange={(e) =>
                                      updateMealItem(
                                        mi,
                                        ii,
                                        "quantity",
                                        parseFloat(e.target.value) || 1
                                      )
                                    }
                                  />
                                  <span
                                    style={{
                                      fontSize: 11,
                                      color: "var(--muted)",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {item.unit || food?.serving_unit || ""}
                                  </span>
                                </div>
                                <button
                                  onClick={() => removeMealItem(mi, ii)}
                                  style={{
                                    background: "rgba(248,113,113,0.15)",
                                    color: "var(--red)",
                                    border: "none",
                                    borderRadius: 6,
                                    cursor: "pointer",
                                    fontWeight: 700,
                                    fontSize: 14,
                                    height: 36,
                                  }}
                                >
                                  ✕
                                </button>
                              </div>
                              {food && (
                                <div
                                  style={{
                                    fontSize: 11,
                                    color: "var(--muted)",
                                    marginTop: 5,
                                    display: "flex",
                                    gap: "0.75rem",
                                    flexWrap: "wrap",
                                  }}
                                >
                                  <span>
                                    {food.serving_size}
                                    {food.serving_unit} ={" "}
                                    {food.calories_per_serving} kcal · P{" "}
                                    {food.protein_per_serving}g · C{" "}
                                    {food.carbs_per_serving}g · F{" "}
                                    {food.fat_per_serving}g
                                  </span>
                                  {item.quantity !== food.serving_size && (
                                    <span
                                      style={{
                                        color: "var(--accent)",
                                        fontWeight: 600,
                                      }}
                                    >
                                      {item.quantity}
                                      {food.serving_unit} = {itemCal} kcal
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        <button
                          className="btn btn-outline btn-sm"
                          style={{ marginTop: "0.25rem" }}
                          onClick={() => addMealItem(mi)}
                        >
                          + Add Food
                        </button>
                      </div>
                    </div>
                  );
                })}
                {meals.length > 0 &&
                  (() => {
                    const allItems = meals.flatMap((m) => m.items);
                    const dayTotalCal = allItems.reduce(
                      (s, it) =>
                        s +
                        (it.food
                          ? it.food.calories_per_serving *
                            macroScale(it.food, it.quantity)
                          : 0),
                      0
                    );
                    const dayTotalP = allItems.reduce(
                      (s, it) =>
                        s +
                        (it.food
                          ? it.food.protein_per_serving *
                            macroScale(it.food, it.quantity)
                          : 0),
                      0
                    );
                    const dayTotalC = allItems.reduce(
                      (s, it) =>
                        s +
                        (it.food
                          ? it.food.carbs_per_serving *
                            macroScale(it.food, it.quantity)
                          : 0),
                      0
                    );
                    const dayTotalF = allItems.reduce(
                      (s, it) =>
                        s +
                        (it.food
                          ? it.food.fat_per_serving *
                            macroScale(it.food, it.quantity)
                          : 0),
                      0
                    );
                    return (
                      <div
                        className="card"
                        style={{
                          marginBottom: "1rem",
                          padding: "0.75rem 1rem",
                          display: "flex",
                          gap: "1rem",
                          flexWrap: "wrap",
                          alignItems: "center",
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "Syne,sans-serif",
                            fontWeight: 700,
                            fontSize: 13,
                          }}
                        >
                          Day Total
                        </span>
                        <span
                          style={{ fontWeight: 700, color: "var(--accent)" }}
                        >
                          {Math.round(dayTotalCal)} kcal
                        </span>
                        <span style={{ color: "#f87171" }}>
                          P {dayTotalP.toFixed(1)}g
                        </span>
                        <span style={{ color: "#facc15" }}>
                          C {dayTotalC.toFixed(1)}g
                        </span>
                        <span style={{ color: "var(--accent2)" }}>
                          F {dayTotalF.toFixed(1)}g
                        </span>
                      </div>
                    );
                  })()}
                <div
                  style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}
                >
                  <button className="btn btn-outline" onClick={addMeal}>
                    + Add Meal
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={saveDietPlan}
                    disabled={savingDiet}
                  >
                    {savingDiet ? "Saving…" : "💾 Save Diet Plan"}
                  </button>
                </div>
              </>
            ) : planTab === "workout" ? (
              <>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "var(--surface2)",
                    borderRadius: 10,
                    padding: "0.6rem 0.9rem",
                    marginBottom: "1rem",
                    gap: "0.75rem",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ fontSize: 13, color: "var(--muted)" }}>
                    📋{" "}
                    <span style={{ color: "var(--text)" }}>
                      Reuse or manage plans
                    </span>
                  </div>
                  <div
                    style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}
                  >
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => setShowCopyModal("workout")}
                      disabled={planDates.size === 0}
                    >
                      Copy Plan
                    </button>
                    {workoutItems.length > 0 && (
                      <button
                        className="btn btn-sm"
                        style={{
                          background: "rgba(248,113,113,0.15)",
                          color: "var(--red)",
                        }}
                        onClick={deleteWorkoutPlan}
                      >
                        🗑 Remove
                      </button>
                    )}
                  </div>
                </div>
                {workoutItems.length === 0 && (
                  <div
                    className="card"
                    style={{
                      textAlign: "center",
                      padding: "2rem",
                      color: "var(--muted)",
                      marginBottom: "1rem",
                    }}
                  >
                    No exercises yet. Click "+ Add Exercise".
                  </div>
                )}
                {workoutItems.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: "var(--surface2)",
                      borderRadius: 10,
                      padding: "0.75rem",
                      marginBottom: "0.5rem",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: "0.6rem",
                        alignItems: "center",
                        marginBottom: "0.5rem",
                      }}
                    >
                      <div
                        style={{
                          background: "rgba(124,106,247,0.15)",
                          color: "var(--accent)",
                          borderRadius: 8,
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
                        {idx + 1}
                      </div>
                      <select
                        className="input"
                        style={{ flex: 1 }}
                        value={item.exercise_id}
                        onChange={(e) =>
                          updateWorkoutItem(idx, "exercise_id", e.target.value)
                        }
                      >
                        {exercises.map((ex) => (
                          <option key={ex.id} value={ex.id}>
                            {ex.name}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() =>
                          setWorkoutItems((prev) =>
                            prev.filter((_, i) => i !== idx)
                          )
                        }
                        style={{
                          background: "rgba(248,113,113,0.15)",
                          color: "var(--red)",
                          border: "none",
                          borderRadius: 6,
                          cursor: "pointer",
                          padding: "4px 8px",
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        ✕
                      </button>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: "0.5rem",
                        alignItems: "center",
                        paddingLeft: 36,
                      }}
                    >
                      <input
                        className="input"
                        type="number"
                        style={{ width: 60 }}
                        placeholder="Sets"
                        value={item.sets}
                        onChange={(e) =>
                          updateWorkoutItem(
                            idx,
                            "sets",
                            parseInt(e.target.value) || 1
                          )
                        }
                      />
                      <span style={{ color: "var(--muted)", fontWeight: 700 }}>
                        ×
                      </span>
                      <input
                        className="input"
                        type="number"
                        style={{ width: 60 }}
                        placeholder="Reps"
                        value={item.reps}
                        onChange={(e) =>
                          updateWorkoutItem(
                            idx,
                            "reps",
                            parseInt(e.target.value) || 1
                          )
                        }
                      />
                      <input
                        className="input"
                        type="number"
                        style={{ width: 70 }}
                        placeholder="kg"
                        value={item.weight_kg ?? ""}
                        onChange={(e) =>
                          updateWorkoutItem(
                            idx,
                            "weight_kg",
                            parseFloat(e.target.value) || null
                          )
                        }
                      />
                      <span style={{ color: "var(--muted)", fontSize: 12 }}>
                        kg
                      </span>
                    </div>
                  </div>
                ))}
                <div
                  style={{
                    display: "flex",
                    gap: "0.75rem",
                    flexWrap: "wrap",
                    marginTop: "0.5rem",
                  }}
                >
                  <button className="btn btn-outline" onClick={addWorkoutItem}>
                    + Add Exercise
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={saveWorkoutPlan}
                    disabled={savingWorkout}
                  >
                    {savingWorkout ? "Saving…" : "💾 Save Workout Plan"}
                  </button>
                </div>
              </>
            ) : planTab === "goals" ? (
              <>
                <div className="card" style={{ marginBottom: "1.25rem" }}>
                  <div
                    className="section-title"
                    style={{ marginBottom: "1rem" }}
                  >
                    🎯 Daily Macro Targets
                  </div>
                  <p
                    style={{
                      color: "var(--muted)",
                      fontSize: 13,
                      marginBottom: "1rem",
                    }}
                  >
                    Set daily nutrition goals for {selectedClient?.name}.
                  </p>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "0.75rem",
                      marginBottom: "1rem",
                    }}
                  >
                    {[
                      {
                        key: "calories_target",
                        label: "Calories (kcal)",
                        color: "inherit",
                        icon: "🔥",
                      },
                      {
                        key: "protein_target",
                        label: "Protein (g)",
                        color: "#f87171",
                        icon: "🥩",
                      },
                      {
                        key: "carbs_target",
                        label: "Carbs (g)",
                        color: "#facc15",
                        icon: "🍚",
                      },
                      {
                        key: "fat_target",
                        label: "Fat (g)",
                        color: "var(--accent2)",
                        icon: "🥑",
                      },
                    ].map(({ key, label, color, icon }) => (
                      <div key={key}>
                        <label
                          className="label"
                          style={{ color, fontSize: 12 }}
                        >
                          {icon} {label}
                        </label>
                        <input
                          className="input"
                          type="number"
                          min="0"
                          step="1"
                          placeholder="0"
                          value={(goalsForm as any)[key]}
                          onChange={(e) =>
                            setGoalsForm((prev) => ({
                              ...prev,
                              [key]: e.target.value,
                            }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                      padding: "0.75rem",
                      background: "var(--surface2)",
                      borderRadius: 10,
                      marginBottom: "1rem",
                    }}
                  >
                    <div
                      onClick={() =>
                        setGoalsForm((prev) => ({
                          ...prev,
                          show_macros_to_client: !prev.show_macros_to_client,
                        }))
                      }
                      style={{
                        width: 44,
                        height: 24,
                        borderRadius: 99,
                        cursor: "pointer",
                        flexShrink: 0,
                        background: goalsForm.show_macros_to_client
                          ? "var(--accent)"
                          : "var(--border)",
                        position: "relative",
                        transition: "background 0.2s",
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          top: 3,
                          left: goalsForm.show_macros_to_client ? 23 : 3,
                          width: 18,
                          height: 18,
                          borderRadius: "50%",
                          background: "#fff",
                          transition: "left 0.2s",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                        }}
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>
                        Show macro progress to client
                      </div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>
                        {goalsForm.show_macros_to_client
                          ? "Client can see their macro rings"
                          : "Macro rings hidden from client view"}
                      </div>
                    </div>
                  </div>
                  {clientGoals && (
                    <div
                      style={{
                        background: "rgba(124,106,247,0.07)",
                        border: "1px solid rgba(124,106,247,0.2)",
                        borderRadius: 10,
                        padding: "0.65rem 1rem",
                        marginBottom: "1rem",
                        fontSize: 13,
                      }}
                    >
                      <span style={{ color: "var(--muted)" }}>Current: </span>
                      <span style={{ fontWeight: 700 }}>
                        {clientGoals.calories_target} kcal
                      </span>
                      {" · "}
                      <span style={{ color: "#f87171" }}>
                        P {clientGoals.protein_target}g
                      </span>
                      {" · "}
                      <span style={{ color: "#facc15" }}>
                        C {clientGoals.carbs_target}g
                      </span>
                      {" · "}
                      <span style={{ color: "var(--accent2)" }}>
                        F {clientGoals.fat_target}g
                      </span>
                    </div>
                  )}
                  <button
                    className="btn btn-primary"
                    onClick={saveClientGoals}
                    disabled={savingGoals}
                  >
                    {savingGoals ? "Saving…" : "💾 Save Goals"}
                  </button>
                </div>
              </>
            ) : planTab === "photos" ? (
              // ── NEW: Weekly Progress Photos Tab ──
              <>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "1.25rem",
                    flexWrap: "wrap",
                    gap: "0.75rem",
                  }}
                >
                  <div>
                    <h3 style={{ margin: 0 }}>📸 Weekly Progress Photos</h3>
                    <p
                      style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}
                    >
                      {weeklyPhotos.length} photo
                      {weeklyPhotos.length !== 1 ? "s" : ""} uploaded by client
                    </p>
                  </div>
                  {weeklyPhotos.length > 0 && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={downloadAllPhotos}
                    >
                      ⬇ Download All
                    </button>
                  )}
                </div>
                {loadingPhotos ? (
                  <div style={{ textAlign: "center", padding: "3rem" }}>
                    <div className="spinner" />
                  </div>
                ) : weeklyPhotos.length === 0 ? (
                  <div
                    className="card"
                    style={{
                      textAlign: "center",
                      padding: "3rem",
                      color: "var(--muted)",
                    }}
                  >
                    Client hasn't uploaded any weekly photos yet.
                  </div>
                ) : (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fill, minmax(200px, 1fr))",
                      gap: "1rem",
                    }}
                  >
                    {weeklyPhotos.map((photo) => {
                      const weekLabel = new Date(
                        photo.week_start + "T00:00:00"
                      ).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      });
                      return (
                        <div
                          key={photo.id}
                          className="card"
                          style={{ padding: 0, overflow: "hidden" }}
                        >
                          <img
                            src={photo.photo_url}
                            alt={`Week of ${weekLabel}`}
                            style={{
                              width: "100%",
                              height: 200,
                              objectFit: "cover",
                              display: "block",
                              cursor: "pointer",
                            }}
                            onClick={() =>
                              window.open(photo.photo_url, "_blank")
                            }
                          />
                          <div style={{ padding: "0.65rem 0.75rem" }}>
                            <div
                              style={{
                                fontWeight: 700,
                                fontSize: 13,
                                marginBottom: 2,
                              }}
                            >
                              Week of {weekLabel}
                            </div>
                            {photo.notes && (
                              <div
                                style={{
                                  fontSize: 12,
                                  color: "var(--muted)",
                                  marginBottom: "0.5rem",
                                }}
                              >
                                {photo.notes}
                              </div>
                            )}
                            <div style={{ display: "flex", gap: "0.4rem" }}>
                              <button
                                className="btn btn-outline btn-sm"
                                style={{ flex: 1, fontSize: 12 }}
                                onClick={() =>
                                  downloadPhoto(
                                    photo.photo_url,
                                    `${selectedClient?.name ?? "client"}-week-${
                                      photo.week_start
                                    }.jpg`
                                  )
                                }
                              >
                                ⬇ Download
                              </button>
                              <button
                                className="btn btn-sm"
                                style={{
                                  background: "rgba(124,106,247,0.15)",
                                  color: "var(--accent)",
                                  fontSize: 12,
                                }}
                                onClick={() =>
                                  window.open(photo.photo_url, "_blank")
                                }
                              >
                                🔍
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              // Progress tab
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2,1fr)",
                    gap: "0.75rem",
                    marginBottom: "1.25rem",
                  }}
                >
                  {[
                    {
                      label: "Avg Diet",
                      val: `${avgDiet}%`,
                      color: pctColor(avgDiet),
                    },
                    {
                      label: "Avg Workout",
                      val: `${avgWorkout}%`,
                      color: pctColor(avgWorkout),
                    },
                    {
                      label: "Latest Weight",
                      val: latestWeight ? `${latestWeight} kg` : "—",
                      color: "inherit",
                    },
                    {
                      label: "Days Logged",
                      val: String(clientProgress.length),
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
                <div className="card" style={{ marginBottom: "1.25rem" }}>
                  <div
                    className="section-title"
                    style={{ marginBottom: "0.75rem" }}
                  >
                    Weight Over Time (kg)
                  </div>
                  <WeightChart entries={clientProgress} />
                </div>
                {clientProgress.length === 0 ? (
                  <div
                    className="card"
                    style={{
                      textAlign: "center",
                      padding: "2rem",
                      color: "var(--muted)",
                    }}
                  >
                    Client hasn't logged any progress yet.
                  </div>
                ) : (
                  <div
                    className="card"
                    style={{ padding: 0, overflow: "hidden" }}
                  >
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Diet</th>
                          <th>Workout</th>
                          <th>Weight</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clientProgress.map((p) => (
                          <tr key={p.id}>
                            <td style={{ fontSize: 13 }}>
                              {new Date(
                                p.date + "T00:00:00"
                              ).toLocaleDateString("en-GB", {
                                day: "numeric",
                                month: "short",
                              })}
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
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ── EXERCISE LIBRARY ── */}
        {view === "exercises" && (
          <>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "1rem",
                marginBottom: "1rem",
              }}
            >
              <div>
                <h2 style={{ margin: 0 }}>Exercise Library</h2>
                <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>
                  {exercises.length} exercises
                </p>
              </div>
              <button
                className="btn btn-primary"
                onClick={() => setShowAddExercise(true)}
              >
                + Add Exercise
              </button>
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <input
                className="input"
                placeholder="Search exercises…"
                value={exerciseSearch}
                onChange={(e) => setExerciseSearch(e.target.value)}
              />
            </div>
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Muscle Group</th>
                    <th>Notes</th>
                    <th style={{ width: 52 }}>Del</th>
                  </tr>
                </thead>
                <tbody>
                  {exercises
                    .filter(
                      (e) =>
                        !exerciseSearch ||
                        e.name
                          .toLowerCase()
                          .includes(exerciseSearch.toLowerCase()) ||
                        e.muscle_group
                          .toLowerCase()
                          .includes(exerciseSearch.toLowerCase())
                    )
                    .map((ex) => (
                      <tr key={ex.id}>
                        <td style={{ fontWeight: 500 }}>{ex.name}</td>
                        <td style={{ color: "var(--muted)", fontSize: 12 }}>
                          {ex.muscle_group || "—"}
                        </td>
                        <td style={{ color: "var(--muted)", fontSize: 12 }}>
                          {ex.notes || "—"}
                        </td>
                        {/* ── NEW: Delete button ── */}
                        <td>
                          <button
                            onClick={() => deleteExerciseItem(ex.id, ex.name)}
                            style={{
                              background: "rgba(248,113,113,0.15)",
                              color: "var(--red)",
                              border: "none",
                              borderRadius: 6,
                              padding: "4px 10px",
                              cursor: "pointer",
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          >
                            🗑
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {showAddExercise && (
              <div
                className="modal-backdrop"
                onClick={() => setShowAddExercise(false)}
              >
                <div
                  className="modal"
                  onClick={(e) => e.stopPropagation()}
                  style={{ maxWidth: 420, width: "95vw" }}
                >
                  <div className="modal-title">Add Exercise</div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.85rem",
                    }}
                  >
                    <div>
                      <label className="label">Exercise Name *</label>
                      <input
                        className="input"
                        placeholder="e.g. Barbell Squat"
                        value={newExercise.name}
                        onChange={(e) =>
                          setNewExercise((p) => ({
                            ...p,
                            name: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label className="label">Muscle Group</label>
                      <input
                        className="input"
                        placeholder="e.g. Legs, Chest, Back…"
                        value={newExercise.muscle_group}
                        onChange={(e) =>
                          setNewExercise((p) => ({
                            ...p,
                            muscle_group: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label className="label">Notes / Instructions</label>
                      <input
                        className="input"
                        placeholder="e.g. Keep back straight"
                        value={newExercise.notes}
                        onChange={(e) =>
                          setNewExercise((p) => ({
                            ...p,
                            notes: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: "0.75rem",
                        justifyContent: "flex-end",
                      }}
                    >
                      <button
                        className="btn btn-outline"
                        onClick={() => setShowAddExercise(false)}
                      >
                        Cancel
                      </button>
                      <button
                        className="btn btn-primary"
                        onClick={handleAddExercise}
                        disabled={savingExercise || !newExercise.name.trim()}
                      >
                        {savingExercise ? "Adding…" : "Add Exercise"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── FOOD DATABASE ── */}
        {view === "foods" && (
          <>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "1rem",
                marginBottom: "1rem",
              }}
            >
              <div>
                <h2 style={{ margin: 0 }}>Food Database</h2>
                <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>
                  {filteredFoods.length} / {foods.length} foods
                </p>
              </div>
              <button
                className="btn btn-primary"
                onClick={() => setShowAddFood(true)}
              >
                + Add Food
              </button>
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <input
                className="input"
                placeholder="Search foods…"
                value={foodSearch}
                onChange={(e) => setFoodSearch(e.target.value)}
              />
            </div>
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Serving</th>
                    <th>Calories</th>
                    <th>Protein</th>
                    <th>Carbs</th>
                    <th>Fat</th>
                    <th style={{ width: 52 }}>Del</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFoods.map((f) => (
                    <tr key={f.id}>
                      <td style={{ fontWeight: 500 }}>{f.name}</td>
                      <td style={{ color: "var(--muted)", fontSize: 12 }}>
                        {servingLabel(f)}
                      </td>
                      <td>{f.calories_per_serving} kcal</td>
                      <td style={{ color: "#f87171" }}>
                        {f.protein_per_serving}g
                      </td>
                      <td style={{ color: "#facc15" }}>
                        {f.carbs_per_serving}g
                      </td>
                      <td style={{ color: "var(--accent2)" }}>
                        {f.fat_per_serving}g
                      </td>
                      {/* ── NEW: Delete button ── */}
                      <td>
                        <button
                          onClick={() => deleteFoodItem(f.id, f.name)}
                          style={{
                            background: "rgba(248,113,113,0.15)",
                            color: "var(--red)",
                            border: "none",
                            borderRadius: 6,
                            padding: "4px 10px",
                            cursor: "pointer",
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          🗑
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>

      {showAddFood && (
        <AddFoodModal
          onClose={() => setShowAddFood(false)}
          onSave={handleAddFood}
        />
      )}

      {showCopyModal && (
        <CopyPlanModal
          type={showCopyModal}
          planDates={planDates}
          currentDate={selectedDate}
          onClose={() => setShowCopyModal(null)}
          onCopy={
            showCopyModal === "diet"
              ? handleCopyDietPlan
              : handleCopyWorkoutPlan
          }
        />
      )}

      {/* ── NEW: Chat overlay ── */}
      {chatOpen && chatClientId && (
        <Chat
          clientId={chatClientId}
          coachId={coachId}
          senderType="coach"
          peerName={chatClientName}
          onClose={() => setChatOpen(false)}
        />
      )}
    </div>
  );
}
