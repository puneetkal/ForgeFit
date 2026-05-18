// Coach.tsx — Complete UI Rewrite
// Matches new ForgeFit design system

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import CoachSelf from "./CoachSelf";
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
  if (v >= 50) return "var(--yellow)";
  return "var(--red)";
}
function macroScale(food: Food, qty: number) {
  return qty / (food.serving_size || 1);
}
function servingLabel(f: Food) {
  return `${f.serving_size === 1 ? "" : f.serving_size + " "}${f.serving_unit}`;
}
const SERVING_UNITS = [
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
    <div className="mini-cal">
      <div className="mini-cal-nav">
        <button className="btn btn-outline btn-xs" onClick={prev}>
          ‹
        </button>
        <span className="mcn-title">
          {MONTHS[vm]} {vy}
        </span>
        <button className="btn btn-outline btn-xs" onClick={next}>
          ›
        </button>
      </div>
      <div className="mini-cal-grid">
        {DOW.map((d) => (
          <div key={d} className="cal-dow">
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
              className={`cal-cell${isSel ? " sel" : ""}${
                isToday && !isSel ? " today" : ""
              }`}
            >
              {day}
              {hasPlan && <span className="cal-dot" />}
            </button>
          );
        })}
      </div>
      <div
        style={{
          display: "flex",
          gap: 12,
          marginTop: 10,
          fontSize: 10,
          color: "var(--muted)",
        }}
      >
        <span>● has plan</span>
        <span style={{ color: "var(--accent)" }}>■ selected</span>
      </div>
    </div>
  );
}

// ── Macro Rings ────────────────────────────────────────────────────────────────
function Ring({
  pct,
  color,
  size = 60,
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
        style={{ transition: "stroke-dashoffset 0.5s" }}
      />
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill="currentColor"
        fontSize={10}
        fontWeight={700}
        fontFamily="Outfit,sans-serif"
      >
        {pct}%
      </text>
    </svg>
  );
}

function MacroRingsPreview({
  meals,
  goals,
}: {
  meals: MealDraft[];
  goals: ClientGoals | null;
}) {
  if (!goals || goals.calories_target === 0) return null;
  const all = meals.flatMap((m) => m.items);
  const totCal = all.reduce(
    (s, i) =>
      s +
      (i.food
        ? i.food.calories_per_serving * macroScale(i.food, i.quantity)
        : 0),
    0
  );
  const totP = all.reduce(
    (s, i) =>
      s +
      (i.food
        ? i.food.protein_per_serving * macroScale(i.food, i.quantity)
        : 0),
    0
  );
  const totC = all.reduce(
    (s, i) =>
      s +
      (i.food ? i.food.carbs_per_serving * macroScale(i.food, i.quantity) : 0),
    0
  );
  const totF = all.reduce(
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
      label: "P",
      val: Math.round(totP),
      target: goals.protein_target,
      unit: "g",
      color: "#f87171",
    },
    {
      label: "C",
      val: Math.round(totC),
      target: goals.carbs_target,
      unit: "g",
      color: "#fbbf24",
    },
    {
      label: "F",
      val: Math.round(totF),
      target: goals.fat_target,
      unit: "g",
      color: "#34d399",
    },
  ];
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="card-title">
        <span className="icon">📊</span>Plan Macros vs Targets
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: 8,
        }}
      >
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
                gap: 5,
              }}
            >
              <Ring pct={pct} color={over ? "var(--red)" : m.color} />
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
                <div style={{ fontSize: 9, color: "var(--muted)" }}>
                  {m.label} / {m.target}
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
  onSave: (f: NewFoodState) => Promise<void>;
}) {
  const [form, setForm] = useState<NewFoodState>(EMPTY_FOOD);
  const [saving, setSaving] = useState(false);
  const [customUnit, setCustomUnit] = useState(false);
  function set(k: keyof NewFoodState, v: string) {
    setForm((p) => ({ ...p, [k]: v }));
  }
  const previewCal = parseFloat(form.calories_per_serving) || 0;
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.serving_unit) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
  }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet-inner" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">➕ Add New Food</div>
        <form
          onSubmit={handleSave}
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
        >
          <div>
            <label className="ff-label">Food Name</label>
            <input
              className="ff-input"
              required
              placeholder="e.g. Egg, Peanut Butter"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>
          <div>
            <label className="ff-label">Serving Size</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="ff-input"
                type="number"
                min="0.1"
                step="0.1"
                required
                style={{ width: 90 }}
                value={form.serving_size}
                onChange={(e) => set("serving_size", e.target.value)}
              />
              {customUnit ? (
                <input
                  className="ff-input"
                  placeholder="custom unit"
                  value={form.serving_unit}
                  onChange={(e) => set("serving_unit", e.target.value)}
                  autoFocus
                />
              ) : (
                <select
                  className="ff-input"
                  value={
                    SERVING_UNITS.includes(form.serving_unit)
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
                  {SERVING_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                  <option value="__custom">custom…</option>
                </select>
              )}
            </div>
          </div>
          <div>
            <label className="ff-label">Macros per serving</label>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
              }}
            >
              {[
                {
                  key: "calories_per_serving",
                  label: "Calories (kcal)",
                  color: "var(--text)",
                },
                {
                  key: "protein_per_serving",
                  label: "Protein (g)",
                  color: "#f87171",
                },
                {
                  key: "carbs_per_serving",
                  label: "Carbs (g)",
                  color: "var(--yellow)",
                },
                {
                  key: "fat_per_serving",
                  label: "Fat (g)",
                  color: "var(--accent2)",
                },
              ].map(({ key, label, color }) => (
                <div key={key}>
                  <label className="ff-label" style={{ color, fontSize: 10 }}>
                    {label}
                  </label>
                  <input
                    className="ff-input ff-input-sm"
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
                padding: "10px 14px",
                fontSize: 13,
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontWeight: 700, color: "var(--accent)" }}>
                Preview:
              </span>
              <span>{previewCal} kcal</span>
              <span style={{ color: "#f87171" }}>
                P {parseFloat(form.protein_per_serving) || 0}g
              </span>
              <span style={{ color: "var(--yellow)" }}>
                C {parseFloat(form.carbs_per_serving) || 0}g
              </span>
              <span style={{ color: "var(--accent2)" }}>
                F {parseFloat(form.fat_per_serving) || 0}g
              </span>
            </div>
          )}
          <div
            style={{
              display: "flex",
              gap: 10,
              justifyContent: "flex-end",
              paddingTop: 4,
            }}
          >
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={saving}
            >
              {saving ? "Adding…" : "Add Food"}
            </button>
          </div>
        </form>
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
  onCopy: (from: string) => Promise<void>;
}) {
  const avail = Array.from(planDates)
    .filter((d) => d !== currentDate)
    .sort((a, b) => b.localeCompare(a));
  const [selected, setSelected] = useState(avail[0] || "");
  const [copying, setCopying] = useState(false);
  async function go() {
    if (!selected) return;
    setCopying(true);
    await onCopy(selected);
    setCopying(false);
  }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-handle" />
        <div className="modal-title">
          {type === "diet" ? "🥗" : "🏋️"} Copy{" "}
          {type === "diet" ? "Diet" : "Workout"} Plan
        </div>
        <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 16 }}>
          Paste into{" "}
          <strong style={{ color: "var(--accent)" }}>
            {new Date(currentDate + "T00:00:00").toLocaleDateString("en-GB", {
              weekday: "short",
              day: "numeric",
              month: "short",
            })}
          </strong>
          . This will overwrite the current plan.
        </p>
        {avail.length === 0 ? (
          <div className="empty-state">
            <div className="es-icon">📅</div>
            <div className="es-title">No other dates</div>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              maxHeight: 280,
              overflowY: "auto",
              marginBottom: 14,
            }}
          >
            {avail.map((date) => (
              <button
                key={date}
                onClick={() => setSelected(date)}
                className={`copy-date-btn${
                  date === selected ? " selected" : ""
                }`}
              >
                <div
                  className={`copy-radio${date === selected ? " sel" : ""}`}
                />
                <div>
                  <div
                    style={{
                      fontWeight: date === selected ? 700 : 400,
                      fontSize: 14,
                    }}
                  >
                    {new Date(date + "T00:00:00").toLocaleDateString("en-GB", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>
                    {date}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="btn btn-outline btn-sm" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={go}
            disabled={copying || !selected || !avail.length}
          >
            {copying ? "Copying…" : `Copy Plan`}
          </button>
        </div>
      </div>
    </div>
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
          padding: "20px",
          fontSize: 13,
        }}
      >
        Need at least 2 weight entries.
      </div>
    );
  const W = 340,
    H = 100,
    pL = 30,
    pR = 8,
    pT = 8,
    pB = 20;
  const cW = W - pL - pR,
    cH = H - pT - pB;
  const ws = data.map((d) => d.w),
    minW = Math.min(...ws),
    maxW = Math.max(...ws),
    range = maxW - minW || 1;
  const xp = (i: number) => pL + (i / Math.max(data.length - 1, 1)) * cW;
  const yp = (w: number) => pT + ((maxW - w) / range) * cH;
  const pts = data.map((d, i) => `${xp(i)},${yp(d.w)}`);
  const fill = `${pL},${pT + cH} ${pts.join(" ")} ${xp(data.length - 1)},${
    pT + cH
  }`;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{
        width: "100%",
        height: "auto",
        maxHeight: 110,
        overflow: "visible",
      }}
    >
      {[minW, (minW + maxW) / 2, maxW].map((w, i) => (
        <g key={i}>
          <line
            x1={pL}
            x2={W - pR}
            y1={yp(w)}
            y2={yp(w)}
            stroke="var(--border)"
            strokeWidth={0.5}
            strokeDasharray="4,3"
          />
          <text
            x={pL - 3}
            y={yp(w) + 3}
            fontSize={7}
            fill="var(--muted)"
            textAnchor="end"
          >
            {w.toFixed(1)}
          </text>
        </g>
      ))}
      <polygon points={fill} fill="var(--accent)" fillOpacity={0.08} />
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
          r={3}
          fill="var(--accent)"
          stroke="var(--bg)"
          strokeWidth={1.5}
        />
      ))}
      <text
        x={xp(0)}
        y={H - 4}
        fontSize={7}
        fill="var(--muted)"
        textAnchor="middle"
      >
        {data[0].date.slice(5).replace("-", "/")}
      </text>
      <text
        x={xp(data.length - 1)}
        y={H - 4}
        fontSize={7}
        fill="var(--muted)"
        textAnchor="middle"
      >
        {data[data.length - 1].date.slice(5).replace("-", "/")}
      </text>
    </svg>
  );
}

// ── Main Coach Component ───────────────────────────────────────────────────────
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
  const [calendarOpen, setCalendarOpen] = useState(false);

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
  const [clientSearch, setClientSearch] = useState("");
  const [clientSort, setClientSort] = useState<"name" | "recent">("name");
  const [weeklyPhotos, setWeeklyPhotos] = useState<WeeklyPhoto[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
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
    } else setWorkoutItems([]);
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

  async function deleteFood(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This may affect existing plans.`)) return;
    const { error: de } = await supabase.from("foods").delete().eq("id", id);
    if (de) {
      setError(de.message);
      return;
    }
    setFoods((prev) => prev.filter((f) => f.id !== id));
    flash(`"${name}" deleted.`);
  }

  async function deleteExercise(id: string, name: string) {
    if (!confirm(`Delete "${name}" from exercise library?`)) return;
    const { error: de } = await supabase
      .from("exercises")
      .delete()
      .eq("id", id);
    if (de) {
      setError(de.message);
      return;
    }
    setExercises((prev) => prev.filter((e) => e.id !== id));
    flash(`"${name}" deleted.`);
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
      loadWeeklyPhotos(c.id),
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
      if (mRow && m.items.length > 0)
        await supabase.from("meal_items").insert(
          m.items.map((i) => ({
            meal_id: mRow.id,
            food_id: i.food_id,
            quantity: i.quantity,
            unit: i.unit,
          }))
        );
    }
    setPlanDates((prev) => new Set([...prev, selectedDate]));
    flash("Diet plan saved!");
    setSavingDiet(false);
  }

  async function deleteDietPlan() {
    if (!selectedClient || !confirm("Delete this diet plan?")) return;
    const { data: pd } = await supabase
      .from("plan_days")
      .select("id")
      .eq("client_id", selectedClient.id)
      .eq("plan_date", selectedDate)
      .maybeSingle();
    if (pd) {
      const { data: om } = await supabase
        .from("meals")
        .select("id")
        .eq("plan_day_id", pd.id);
      if (om?.length) {
        await supabase
          .from("meal_items")
          .delete()
          .in(
            "meal_id",
            om.map((m: any) => m.id)
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
    if (workoutItems.length > 0)
      await supabase.from("workout_day_items").insert(
        workoutItems.map((i, idx) => ({
          workout_plan_day_id: wpd.id,
          exercise_id: i.exercise_id,
          sets: i.sets,
          reps: i.reps,
          weight_kg: i.weight_kg || null,
          display_order: idx + 1,
        }))
      );
    setPlanDates((prev) => new Set([...prev, selectedDate]));
    flash("Workout plan saved!");
    setSavingWorkout(false);
  }

  async function deleteWorkoutPlan() {
    if (!selectedClient || !confirm("Delete this workout plan?")) return;
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
      )} — save to confirm!`
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
      setError("No workout plan for that date.");
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
    flash(`✓ Workout copied — save to confirm!`);
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
    if (ee) setError(ee.message);
    else {
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
  if (showSelfJourney)
    return (
      <CoachSelf
        coachId={coachId}
        coachName={coachName}
        foods={foods}
        exercises={exercises}
        onClose={() => setShowSelfJourney(false)}
      />
    );

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
  const initials =
    coachName
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "C";

  return (
    <div className="coach-shell" style={{ minHeight: "100vh" }}>
      {/* Sidebar overlay */}
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside className={`sidebar${sidebarOpen ? " open" : ""}`}>
        <div className="sidebar-logo">
          Forge<span>Fit</span>
        </div>
        <div style={{ padding: "0 10px 12px" }}>
          <button
            onClick={() => {
              setShowSelfJourney(true);
              setSidebarOpen(false);
            }}
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: 12,
              background: "linear-gradient(135deg, var(--accent), #a855f7)",
              border: "none",
              color: "#fff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontFamily: "var(--font)",
              fontWeight: 700,
              fontSize: 13,
              boxShadow: "0 4px 14px var(--accent-glow)",
            }}
          >
            <span style={{ fontSize: 20 }}>🏅</span>
            <div style={{ textAlign: "left" }}>
              <div>My Journey</div>
              <div style={{ fontSize: 11, fontWeight: 400, opacity: 0.8 }}>
                Track your own fitness
              </div>
            </div>
          </button>
        </div>
        <nav className="sidebar-nav">
          {(
            [
              { id: "clients", icon: "👥", label: "My Clients" },
              { id: "foods", icon: "🥑", label: "Food Database" },
              { id: "exercises", icon: "🏃", label: "Exercise Library" },
            ] as { id: CoachView; icon: string; label: string }[]
          ).map((item) => (
            <button
              key={item.id}
              className={`sidebar-item${view === item.id ? " active" : ""}`}
              onClick={() => navTo(item.id)}
            >
              <span className="si-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-profile">
            <div className="sidebar-avatar">{initials}</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{coachName}</div>
          </div>
          <button
            className="sidebar-item"
            style={{ color: "var(--red)", width: "100%" }}
            onClick={handleLogout}
          >
            <span className="si-icon">⎋</span>Logout
          </button>
        </div>
      </aside>

      {/* Top bar */}
      <header className="coach-top-bar">
        <button className="hamburger-btn" onClick={() => setSidebarOpen(true)}>
          <span />
          <span />
          <span />
        </button>
        <div
          style={{
            flex: 1,
            fontSize: 17,
            fontWeight: 800,
            letterSpacing: "-0.03em",
          }}
        >
          {view === "clients"
            ? "My Clients"
            : view === "client_detail" && selectedClient
            ? selectedClient.name
            : view === "foods"
            ? "Food Database"
            : "Exercise Library"}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {view === "client_detail" && selectedClient && (
            <button
              className="icon-btn"
              onClick={() => {
                setChatClientId(selectedClient.id);
                setChatClientName(selectedClient.name);
                setChatOpen(true);
              }}
            >
              💬
            </button>
          )}
          <div className="avatar-btn">{initials}</div>
        </div>
      </header>

      <main style={{ padding: "0 16px 40px" }}>
        {msg && <div className="alert alert-success">{msg}</div>}
        {error && (
          <div
            className="alert alert-error"
            style={{
              cursor: "pointer",
              display: "flex",
              justifyContent: "space-between",
            }}
            onClick={() => setError("")}
          >
            <span>{error}</span>
            <span>✕</span>
          </div>
        )}

        {/* ── CLIENTS ── */}
        {view === "clients" && (
          <div className="page-enter">
            {/* Coach self card */}
            <div
              onClick={() => setShowSelfJourney(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: 16,
                background:
                  "linear-gradient(135deg, rgba(124,106,247,0.15), rgba(168,85,247,0.1))",
                border: "2px solid var(--accent)",
                borderRadius: 16,
                cursor: "pointer",
                marginBottom: 16,
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.transform = "translateY(-1px)")
              }
              onMouseLeave={(e) => (e.currentTarget.style.transform = "none")}
            >
              <div
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 14,
                  background: "linear-gradient(135deg, var(--accent), #a855f7)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                  flexShrink: 0,
                  boxShadow: "0 4px 14px var(--accent-glow)",
                }}
              >
                🏅
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: 15,
                    color: "var(--accent)",
                  }}
                >
                  {coachName}{" "}
                  <span className="badge badge-accent" style={{ fontSize: 10 }}>
                    YOU
                  </span>
                </div>
                <div
                  style={{ fontSize: 12, color: "var(--text2)", marginTop: 2 }}
                >
                  Track your own diet, workouts & progress
                </div>
              </div>
              <div className="btn btn-primary btn-sm">Open →</div>
            </div>
            {/* Connect */}
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-title">
                <span className="icon">🔗</span>Connect a Client
              </div>
              <p
                style={{
                  color: "var(--text2)",
                  fontSize: 13,
                  marginBottom: 12,
                }}
              >
                Enter the 6-character code from your client.
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <input
                  className="ff-input"
                  style={{
                    textTransform: "uppercase",
                    letterSpacing: "0.2em",
                    fontSize: "1.1rem",
                    flex: 1,
                    fontFamily: "var(--font-mono)",
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
            {/* Search/sort */}
            {clients.length > 0 && (
              <div className="search-bar">
                <input
                  className="ff-input"
                  placeholder="Search clients…"
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                />
                {(["name", "recent"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setClientSort(s)}
                    className={`btn btn-sm${
                      clientSort === s ? " btn-primary" : " btn-outline"
                    }`}
                  >
                    {s === "name" ? "A–Z" : "Recent"}
                  </button>
                ))}
              </div>
            )}
            {filteredClients.length === 0 ? (
              <div className="empty-state">
                <div className="es-icon">👥</div>
                <div className="es-title">
                  {clientSearch
                    ? `No match for "${clientSearch}"`
                    : "No clients yet"}
                </div>
                <div className="es-sub">Connect your first client above.</div>
              </div>
            ) : (
              filteredClients.map((c) => (
                <div
                  key={c.id}
                  className="client-card"
                  onClick={() => openClient(c)}
                >
                  <div className="client-avatar">
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="client-info">
                    <div className="client-name">{c.name}</div>
                    <div className="client-meta">
                      Age {c.age} · {c.height_cm} cm · {c.weight_kg} kg
                    </div>
                  </div>
                  <span style={{ color: "var(--muted)", fontSize: 18 }}>›</span>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── CLIENT DETAIL ── */}
        {view === "client_detail" && selectedClient && (
          <div className="page-enter">
            <div
              style={{
                display: "flex",
                gap: 10,
                marginBottom: 16,
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
                <div style={{ fontSize: 11, color: "var(--muted)" }}>
                  Age {selectedClient.age} · {selectedClient.height_cm} cm ·{" "}
                  {selectedClient.weight_kg} kg
                </div>
              </div>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setPlanTab("photos")}
              >
                📸 Photos
              </button>
            </div>
            {/* Date selector */}
            <div
              className="card"
              style={{ marginBottom: 14, padding: "12px 16px" }}
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
                  color: "inherit",
                  fontFamily: "var(--font)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 20 }}>📅</span>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>
                      {selDateDisplay}
                    </div>
                    <div style={{ display: "flex", gap: 6, marginTop: 3 }}>
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
                    transform: calendarOpen ? "rotate(180deg)" : "none",
                    transition: "0.2s",
                    display: "block",
                  }}
                >
                  ▼
                </span>
              </button>
              {calendarOpen && (
                <div
                  style={{
                    marginTop: 14,
                    paddingTop: 14,
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
            <div className="plan-tabs">
              {(
                [
                  ["diet", "🥗 Diet"],
                  ["workout", "🏋️ Workout"],
                  ["progress", "📊 Progress"],
                  ["goals", "🎯 Goals"],
                  ["photos", "📸 Photos"],
                ] as [PlanTab, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  className={`plan-tab${planTab === id ? " active" : ""}`}
                  onClick={() => {
                    setPlanTab(id);
                    if (id === "photos" && selectedClient)
                      loadWeeklyPhotos(selectedClient.id);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {loadingPlan && planTab !== "progress" && planTab !== "photos" ? (
              <div className="spinner" />
            ) : null}

            {/* DIET */}
            {planTab === "diet" && !loadingPlan && (
              <>
                <MacroRingsPreview meals={meals} goals={clientGoals} />
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "var(--surface2)",
                    borderRadius: 10,
                    padding: "10px 14px",
                    marginBottom: 12,
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ fontSize: 13, color: "var(--text2)" }}>
                    📋 Reuse plans
                  </span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      className="btn btn-outline btn-xs"
                      onClick={() => setShowCopyModal("diet")}
                      disabled={planDates.size === 0}
                    >
                      Copy Plan
                    </button>
                    {meals.length > 0 && (
                      <button
                        className="btn btn-danger btn-xs"
                        onClick={deleteDietPlan}
                      >
                        🗑 Remove
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label className="ff-label">Day Note (optional)</label>
                  <input
                    className="ff-input"
                    placeholder="e.g. High carb day…"
                    value={dietNote}
                    onChange={(e) => setDietNote(e.target.value)}
                  />
                </div>
                {meals.length === 0 && (
                  <div className="empty-state">
                    <div className="es-icon">🍽️</div>
                    <div className="es-title">No meals yet</div>
                    <div className="es-sub">
                      Add meals below to build the plan.
                    </div>
                  </div>
                )}
                {meals.map((meal, mi) => {
                  const totCal = meal.items.reduce(
                    (s, it) =>
                      s +
                      (it.food
                        ? it.food.calories_per_serving *
                          macroScale(it.food, it.quantity)
                        : 0),
                    0
                  );
                  const totP = meal.items.reduce(
                    (s, it) =>
                      s +
                      (it.food
                        ? it.food.protein_per_serving *
                          macroScale(it.food, it.quantity)
                        : 0),
                    0
                  );
                  return (
                    <div
                      key={mi}
                      className="meal-card"
                      style={{ marginBottom: 12 }}
                    >
                      <div className="meal-header">
                        <div className="meal-header-left">
                          <div className="meal-num">{mi + 1}</div>
                          <input
                            className="ff-input ff-input-sm"
                            style={{
                              fontWeight: 700,
                              border: "none",
                              background: "transparent",
                              flex: "unset",
                              width: 160,
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
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          {meal.items.length > 0 && (
                            <span
                              style={{
                                fontSize: 12,
                                color: "var(--accent)",
                                fontWeight: 700,
                              }}
                            >
                              {Math.round(totCal)} kcal · P {totP.toFixed(0)}g
                            </span>
                          )}
                          <button
                            className="btn btn-danger btn-xs"
                            onClick={() => removeMeal(mi)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      <div style={{ padding: "8px 14px" }}>
                        {meal.items.length === 0 && (
                          <p
                            style={{
                              color: "var(--muted)",
                              fontSize: 13,
                              marginBottom: 8,
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
                                background: "var(--bg)",
                                borderRadius: 8,
                                padding: "8px 10px",
                                marginBottom: 8,
                              }}
                            >
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "1fr 80px 32px",
                                  gap: 8,
                                  alignItems: "center",
                                }}
                              >
                                <select
                                  className="ff-input ff-input-sm"
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
                                    className="ff-input ff-input-sm"
                                    type="number"
                                    min="0.1"
                                    step="any"
                                    style={{ minWidth: 0 }}
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
                                      fontSize: 10,
                                      color: "var(--muted)",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {item.unit}
                                  </span>
                                </div>
                                <button
                                  onClick={() => removeMealItem(mi, ii)}
                                  style={{
                                    background: "var(--red-dim)",
                                    color: "var(--red)",
                                    border: "none",
                                    borderRadius: 6,
                                    cursor: "pointer",
                                    height: 32,
                                    fontSize: 12,
                                    fontWeight: 700,
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
                                  }}
                                >
                                  {food.serving_size}
                                  {food.serving_unit} ={" "}
                                  {food.calories_per_serving} kcal
                                  {item.quantity !== food.serving_size && (
                                    <span
                                      style={{
                                        color: "var(--accent)",
                                        marginLeft: 6,
                                      }}
                                    >
                                      → {item.quantity}
                                      {food.serving_unit} = {itemCal} kcal
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        <button
                          className="btn btn-outline btn-xs"
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
                    const all = meals.flatMap((m) => m.items);
                    const totCal = all.reduce(
                      (s, it) =>
                        s +
                        (it.food
                          ? it.food.calories_per_serving *
                            macroScale(it.food, it.quantity)
                          : 0),
                      0
                    );
                    const totP = all.reduce(
                      (s, it) =>
                        s +
                        (it.food
                          ? it.food.protein_per_serving *
                            macroScale(it.food, it.quantity)
                          : 0),
                      0
                    );
                    const totC = all.reduce(
                      (s, it) =>
                        s +
                        (it.food
                          ? it.food.carbs_per_serving *
                            macroScale(it.food, it.quantity)
                          : 0),
                      0
                    );
                    const totF = all.reduce(
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
                          marginBottom: 14,
                          display: "flex",
                          gap: 12,
                          flexWrap: "wrap",
                          alignItems: "center",
                          padding: "12px 16px",
                        }}
                      >
                        <span style={{ fontWeight: 700, fontSize: 13 }}>
                          Day Total
                        </span>
                        <span
                          style={{ color: "var(--accent)", fontWeight: 700 }}
                        >
                          {Math.round(totCal)} kcal
                        </span>
                        <span style={{ color: "#f87171" }}>
                          P {totP.toFixed(1)}g
                        </span>
                        <span style={{ color: "var(--yellow)" }}>
                          C {totC.toFixed(1)}g
                        </span>
                        <span style={{ color: "var(--accent2)" }}>
                          F {totF.toFixed(1)}g
                        </span>
                      </div>
                    );
                  })()}
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button className="btn btn-outline btn-sm" onClick={addMeal}>
                    + Add Meal
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={saveDietPlan}
                    disabled={savingDiet}
                  >
                    {savingDiet ? "Saving…" : "💾 Save Diet Plan"}
                  </button>
                </div>
              </>
            )}

            {/* WORKOUT */}
            {planTab === "workout" && !loadingPlan && (
              <>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "var(--surface2)",
                    borderRadius: 10,
                    padding: "10px 14px",
                    marginBottom: 12,
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ fontSize: 13, color: "var(--text2)" }}>
                    📋 Reuse plans
                  </span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      className="btn btn-outline btn-xs"
                      onClick={() => setShowCopyModal("workout")}
                      disabled={planDates.size === 0}
                    >
                      Copy Plan
                    </button>
                    {workoutItems.length > 0 && (
                      <button
                        className="btn btn-danger btn-xs"
                        onClick={deleteWorkoutPlan}
                      >
                        🗑 Remove
                      </button>
                    )}
                  </div>
                </div>
                {workoutItems.length === 0 && (
                  <div className="empty-state">
                    <div className="es-icon">🏋️</div>
                    <div className="es-title">No exercises yet</div>
                    <div className="es-sub">Add exercises below.</div>
                  </div>
                )}
                {workoutItems.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: "var(--surface2)",
                      borderRadius: 12,
                      padding: "12px 14px",
                      marginBottom: 10,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: 10,
                        alignItems: "center",
                        marginBottom: 10,
                      }}
                    >
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          background: "var(--accent-dim)",
                          color: "var(--accent)",
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
                        className="ff-input ff-input-sm"
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
                          background: "var(--red-dim)",
                          color: "var(--red)",
                          border: "none",
                          borderRadius: 6,
                          cursor: "pointer",
                          padding: "4px 10px",
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        ✕
                      </button>
                    </div>
                    <div style={{ display: "flex", gap: 8, paddingLeft: 38 }}>
                      {[
                        { label: "Sets", key: "sets", val: item.sets, ph: "3" },
                        {
                          label: "Reps",
                          key: "reps",
                          val: item.reps,
                          ph: "10",
                        },
                        {
                          label: "kg",
                          key: "weight_kg",
                          val: item.weight_kg ?? "",
                          ph: "—",
                        },
                      ].map((f) => (
                        <div key={f.key} style={{ flex: 1 }}>
                          <label className="ff-label">{f.label}</label>
                          <input
                            className="ff-input ff-input-sm"
                            type="number"
                            placeholder={f.ph}
                            value={f.val}
                            onChange={(e) =>
                              updateWorkoutItem(
                                idx,
                                f.key,
                                f.key === "weight_kg"
                                  ? parseFloat(e.target.value) || null
                                  : parseInt(e.target.value) || 1
                              )
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    flexWrap: "wrap",
                    marginTop: 4,
                  }}
                >
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={addWorkoutItem}
                  >
                    + Add Exercise
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={saveWorkoutPlan}
                    disabled={savingWorkout}
                  >
                    {savingWorkout ? "Saving…" : "💾 Save Workout Plan"}
                  </button>
                </div>
              </>
            )}

            {/* PROGRESS */}
            {planTab === "progress" && (
              <>
                <div className="stats-grid">
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
                      color: "var(--text)",
                    },
                    {
                      label: "Days Logged",
                      val: String(clientProgress.length),
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
                <div className="card" style={{ marginBottom: 14 }}>
                  <div className="card-title">
                    <span className="icon">⚖️</span>Weight Over Time
                  </div>
                  <WeightChart entries={clientProgress} />
                </div>
                {clientProgress.length === 0 ? (
                  <div className="empty-state">
                    <div className="es-icon">📊</div>
                    <div className="es-title">No progress logged</div>
                  </div>
                ) : (
                  <div
                    className="card"
                    style={{ padding: 0, overflow: "hidden" }}
                  >
                    <table className="ff-table">
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
                            <td style={{ fontSize: 12 }}>
                              {new Date(
                                p.date + "T00:00:00"
                              ).toLocaleDateString("en-GB", {
                                day: "numeric",
                                month: "short",
                              })}
                            </td>
                            <td>
                              <span
                                style={{
                                  color: pctColor(p.diet_progress),
                                  fontWeight: 700,
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
                                }}
                              >
                                {p.workout_progress}%
                              </span>
                            </td>
                            <td>
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

            {/* GOALS */}
            {planTab === "goals" && (
              <div className="card">
                <div className="card-title">
                  <span className="icon">🎯</span>Daily Macro Targets
                </div>
                <p
                  style={{
                    color: "var(--text2)",
                    fontSize: 13,
                    marginBottom: 14,
                  }}
                >
                  Set daily nutrition goals for {selectedClient?.name}.
                </p>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                    marginBottom: 14,
                  }}
                >
                  {[
                    {
                      key: "calories_target",
                      label: "🔥 Calories (kcal)",
                      color: "var(--text)",
                    },
                    {
                      key: "protein_target",
                      label: "🥩 Protein (g)",
                      color: "#f87171",
                    },
                    {
                      key: "carbs_target",
                      label: "🍚 Carbs (g)",
                      color: "var(--yellow)",
                    },
                    {
                      key: "fat_target",
                      label: "🥑 Fat (g)",
                      color: "var(--accent2)",
                    },
                  ].map(({ key, label, color }) => (
                    <div key={key}>
                      <label
                        className="ff-label"
                        style={{ color, fontSize: 10 }}
                      >
                        {label}
                      </label>
                      <input
                        className="ff-input ff-input-sm"
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
                <div className="toggle-wrap" style={{ marginBottom: 14 }}>
                  <button
                    className={`toggle${
                      goalsForm.show_macros_to_client ? " on" : ""
                    }`}
                    onClick={() =>
                      setGoalsForm((p) => ({
                        ...p,
                        show_macros_to_client: !p.show_macros_to_client,
                      }))
                    }
                    style={{
                      background: goalsForm.show_macros_to_client
                        ? "var(--accent)"
                        : "var(--surface3)",
                    }}
                  >
                    <div className="toggle-knob" />
                  </button>
                  <div className="toggle-text">
                    <div className="tt-main">Show macros to client</div>
                    <div className="tt-sub">
                      {goalsForm.show_macros_to_client
                        ? "Client sees macro rings"
                        : "Hidden from client"}
                    </div>
                  </div>
                </div>
                {clientGoals && (
                  <div
                    style={{
                      background: "var(--accent-dim)",
                      border: "1px solid rgba(124,106,247,0.2)",
                      borderRadius: 10,
                      padding: "10px 14px",
                      marginBottom: 14,
                      fontSize: 13,
                    }}
                  >
                    Current: <strong>{clientGoals.calories_target} kcal</strong>{" "}
                    ·{" "}
                    <span style={{ color: "#f87171" }}>
                      P {clientGoals.protein_target}g
                    </span>{" "}
                    ·{" "}
                    <span style={{ color: "var(--yellow)" }}>
                      C {clientGoals.carbs_target}g
                    </span>{" "}
                    ·{" "}
                    <span style={{ color: "var(--accent2)" }}>
                      F {clientGoals.fat_target}g
                    </span>
                  </div>
                )}
                <button
                  className="btn btn-primary btn-sm"
                  onClick={saveClientGoals}
                  disabled={savingGoals}
                >
                  {savingGoals ? "Saving…" : "💾 Save Goals"}
                </button>
              </div>
            )}

            {/* PHOTOS */}
            {planTab === "photos" && (
              <>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 14,
                    flexWrap: "wrap",
                    gap: 10,
                  }}
                >
                  <div>
                    <h3 style={{ margin: 0 }}>📸 Weekly Photos</h3>
                    <p
                      style={{ margin: 0, color: "var(--muted)", fontSize: 12 }}
                    >
                      {weeklyPhotos.length} photo
                      {weeklyPhotos.length !== 1 ? "s" : ""} from client
                    </p>
                  </div>
                  {weeklyPhotos.length > 0 && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={async () => {
                        for (let i = 0; i < weeklyPhotos.length; i++) {
                          const p = weeklyPhotos[i];
                          await downloadPhoto(
                            p.photo_url,
                            `${selectedClient?.name}-week-${p.week_start}.jpg`
                          );
                          if (i < weeklyPhotos.length - 1)
                            await new Promise((r) => setTimeout(r, 600));
                        }
                        flash("All photos downloaded!");
                      }}
                    >
                      ⬇ Download All
                    </button>
                  )}
                </div>
                {loadingPhotos ? (
                  <div className="spinner" />
                ) : weeklyPhotos.length === 0 ? (
                  <div className="empty-state">
                    <div className="es-icon">📷</div>
                    <div className="es-title">No photos yet</div>
                    <div className="es-sub">
                      Client hasn't uploaded any weekly photos.
                    </div>
                  </div>
                ) : (
                  <div className="photo-grid">
                    {weeklyPhotos.map((photo) => {
                      const wl = new Date(
                        photo.week_start + "T00:00:00"
                      ).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      });
                      return (
                        <div key={photo.id} className="photo-card">
                          <img
                            src={photo.photo_url}
                            alt={`Week of ${wl}`}
                            onClick={() =>
                              window.open(photo.photo_url, "_blank")
                            }
                          />
                          <div className="photo-card-meta">
                            <div
                              style={{
                                fontWeight: 700,
                                color: "var(--text2)",
                                marginBottom: 2,
                              }}
                            >
                              Wk of {wl}
                            </div>
                            {photo.notes && <div>{photo.notes}</div>}
                            <button
                              className="btn btn-outline btn-xs"
                              style={{ width: "100%", marginTop: 6 }}
                              onClick={() =>
                                downloadPhoto(
                                  photo.photo_url,
                                  `${selectedClient?.name}-week-${photo.week_start}.jpg`
                                )
                              }
                            >
                              ⬇ Download
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── FOODS ── */}
        {view === "foods" && (
          <div className="page-enter">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 14,
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <div style={{ color: "var(--muted)", fontSize: 13 }}>
                {filteredFoods.length}/{foods.length} foods
              </div>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setShowAddFood(true)}
              >
                + Add Food
              </button>
            </div>
            <div className="search-bar">
              <input
                className="ff-input"
                placeholder="Search foods…"
                value={foodSearch}
                onChange={(e) => setFoodSearch(e.target.value)}
              />
            </div>
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <table className="ff-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Serving</th>
                    <th>Cal</th>
                    <th>P</th>
                    <th>C</th>
                    <th>F</th>
                    <th style={{ width: 44 }} />
                  </tr>
                </thead>
                <tbody>
                  {filteredFoods.map((f) => (
                    <tr key={f.id}>
                      <td style={{ fontWeight: 500 }}>{f.name}</td>
                      <td style={{ color: "var(--muted)", fontSize: 11 }}>
                        {servingLabel(f)}
                      </td>
                      <td style={{ fontSize: 12 }}>{f.calories_per_serving}</td>
                      <td style={{ color: "#f87171", fontSize: 12 }}>
                        {f.protein_per_serving}g
                      </td>
                      <td style={{ color: "var(--yellow)", fontSize: 12 }}>
                        {f.carbs_per_serving}g
                      </td>
                      <td style={{ color: "var(--accent2)", fontSize: 12 }}>
                        {f.fat_per_serving}g
                      </td>
                      <td>
                        <button
                          onClick={() => deleteFood(f.id, f.name)}
                          style={{
                            background: "var(--red-dim)",
                            color: "var(--red)",
                            border: "none",
                            borderRadius: 6,
                            padding: "3px 8px",
                            cursor: "pointer",
                            fontSize: 12,
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
          </div>
        )}

        {/* ── EXERCISES ── */}
        {view === "exercises" && (
          <div className="page-enter">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 14,
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <div style={{ color: "var(--muted)", fontSize: 13 }}>
                {exercises.length} exercises
              </div>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setShowAddExercise(true)}
              >
                + Add Exercise
              </button>
            </div>
            <div className="search-bar">
              <input
                className="ff-input"
                placeholder="Search exercises…"
                value={exerciseSearch}
                onChange={(e) => setExerciseSearch(e.target.value)}
              />
            </div>
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <table className="ff-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Muscle</th>
                    <th>Notes</th>
                    <th style={{ width: 44 }} />
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
                        <td>
                          <button
                            onClick={() => deleteExercise(ex.id, ex.name)}
                            style={{
                              background: "var(--red-dim)",
                              color: "var(--red)",
                              border: "none",
                              borderRadius: 6,
                              padding: "3px 8px",
                              cursor: "pointer",
                              fontSize: 12,
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
                  className="modal-sheet-inner"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="modal-title">➕ Add Exercise</div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}
                  >
                    <div>
                      <label className="ff-label">Exercise Name *</label>
                      <input
                        className="ff-input"
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
                      <label className="ff-label">Muscle Group</label>
                      <input
                        className="ff-input"
                        placeholder="e.g. Legs, Chest, Back"
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
                      <label className="ff-label">Notes / Instructions</label>
                      <input
                        className="ff-input"
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
                        gap: 10,
                        justifyContent: "flex-end",
                      }}
                    >
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => setShowAddExercise(false)}
                      >
                        Cancel
                      </button>
                      <button
                        className="btn btn-primary btn-sm"
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
          </div>
        )}
      </main>

      {/* Modals */}
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
