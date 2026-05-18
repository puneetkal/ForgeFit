// CoachSelf.tsx — Coach's personal fitness journey
// Diet plan builder + Workout plan builder + Progress tracking with macro rings

import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabase";

// ── Types ──────────────────────────────────────────────────────────────────────
type SelfTab = "diet" | "workout" | "progress" | "goals";

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

interface CoachMealItem {
  id: string;
  food_id: string;
  quantity: number;
  unit: string;
  food: Food | null;
}

interface CoachMeal {
  id: string;
  meal_name: string;
  meal_number: number;
  display_order: number;
  items: CoachMealItem[];
}

interface CoachWorkoutItem {
  id: string;
  exercise_id: string;
  exercise_name: string;
  muscle_group: string;
  sets: number;
  reps: number;
  weight_kg: number | null;
}

interface CoachProgress {
  id: string;
  date: string;
  diet_progress: number;
  workout_progress: number;
  weight_kg: number | null;
}

interface CoachGoals {
  calories_target: number;
  protein_target: number;
  carbs_target: number;
  fat_target: number;
}

interface MealDraft {
  meal_name: string;
  items: { food_id: string; quantity: number; unit: string; food?: Food }[];
}

interface WorkoutDraft {
  exercise_id: string;
  sets: number;
  reps: number;
  weight_kg: number | null;
  exercise?: Exercise;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
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
function pctColor(v: number) {
  if (v >= 80) return "var(--green)";
  if (v >= 50) return "#facc15";
  return "var(--red)";
}
function macroScale(food: Food, quantity: number): number {
  return quantity / (food.serving_size || 1);
}

// ── Day Strip ──────────────────────────────────────────────────────────────────
const PAST_DAYS = 6,
  FUTURE_DAYS = 6;

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
    const pillW = 72,
      gap = 6,
      pillCenter = idx * (pillW + gap) + pillW / 2;
    container.scrollTo({
      left: Math.max(0, pillCenter - container.clientWidth / 2),
      behavior: "smooth",
    });
  }, [selected]);

  return (
    <div
      ref={scrollRef}
      style={
        {
          display: "flex",
          gap: 6,
          overflowX: "auto",
          paddingBottom: 6,
          marginBottom: "1.25rem",
          scrollbarWidth: "none",
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
              width: 72,
              padding: "0.55rem 0.3rem",
              borderRadius: 10,
              cursor: "pointer",
              border: isSel
                ? "2px solid var(--accent)"
                : isToday
                ? "2px solid rgba(124,106,247,0.4)"
                : "2px solid var(--border)",
              background: isSel ? "var(--accent)" : "var(--surface2)",
              color: isSel ? "#fff" : isFuture ? "var(--muted)" : "inherit",
              fontWeight: isSel || isToday ? 700 : 400,
              fontSize: 12,
              position: "relative",
              textAlign: "center",
              lineHeight: 1.3,
              opacity: isFuture ? 0.7 : 1,
            }}
          >
            <div style={{ fontSize: 10, marginBottom: 1 }}>
              {isToday && !isSel
                ? "Today"
                : new Date(d + "T00:00:00").toLocaleDateString("en-GB", {
                    weekday: "short",
                  })}
            </div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>
              {new Date(d + "T00:00:00").getDate()}
            </div>
            <div style={{ fontSize: 9, opacity: 0.7 }}>
              {new Date(d + "T00:00:00").toLocaleDateString("en-GB", {
                month: "short",
              })}
            </div>
            {hasPlan && !isSel && (
              <span
                style={{
                  position: "absolute",
                  bottom: 3,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 4,
                  height: 4,
                  borderRadius: "50%",
                  background: "var(--accent2)",
                  display: "block",
                }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Progress Ring ──────────────────────────────────────────────────────────────
function ProgressRing({
  pct,
  color,
  label,
  size = 68,
}: {
  pct: number;
  color: string;
  label: string;
  size?: number;
}) {
  const r = size * 0.41,
    c = 2 * Math.PI * r;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
      }}
    >
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
          fontSize={size * 0.19}
          fontWeight={700}
        >
          {pct}%
        </text>
      </svg>
      <span style={{ fontSize: 12, color: "var(--muted)" }}>{label}</span>
    </div>
  );
}

// ── Macro Rings ────────────────────────────────────────────────────────────────
function MacroRings({
  meals,
  checkedItems,
  goals,
}: {
  meals: CoachMeal[];
  checkedItems: Set<string>;
  goals: CoachGoals;
}) {
  const checked = meals.flatMap((m) =>
    m.items.filter((i) => checkedItems.has(i.id))
  );
  const totCal = checked.reduce(
    (s, i) =>
      s +
      (i.food
        ? i.food.calories_per_serving * macroScale(i.food, i.quantity)
        : 0),
    0
  );
  const totP = checked.reduce(
    (s, i) =>
      s +
      (i.food
        ? i.food.protein_per_serving * macroScale(i.food, i.quantity)
        : 0),
    0
  );
  const totC = checked.reduce(
    (s, i) =>
      s +
      (i.food ? i.food.carbs_per_serving * macroScale(i.food, i.quantity) : 0),
    0
  );
  const totF = checked.reduce(
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

  if (
    goals.calories_target === 0 &&
    goals.protein_target === 0 &&
    goals.carbs_target === 0 &&
    goals.fat_target === 0
  )
    return null;

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
        📊 Macro Progress (checked items)
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
            circ = 2 * Math.PI * r;
          const offset = circ - (pct / 100) * circ;
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

// ── Weight Chart ───────────────────────────────────────────────────────────────
function WeightChart({ entries }: { entries: CoachProgress[] }) {
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

// ── Main CoachSelf Component ───────────────────────────────────────────────────
export default function CoachSelf({
  coachId,
  coachName,
  foods,
  exercises,
  onClose,
}: {
  coachId: string;
  coachName?: string;
  foods: Food[];
  exercises: Exercise[];
  onClose: () => void;
}) {
  const [tab, setTab] = useState<SelfTab>("diet");
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [planDates, setPlanDates] = useState<Set<string>>(new Set());
  const [loadingDay, setLoadingDay] = useState(false);

  // Diet state
  const [meals, setMeals] = useState<CoachMeal[]>([]);
  const [checkedMealItems, setCheckedMealItems] = useState<Set<string>>(
    new Set()
  );
  const [dietNote, setDietNote] = useState("");
  const [savingDiet, setSavingDiet] = useState(false);

  // Meal builder draft (for building new plans)
  const [mealDrafts, setMealDrafts] = useState<MealDraft[]>([]);
  const [dietDraftNote, setDietDraftNote] = useState("");
  const [buildingDiet, setBuildingDiet] = useState(false);

  // Workout state
  const [workoutItems, setWorkoutItems] = useState<CoachWorkoutItem[]>([]);
  const [checkedWorkoutItems, setCheckedWorkoutItems] = useState<Set<string>>(
    new Set()
  );
  const [workoutDrafts, setWorkoutDrafts] = useState<WorkoutDraft[]>([]);
  const [savingWorkout, setSavingWorkout] = useState(false);
  const [buildingWorkout, setBuildingWorkout] = useState(false);

  // Progress state
  const [progressHistory, setProgressHistory] = useState<CoachProgress[]>([]);
  const [weightInput, setWeightInput] = useState("");
  const [savingWeight, setSavingWeight] = useState(false);

  // Goals state
  const [goals, setGoals] = useState<CoachGoals>({
    calories_target: 0,
    protein_target: 0,
    carbs_target: 0,
    fat_target: 0,
  });
  const [goalsForm, setGoalsForm] = useState({
    calories_target: "",
    protein_target: "",
    carbs_target: "",
    fat_target: "",
  });
  const [savingGoals, setSavingGoals] = useState(false);

  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  function flash(m: string) {
    setMsg(m);
    setTimeout(() => setMsg(""), 3500);
  }

  useEffect(() => {
    init();
  }, [coachId]);

  async function init() {
    await Promise.all([
      loadPlanDates(),
      loadDayPlan(todayStr()),
      loadProgress(),
      loadGoals(),
    ]);
  }

  async function loadPlanDates() {
    const [{ data: pd }, { data: wpd }] = await Promise.all([
      supabase
        .from("coach_plan_days")
        .select("plan_date")
        .eq("coach_id", coachId),
      supabase
        .from("coach_workout_plan_days")
        .select("plan_date")
        .eq("coach_id", coachId),
    ]);
    const dates = new Set<string>();
    (pd || []).forEach((r: any) => dates.add(r.plan_date));
    (wpd || []).forEach((r: any) => dates.add(r.plan_date));
    setPlanDates(dates);
  }

  async function loadDayPlan(date: string) {
    setLoadingDay(true);

    // Load diet
    const { data: pd } = await supabase
      .from("coach_plan_days")
      .select("*, coach_meals(*, coach_meal_items(*, foods(*)))")
      .eq("coach_id", coachId)
      .eq("plan_date", date)
      .maybeSingle();

    if (pd?.coach_meals) {
      const sorted = [...pd.coach_meals].sort(
        (a: any, b: any) => a.display_order - b.display_order
      );
      setMeals(
        sorted.map((m: any) => ({
          id: m.id,
          meal_name: m.meal_name,
          meal_number: m.meal_number,
          display_order: m.display_order,
          items: (m.coach_meal_items || []).map((i: any) => ({
            id: i.id,
            food_id: i.food_id,
            quantity: i.quantity,
            unit: i.unit,
            food: i.foods || null,
          })),
        }))
      );
      setDietNote(pd.diet_note || "");
    } else {
      setMeals([]);
      setDietNote("");
    }

    // Load meal completions
    const { data: mc } = await supabase
      .from("coach_meal_completions")
      .select("coach_meal_item_id")
      .eq("coach_id", coachId)
      .eq("completed_date", date);
    setCheckedMealItems(
      new Set((mc || []).map((r: any) => r.coach_meal_item_id))
    );

    // Load workout
    const { data: wpd } = await supabase
      .from("coach_workout_plan_days")
      .select("*, coach_workout_day_items(*, exercises(*))")
      .eq("coach_id", coachId)
      .eq("plan_date", date)
      .maybeSingle();

    if (wpd?.coach_workout_day_items) {
      const sorted = [...wpd.coach_workout_day_items].sort(
        (a: any, b: any) => a.display_order - b.display_order
      );
      setWorkoutItems(
        sorted.map((i: any) => ({
          id: i.id,
          exercise_id: i.exercise_id,
          exercise_name: i.exercises?.name || "Unknown",
          muscle_group: i.exercises?.muscle_group || "",
          sets: i.sets,
          reps: i.reps,
          weight_kg: i.weight_kg,
        }))
      );
    } else {
      setWorkoutItems([]);
    }

    // Load workout completions
    const { data: wc } = await supabase
      .from("coach_workout_completions")
      .select("coach_workout_item_id")
      .eq("coach_id", coachId)
      .eq("completed_date", date);
    setCheckedWorkoutItems(
      new Set((wc || []).map((r: any) => r.coach_workout_item_id))
    );

    setLoadingDay(false);
  }

  async function loadProgress() {
    const { data } = await supabase
      .from("coach_progress_entries")
      .select("*")
      .eq("coach_id", coachId)
      .order("date", { ascending: false })
      .limit(90);
    setProgressHistory(data || []);
  }

  async function loadGoals() {
    const { data } = await supabase
      .from("coach_goals")
      .select("*")
      .eq("coach_id", coachId)
      .maybeSingle();
    if (data) {
      setGoals(data);
      setGoalsForm({
        calories_target: String(data.calories_target || ""),
        protein_target: String(data.protein_target || ""),
        carbs_target: String(data.carbs_target || ""),
        fat_target: String(data.fat_target || ""),
      });
    }
  }

  async function handleDateChange(date: string) {
    setSelectedDate(date);
    await loadDayPlan(date);
  }

  // ── Persist meal tick ────────────────────────────────────────────────────────
  async function persistMealTick(
    nextChecked: Set<string>,
    currentMeals: CoachMeal[]
  ) {
    await supabase
      .from("coach_meal_completions")
      .delete()
      .eq("coach_id", coachId)
      .eq("completed_date", selectedDate);
    if (nextChecked.size > 0)
      await supabase.from("coach_meal_completions").insert(
        [...nextChecked].map((coach_meal_item_id) => ({
          coach_id: coachId,
          coach_meal_item_id,
          completed_date: selectedDate,
        }))
      );
    const allIds = currentMeals.flatMap((m) => m.items.map((i) => i.id));
    const dp =
      allIds.length > 0
        ? Math.round(
            (allIds.filter((id) => nextChecked.has(id)).length /
              allIds.length) *
              100
          )
        : 0;
    const wp =
      workoutItems.length > 0
        ? Math.round(
            (workoutItems.filter((i) => checkedWorkoutItems.has(i.id)).length /
              workoutItems.length) *
              100
          )
        : 0;
    await supabase.from("coach_progress_entries").upsert(
      {
        coach_id: coachId,
        date: selectedDate,
        diet_progress: dp,
        workout_progress: wp,
      },
      { onConflict: "coach_id,date" }
    );
    await loadProgress();
  }

  async function persistWorkoutTick(nextChecked: Set<string>) {
    await supabase
      .from("coach_workout_completions")
      .delete()
      .eq("coach_id", coachId)
      .eq("completed_date", selectedDate);
    if (nextChecked.size > 0)
      await supabase.from("coach_workout_completions").insert(
        [...nextChecked].map((coach_workout_item_id) => ({
          coach_id: coachId,
          coach_workout_item_id,
          completed_date: selectedDate,
        }))
      );
    const allIds = meals.flatMap((m) => m.items.map((i) => i.id));
    const dp =
      allIds.length > 0
        ? Math.round(
            (allIds.filter((id) => checkedMealItems.has(id)).length /
              allIds.length) *
              100
          )
        : 0;
    const wp =
      workoutItems.length > 0
        ? Math.round(
            (workoutItems.filter((i) => nextChecked.has(i.id)).length /
              workoutItems.length) *
              100
          )
        : 0;
    await supabase.from("coach_progress_entries").upsert(
      {
        coach_id: coachId,
        date: selectedDate,
        diet_progress: dp,
        workout_progress: wp,
      },
      { onConflict: "coach_id,date" }
    );
    await loadProgress();
  }

  function toggleMealItem(id: string) {
    setCheckedMealItems((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      persistMealTick(next, meals);
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

  // ── Save Diet Plan ───────────────────────────────────────────────────────────
  async function saveDietPlan() {
    if (!mealDrafts.length) return;
    setSavingDiet(true);
    const { data: pd, error: pe } = await supabase
      .from("coach_plan_days")
      .upsert(
        {
          coach_id: coachId,
          plan_date: selectedDate,
          diet_note: dietDraftNote,
        },
        { onConflict: "coach_id,plan_date" }
      )
      .select()
      .single();
    if (pe) {
      setError(pe.message);
      setSavingDiet(false);
      return;
    }

    // Clear old meals
    const { data: oldMeals } = await supabase
      .from("coach_meals")
      .select("id")
      .eq("coach_plan_day_id", pd.id);
    if (oldMeals?.length) {
      await supabase
        .from("coach_meal_items")
        .delete()
        .in(
          "coach_meal_id",
          oldMeals.map((m: any) => m.id)
        );
      await supabase
        .from("coach_meals")
        .delete()
        .eq("coach_plan_day_id", pd.id);
    }

    for (let mi = 0; mi < mealDrafts.length; mi++) {
      const m = mealDrafts[mi];
      const { data: mRow } = await supabase
        .from("coach_meals")
        .insert({
          coach_plan_day_id: pd.id,
          meal_name: m.meal_name,
          meal_number: mi + 1,
          display_order: mi + 1,
        })
        .select()
        .single();
      if (mRow && m.items.length > 0) {
        await supabase.from("coach_meal_items").insert(
          m.items.map((i) => ({
            coach_meal_id: mRow.id,
            food_id: i.food_id,
            quantity: i.quantity,
            unit: i.unit,
          }))
        );
      }
    }

    setPlanDates((prev) => new Set([...prev, selectedDate]));
    setBuildingDiet(false);
    setMealDrafts([]);
    setDietDraftNote("");
    await loadDayPlan(selectedDate);
    flash("✓ Diet plan saved!");
    setSavingDiet(false);
  }

  // ── Delete Diet Plan ─────────────────────────────────────────────────────────
  async function deleteDietPlan() {
    if (!confirm("Delete your diet plan for this day?")) return;
    const { data: pd } = await supabase
      .from("coach_plan_days")
      .select("id")
      .eq("coach_id", coachId)
      .eq("plan_date", selectedDate)
      .maybeSingle();
    if (pd) {
      const { data: oldMeals } = await supabase
        .from("coach_meals")
        .select("id")
        .eq("coach_plan_day_id", pd.id);
      if (oldMeals?.length) {
        await supabase
          .from("coach_meal_items")
          .delete()
          .in(
            "coach_meal_id",
            oldMeals.map((m: any) => m.id)
          );
        await supabase
          .from("coach_meals")
          .delete()
          .eq("coach_plan_day_id", pd.id);
      }
      await supabase.from("coach_plan_days").delete().eq("id", pd.id);
      await supabase
        .from("coach_meal_completions")
        .delete()
        .eq("coach_id", coachId)
        .eq("completed_date", selectedDate);
    }
    setMeals([]);
    setCheckedMealItems(new Set());
    setPlanDates((prev) => {
      const next = new Set(prev);
      // only remove if no workout plan either
      next.delete(selectedDate);
      return next;
    });
    await loadPlanDates();
    flash("Diet plan removed.");
  }

  // ── Save Workout Plan ────────────────────────────────────────────────────────
  async function saveWorkoutPlan() {
    if (!workoutDrafts.length) return;
    setSavingWorkout(true);
    const { data: wpd, error: we } = await supabase
      .from("coach_workout_plan_days")
      .upsert(
        { coach_id: coachId, plan_date: selectedDate },
        { onConflict: "coach_id,plan_date" }
      )
      .select()
      .single();
    if (we) {
      setError(we.message);
      setSavingWorkout(false);
      return;
    }

    await supabase
      .from("coach_workout_day_items")
      .delete()
      .eq("coach_workout_plan_day_id", wpd.id);
    await supabase.from("coach_workout_day_items").insert(
      workoutDrafts.map((i, idx) => ({
        coach_workout_plan_day_id: wpd.id,
        exercise_id: i.exercise_id,
        sets: i.sets,
        reps: i.reps,
        weight_kg: i.weight_kg || null,
        display_order: idx + 1,
      }))
    );

    setPlanDates((prev) => new Set([...prev, selectedDate]));
    setBuildingWorkout(false);
    setWorkoutDrafts([]);
    await loadDayPlan(selectedDate);
    flash("✓ Workout plan saved!");
    setSavingWorkout(false);
  }

  // ── Delete Workout Plan ──────────────────────────────────────────────────────
  async function deleteWorkoutPlan() {
    if (!confirm("Delete your workout plan for this day?")) return;
    const { data: wpd } = await supabase
      .from("coach_workout_plan_days")
      .select("id")
      .eq("coach_id", coachId)
      .eq("plan_date", selectedDate)
      .maybeSingle();
    if (wpd) {
      await supabase
        .from("coach_workout_day_items")
        .delete()
        .eq("coach_workout_plan_day_id", wpd.id);
      await supabase.from("coach_workout_plan_days").delete().eq("id", wpd.id);
      await supabase
        .from("coach_workout_completions")
        .delete()
        .eq("coach_id", coachId)
        .eq("completed_date", selectedDate);
    }
    setWorkoutItems([]);
    setCheckedWorkoutItems(new Set());
    await loadPlanDates();
    flash("Workout plan removed.");
  }

  // ── Save Goals ───────────────────────────────────────────────────────────────
  async function saveGoals() {
    setSavingGoals(true);
    const payload = {
      coach_id: coachId,
      calories_target: parseFloat(goalsForm.calories_target) || 0,
      protein_target: parseFloat(goalsForm.protein_target) || 0,
      carbs_target: parseFloat(goalsForm.carbs_target) || 0,
      fat_target: parseFloat(goalsForm.fat_target) || 0,
    };
    await supabase
      .from("coach_goals")
      .upsert(payload, { onConflict: "coach_id" });
    setGoals(payload);
    flash("Goals saved!");
    setSavingGoals(false);
  }

  // ── Save weight ──────────────────────────────────────────────────────────────
  async function saveWeight() {
    if (!weightInput) return;
    setSavingWeight(true);
    const today = todayStr();
    const existing = progressHistory.find((p) => p.date === today);
    await supabase.from("coach_progress_entries").upsert(
      {
        coach_id: coachId,
        date: today,
        diet_progress: existing?.diet_progress || 0,
        workout_progress: existing?.workout_progress || 0,
        weight_kg: parseFloat(weightInput),
      },
      { onConflict: "coach_id,date" }
    );
    await loadProgress();
    setWeightInput("");
    flash("Weight logged!");
    setSavingWeight(false);
  }

  // ── Meal draft helpers ───────────────────────────────────────────────────────
  const MEAL_NAMES = [
    "Breakfast",
    "Mid-Morning Snack",
    "Lunch",
    "Evening Snack",
    "Dinner",
    "Pre-Workout",
    "Post-Workout",
  ];

  function addMealDraft() {
    setMealDrafts((prev) => [
      ...prev,
      {
        meal_name: MEAL_NAMES[prev.length] || `Meal ${prev.length + 1}`,
        items: [],
      },
    ]);
  }

  function addMealDraftItem(mi: number) {
    if (!foods.length) return;
    const f = foods[0];
    setMealDrafts((prev) =>
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

  function updateMealDraftItem(
    mi: number,
    ii: number,
    field: string,
    value: any
  ) {
    setMealDrafts((prev) =>
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

  function addWorkoutDraft() {
    if (!exercises.length) return;
    const ex = exercises[0];
    setWorkoutDrafts((prev) => [
      ...prev,
      { exercise_id: ex.id, sets: 3, reps: 10, weight_kg: null, exercise: ex },
    ]);
  }

  function updateWorkoutDraft(idx: number, field: string, value: any) {
    setWorkoutDrafts((prev) =>
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

  // ── Computed values ──────────────────────────────────────────────────────────
  const allMealItemIds = meals.flatMap((m) => m.items.map((i) => i.id));
  const dietPct =
    allMealItemIds.length > 0
      ? Math.round(
          (allMealItemIds.filter((id) => checkedMealItems.has(id)).length /
            allMealItemIds.length) *
            100
        )
      : 0;
  const workoutPct =
    workoutItems.length > 0
      ? Math.round(
          (workoutItems.filter((i) => checkedWorkoutItems.has(i.id)).length /
            workoutItems.length) *
            100
        )
      : 0;

  const avgDiet = progressHistory.length
    ? Math.round(
        progressHistory.reduce((s, p) => s + p.diet_progress, 0) /
          progressHistory.length
      )
    : 0;
  const avgWorkout = progressHistory.length
    ? Math.round(
        progressHistory.reduce((s, p) => s + p.workout_progress, 0) /
          progressHistory.length
      )
    : 0;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--bg, #0d0d18)",
        zIndex: 200,
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "linear-gradient(135deg, var(--accent) 0%, #a855f7 100%)",
          padding: "1.25rem 1rem 1rem",
          position: "sticky",
          top: 0,
          zIndex: 10,
          boxShadow: "0 4px 24px rgba(124,106,247,0.35)",
        }}
      >
        <div
          style={{
            maxWidth: 720,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            gap: "1rem",
          }}
        >
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.15)",
              border: "none",
              borderRadius: 10,
              padding: "0.5rem 0.85rem",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 14,
              backdropFilter: "blur(8px)",
            }}
          >
            ← Back
          </button>
          <div>
            <div
              style={{
                fontFamily: "Syne, sans-serif",
                fontWeight: 800,
                fontSize: "1.15rem",
                color: "#fff",
              }}
            >
              🏅 My Journey
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)" }}>
              {coachName || "Coach"} · Personal fitness tracking
            </div>
          </div>
          {/* Quick progress rings in header */}
          <div style={{ marginLeft: "auto", display: "flex", gap: "1rem" }}>
            <ProgressRing pct={dietPct} color="#22c55e" label="" size={44} />
            <ProgressRing pct={workoutPct} color="#3b82f6" label="" size={44} />
          </div>
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "1.5rem 1rem 3rem",
          flex: 1,
          width: "100%",
        }}
      >
        {msg && (
          <div className="alert alert-success" style={{ marginBottom: "1rem" }}>
            {msg}
          </div>
        )}
        {error && (
          <div
            className="alert alert-error"
            style={{ marginBottom: "1rem", cursor: "pointer" }}
            onClick={() => setError("")}
          >
            {error} ✕
          </div>
        )}

        {/* Tabs */}
        <div className="tab-bar" style={{ marginBottom: "1.25rem" }}>
          {(["diet", "workout", "progress", "goals"] as SelfTab[]).map((t) => (
            <button
              key={t}
              className={`tab ${tab === t ? "active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t === "diet"
                ? "🥗 Diet"
                : t === "workout"
                ? "🏋️ Workout"
                : t === "progress"
                ? "📊 Progress"
                : "🎯 Goals"}
            </button>
          ))}
        </div>

        <DayStrip
          selected={selectedDate}
          onChange={handleDateChange}
          planDates={planDates}
        />

        {loadingDay ? (
          <div style={{ textAlign: "center", padding: "3rem" }}>
            <div className="spinner" />
          </div>
        ) : (
          <>
            {/* ── DIET TAB ── */}
            {tab === "diet" && (
              <>
                {/* Macro rings if goals are set */}
                {goals.calories_target > 0 && (
                  <MacroRings
                    meals={meals}
                    checkedItems={checkedMealItems}
                    goals={goals}
                  />
                )}

                {/* Today progress ring */}
                {meals.length > 0 && (
                  <div
                    className="card"
                    style={{
                      marginBottom: "1.25rem",
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
                      <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>
                        {checkedMealItems.size} / {allMealItemIds.length} items
                        completed
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
                    </div>
                  </div>
                )}

                {/* Existing plan */}
                {meals.length > 0 && !buildingDiet && (
                  <>
                    {meals.map((meal) => {
                      const mealIds = meal.items.map((i) => i.id);
                      const doneCount = mealIds.filter((id) =>
                        checkedMealItems.has(id)
                      ).length;
                      const mealPct =
                        mealIds.length > 0
                          ? Math.round((doneCount / mealIds.length) * 100)
                          : 0;
                      const allDone =
                        doneCount === mealIds.length && mealIds.length > 0;
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
                                  style={{
                                    fontSize: 12,
                                    color: "var(--muted)",
                                  }}
                                >
                                  {doneCount}/{mealIds.length} items
                                </div>
                              </div>
                            </div>
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: pctColor(mealPct),
                              }}
                            >
                              {mealPct}%
                            </span>
                          </div>
                          <div style={{ padding: "0.5rem 0" }}>
                            {meal.items.map((item) => {
                              const done = checkedMealItems.has(item.id);
                              const scale = item.food
                                ? macroScale(item.food, item.quantity)
                                : 0;
                              return (
                                <div
                                  key={item.id}
                                  onClick={() => toggleMealItem(item.id)}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.75rem",
                                    padding: "0.65rem 1rem",
                                    cursor: "pointer",
                                    background: done
                                      ? "rgba(34,197,94,0.04)"
                                      : "transparent",
                                    borderBottom: "1px solid var(--border)",
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
                                        color: done
                                          ? "var(--muted)"
                                          : "inherit",
                                      }}
                                    >
                                      {item.food?.name || "Unknown"}{" "}
                                      <span
                                        style={{
                                          fontWeight: 400,
                                          color: "var(--muted)",
                                          fontSize: 13,
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
                                          item.food.calories_per_serving * scale
                                        )}{" "}
                                        kcal · P:
                                        {Math.round(
                                          item.food.protein_per_serving * scale
                                        )}
                                        g · C:
                                        {Math.round(
                                          item.food.carbs_per_serving * scale
                                        )}
                                        g · F:
                                        {Math.round(
                                          item.food.fat_per_serving * scale
                                        )}
                                        g
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                    {/* Action buttons for existing plan */}
                    <div
                      style={{
                        display: "flex",
                        gap: "0.75rem",
                        flexWrap: "wrap",
                        marginTop: "0.5rem",
                      }}
                    >
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => {
                          // Load existing plan into draft for editing
                          setMealDrafts(
                            meals.map((m) => ({
                              meal_name: m.meal_name,
                              items: m.items.map((i) => ({
                                food_id: i.food_id,
                                quantity: i.quantity,
                                unit: i.unit,
                                food: i.food || undefined,
                              })),
                            }))
                          );
                          setDietDraftNote(dietNote);
                          setBuildingDiet(true);
                        }}
                      >
                        ✏️ Edit Plan
                      </button>
                      <button
                        className="btn btn-sm"
                        style={{
                          background: "rgba(248,113,113,0.15)",
                          color: "var(--red)",
                        }}
                        onClick={deleteDietPlan}
                      >
                        🗑 Remove Plan
                      </button>
                    </div>
                  </>
                )}

                {/* No plan yet */}
                {meals.length === 0 && !buildingDiet && (
                  <div
                    className="card"
                    style={{
                      textAlign: "center",
                      padding: "2.5rem",
                      color: "var(--muted)",
                      marginBottom: "1rem",
                    }}
                  >
                    No diet plan for this day.
                    <br />
                    <button
                      className="btn btn-primary"
                      style={{ marginTop: "1rem" }}
                      onClick={() => {
                        setBuildingDiet(true);
                        addMealDraft();
                      }}
                    >
                      + Create Diet Plan
                    </button>
                  </div>
                )}

                {/* Builder */}
                {buildingDiet && (
                  <div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "1rem",
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "Syne, sans-serif",
                          fontWeight: 700,
                          fontSize: "1rem",
                        }}
                      >
                        🏗 Building Diet Plan
                      </div>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => {
                          setBuildingDiet(false);
                          setMealDrafts([]);
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                    <div style={{ marginBottom: "0.75rem" }}>
                      <label className="label">Day Note (optional)</label>
                      <input
                        className="input"
                        placeholder="e.g. High carb day…"
                        value={dietDraftNote}
                        onChange={(e) => setDietDraftNote(e.target.value)}
                      />
                    </div>
                    {mealDrafts.map((meal, mi) => {
                      const totalCal = meal.items.reduce(
                        (s, it) =>
                          s +
                          (it.food
                            ? it.food.calories_per_serving *
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
                              style={{ flex: 1, fontWeight: 600 }}
                              value={meal.meal_name}
                              onChange={(e) =>
                                setMealDrafts((prev) =>
                                  prev.map((m, i) =>
                                    i !== mi
                                      ? m
                                      : { ...m, meal_name: e.target.value }
                                  )
                                )
                              }
                            />
                            {meal.items.length > 0 && (
                              <span
                                style={{
                                  fontSize: 12,
                                  color: "var(--accent)",
                                  fontWeight: 700,
                                }}
                              >
                                {Math.round(totalCal)} kcal
                              </span>
                            )}
                            <button
                              className="btn btn-sm"
                              style={{
                                background: "rgba(248,113,113,0.15)",
                                color: "var(--red)",
                              }}
                              onClick={() =>
                                setMealDrafts((prev) =>
                                  prev.filter((_, i) => i !== mi)
                                )
                              }
                            >
                              ✕
                            </button>
                          </div>
                          <div style={{ padding: "0.5rem 0.9rem" }}>
                            {meal.items.map((item, ii) => (
                              <div
                                key={ii}
                                style={{
                                  background: "var(--bg, #0d0d18)",
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
                                      updateMealDraftItem(
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
                                        updateMealDraftItem(
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
                                      {item.unit}
                                    </span>
                                  </div>
                                  <button
                                    onClick={() =>
                                      setMealDrafts((prev) =>
                                        prev.map((m, i) =>
                                          i !== mi
                                            ? m
                                            : {
                                                ...m,
                                                items: m.items.filter(
                                                  (_, j) => j !== ii
                                                ),
                                              }
                                        )
                                      )
                                    }
                                    style={{
                                      background: "rgba(248,113,113,0.15)",
                                      color: "var(--red)",
                                      border: "none",
                                      borderRadius: 6,
                                      cursor: "pointer",
                                      height: 36,
                                      fontWeight: 700,
                                    }}
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>
                            ))}
                            <button
                              className="btn btn-outline btn-sm"
                              style={{ marginTop: "0.25rem" }}
                              onClick={() => addMealDraftItem(mi)}
                            >
                              + Add Food
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    <div
                      style={{
                        display: "flex",
                        gap: "0.75rem",
                        flexWrap: "wrap",
                      }}
                    >
                      <button
                        className="btn btn-outline"
                        onClick={addMealDraft}
                      >
                        + Add Meal
                      </button>
                      <button
                        className="btn btn-primary"
                        onClick={saveDietPlan}
                        disabled={savingDiet || mealDrafts.length === 0}
                      >
                        {savingDiet ? "Saving…" : "💾 Save Diet Plan"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Add plan button if no plan and not building */}
                {meals.length > 0 && !buildingDiet && (
                  <div style={{ marginTop: "0.5rem" }}>
                    {/* already shown above */}
                  </div>
                )}
                {meals.length === 0 && !buildingDiet && <></>}
              </>
            )}

            {/* ── WORKOUT TAB ── */}
            {tab === "workout" && (
              <>
                {workoutItems.length > 0 && (
                  <div
                    className="card"
                    style={{
                      marginBottom: "1.25rem",
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
                      <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>
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
                    </div>
                  </div>
                )}

                {/* Existing workout */}
                {workoutItems.length > 0 && !buildingWorkout && (
                  <>
                    {workoutItems.map((item, idx) => {
                      const done = checkedWorkoutItems.has(item.id);
                      return (
                        <div
                          key={item.id}
                          onClick={() => toggleWorkoutItem(item.id)}
                          style={{
                            borderRadius: 12,
                            overflow: "hidden",
                            border: `2px solid ${
                              done ? "var(--green)" : "var(--border)"
                            }`,
                            marginBottom: "0.5rem",
                            background: done
                              ? "rgba(34,197,94,0.06)"
                              : "var(--surface2)",
                            display: "flex",
                            alignItems: "center",
                            gap: "1rem",
                            padding: "0.85rem 1rem",
                            cursor: "pointer",
                            userSelect: "none",
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
                            }}
                          >
                            {done ? "✓" : idx + 1}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div
                              style={{
                                fontWeight: 700,
                                textDecoration: done ? "line-through" : "none",
                                color: done ? "var(--muted)" : "inherit",
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
                          </div>
                          {done && <span className="badge badge-green">✓</span>}
                        </div>
                      );
                    })}
                    <div
                      style={{
                        display: "flex",
                        gap: "0.75rem",
                        flexWrap: "wrap",
                        marginTop: "0.5rem",
                      }}
                    >
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => {
                          setWorkoutDrafts(
                            workoutItems.map((i) => ({
                              exercise_id: i.exercise_id,
                              sets: i.sets,
                              reps: i.reps,
                              weight_kg: i.weight_kg,
                              exercise: exercises.find(
                                (e) => e.id === i.exercise_id
                              ),
                            }))
                          );
                          setBuildingWorkout(true);
                        }}
                      >
                        ✏️ Edit Plan
                      </button>
                      <button
                        className="btn btn-sm"
                        style={{
                          background: "rgba(248,113,113,0.15)",
                          color: "var(--red)",
                        }}
                        onClick={deleteWorkoutPlan}
                      >
                        🗑 Remove Plan
                      </button>
                    </div>
                  </>
                )}

                {workoutItems.length === 0 && !buildingWorkout && (
                  <div
                    className="card"
                    style={{
                      textAlign: "center",
                      padding: "2.5rem",
                      color: "var(--muted)",
                      marginBottom: "1rem",
                    }}
                  >
                    No workout plan for this day.
                    <br />
                    <button
                      className="btn btn-primary"
                      style={{ marginTop: "1rem" }}
                      onClick={() => {
                        setBuildingWorkout(true);
                        addWorkoutDraft();
                      }}
                    >
                      + Create Workout Plan
                    </button>
                  </div>
                )}

                {/* Builder */}
                {buildingWorkout && (
                  <div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "1rem",
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "Syne, sans-serif",
                          fontWeight: 700,
                        }}
                      >
                        🏗 Building Workout Plan
                      </div>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => {
                          setBuildingWorkout(false);
                          setWorkoutDrafts([]);
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                    {workoutDrafts.map((item, idx) => (
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
                              updateWorkoutDraft(
                                idx,
                                "exercise_id",
                                e.target.value
                              )
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
                              setWorkoutDrafts((prev) =>
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
                              updateWorkoutDraft(
                                idx,
                                "sets",
                                parseInt(e.target.value) || 1
                              )
                            }
                          />
                          <span
                            style={{ color: "var(--muted)", fontWeight: 700 }}
                          >
                            ×
                          </span>
                          <input
                            className="input"
                            type="number"
                            style={{ width: 60 }}
                            placeholder="Reps"
                            value={item.reps}
                            onChange={(e) =>
                              updateWorkoutDraft(
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
                              updateWorkoutDraft(
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
                      <button
                        className="btn btn-outline"
                        onClick={addWorkoutDraft}
                      >
                        + Add Exercise
                      </button>
                      <button
                        className="btn btn-primary"
                        onClick={saveWorkoutPlan}
                        disabled={savingWorkout || workoutDrafts.length === 0}
                      >
                        {savingWorkout ? "Saving…" : "💾 Save Workout Plan"}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── PROGRESS TAB ── */}
            {tab === "progress" && (
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
                      val: progressHistory[0]?.weight_kg
                        ? `${progressHistory[0].weight_kg} kg`
                        : "—",
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
                <div className="card" style={{ marginBottom: "1.25rem" }}>
                  <div
                    className="section-title"
                    style={{ marginBottom: "0.75rem" }}
                  >
                    Weight Over Time
                  </div>
                  <WeightChart entries={progressHistory} />
                </div>
                <div
                  className="card"
                  style={{
                    marginBottom: "1.25rem",
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
                      placeholder="e.g. 80.5"
                      value={weightInput}
                      onChange={(e) => setWeightInput(e.target.value)}
                    />
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={saveWeight}
                    disabled={savingWeight || !weightInput}
                  >
                    {savingWeight ? "…" : "Log"}
                  </button>
                </div>
                {progressHistory.length > 0 && (
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
                        {progressHistory.slice(0, 20).map((p) => (
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
                              <span
                                style={{
                                  color: pctColor(p.diet_progress),
                                  fontWeight: 600,
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
                                  fontWeight: 600,
                                  fontSize: 13,
                                }}
                              >
                                {p.workout_progress}%
                              </span>
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

            {/* ── GOALS TAB ── */}
            {tab === "goals" && (
              <div className="card">
                <div className="section-title" style={{ marginBottom: "1rem" }}>
                  🎯 My Daily Macro Targets
                </div>
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
                      <label className="label" style={{ color, fontSize: 12 }}>
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
                {goals.calories_target > 0 && (
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
                      {goals.calories_target} kcal
                    </span>
                    {" · "}
                    <span style={{ color: "#f87171" }}>
                      P {goals.protein_target}g
                    </span>
                    {" · "}
                    <span style={{ color: "#facc15" }}>
                      C {goals.carbs_target}g
                    </span>
                    {" · "}
                    <span style={{ color: "var(--accent2)" }}>
                      F {goals.fat_target}g
                    </span>
                  </div>
                )}
                <button
                  className="btn btn-primary"
                  onClick={saveGoals}
                  disabled={savingGoals}
                >
                  {savingGoals ? "Saving…" : "💾 Save Goals"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
