// AiIntake.tsx — quick 5-question intake (goal, sex, age, height, weight), then AI builds the plan
import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabase";

const AI_FUNCTION = "swift-action"; // name of the deployed Edge Function

type Msg = { role: "user" | "assistant"; content: string };

export async function callAi(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke(AI_FUNCTION, { body });
  if (error) {
    let msg = error.message;
    try {
      const j = await (error as any).context?.json?.();
      if (j?.error) msg = j.error;
    } catch {}
    throw new Error(msg);
  }
  return data as any;
}

const GOALS = [
  ["Lose fat", "fat_loss"],
  ["Build muscle", "muscle_gain"],
  ["Maintain", "maintenance"],
  ["Get stronger", "strength"],
];
const SEXES = [
  ["Male", "male"],
  ["Female", "female"],
  ["Other", "other"],
];
type Step = "goal" | "sex" | "age" | "height" | "weight";
const ORDER: Step[] = ["goal", "sex", "age", "height", "weight"];
const QUESTION: Record<Step, string> = {
  goal: "Hi! I'm your ForgeFit assistant. What's your main goal?",
  sex: "Are you male or female?",
  age: "How old are you?",
  height: "What's your height in cm? (e.g. 172)",
  weight: "And your current weight in kg? (e.g. 70)",
};
const RANGE: Record<string, [number, number]> = {
  age: [12, 90],
  height: [120, 230],
  weight: [30, 250],
};

export default function AiIntake({
  today,
  onDone,
  onSkip,
}: {
  today: string;
  onDone: () => void;
  onSkip: () => void;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([{ role: "assistant", content: QUESTION.goal }]);
  const [step, setStep] = useState<Step>("goal");
  const [ans, setAns] = useState<Record<string, any>>({});
  const [input, setInput] = useState("");
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, building]);

  async function submit(all: Record<string, any>) {
    setBuilding(true);
    setError("");
    try {
      await callAi({ action: "submit_intake", answers: all, today });
      await callAi({ action: "ensure_week", today, force: true });
      onDone();
    } catch (e: any) {
      setError(e.message);
      setBuilding(false);
    }
  }

  function answer(shown: string, value: any) {
    const next = { ...ans, [step]: value };
    setAns(next);
    const nextMsgs: Msg[] = [...msgs, { role: "user", content: shown }];
    const i = ORDER.indexOf(step);
    if (i < ORDER.length - 1) {
      const ns = ORDER[i + 1];
      setMsgs([...nextMsgs, { role: "assistant", content: QUESTION[ns] }]);
      setStep(ns);
    } else {
      setMsgs([...nextMsgs, { role: "assistant", content: "Thanks! Building your diet and workout plan now…" }]);
      submit({
        goal: next.goal,
        sex: next.sex,
        age: next.age,
        height_cm: next.height,
        weight_kg: next.weight,
      });
    }
  }

  function sendNumber() {
    const n = parseFloat(input.replace(",", "."));
    const [lo, hi] = RANGE[step];
    if (!isFinite(n) || n < lo || n > hi) {
      setError(`Please enter a number between ${lo} and ${hi}.`);
      return;
    }
    setError("");
    setInput("");
    answer(String(n), n);
  }

  const chips = step === "goal" ? GOALS : step === "sex" ? SEXES : null;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000, background: "var(--bg)",
        display: "flex", flexDirection: "column", fontFamily: "var(--font)",
      }}
    >
      <div
        style={{
          padding: "14px 16px", borderBottom: "1px solid var(--border2)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          color: "var(--text)",
        }}
      >
        <b>🤖 Let's build your plan</b>
        {!building && (
          <button className="btn btn-outline btn-sm" onClick={onSkip}>
            Later
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        {msgs.map((m, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: m.role === "user" ? "flex-end" : "flex-start",
              marginBottom: 10,
            }}
          >
            <div
              style={{
                maxWidth: "80%", padding: "10px 14px", borderRadius: 16, fontSize: 14,
                whiteSpace: "pre-wrap",
                background: m.role === "user" ? "var(--accent)" : "var(--surface2)",
                color: m.role === "user" ? "#fff" : "var(--text)",
              }}
            >
              {m.content}
            </div>
          </div>
        ))}
        {building && !error && (
          <div style={{ color: "var(--text2)", fontSize: 14 }}>
            ⏳ This can take up to a minute…
          </div>
        )}
        {error && (
          <div style={{ color: "var(--red)", fontSize: 13, marginTop: 8 }}>
            {error}
            {building && (
              <div style={{ marginTop: 8 }}>
                <button className="btn btn-primary btn-sm" onClick={() => submit({
                  goal: ans.goal, sex: ans.sex, age: ans.age,
                  height_cm: ans.height, weight_kg: ans.weight,
                })}>
                  Try again
                </button>
              </div>
            )}
          </div>
        )}
        <div ref={endRef} />
      </div>

      {!building && (
        <div style={{ padding: 12, borderTop: "1px solid var(--border2)" }}>
          {chips ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {chips.map(([label, value]) => (
                <button key={value} className="btn btn-outline" onClick={() => answer(label, value)}>
                  {label}
                </button>
              ))}
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={input}
                type="number"
                inputMode="decimal"
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendNumber()}
                placeholder="Type a number…"
                style={{
                  flex: 1, padding: "10px 12px", borderRadius: 10, fontSize: 14,
                  border: "1px solid var(--border2)", background: "var(--surface)",
                  color: "var(--text)",
                }}
              />
              <button className="btn btn-primary" onClick={sendNumber} disabled={!input.trim()}>
                Send
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}