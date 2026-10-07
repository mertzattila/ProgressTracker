/* ===========================================================================
 * CaliForge — Application shell & pages
 * ---------------------------------------------------------------------------
 * Composes the store, planner, coach, and UI primitives into the full app:
 *   - responsive navigation (sidebar on desktop, bottom bar on mobile)
 *   - Dashboard (multi-goal cards + add-goal flow)
 *   - Schedule Builder (weekly overview + interactive daily view)
 *   - AI Coach page + floating chat widget
 * ========================================================================= */

(function () {
  const { useState, useMemo, useEffect, useRef, useCallback } = React;
  const CF = window.CF;
  const { SKILLS, SKILL_BY_ID } = CF;
  const P = CF.planner;
  const { Icon, Logo, Button, ProgressBar, Modal, Badge, accent } = CF.ui;

  const DAY_LABELS = P.DAY_LABELS;

  function todayWeekdayIndex() {
    // JS: 0=Sun..6=Sat -> our 0=Mon..6=Sun
    const js = new Date().getDay();
    return (js + 6) % 7;
  }

  function fmtDate(iso) {
    try {
      return new Date(iso).toLocaleDateString("hu-HU", { year: "numeric", month: "short", day: "numeric" });
    } catch {
      return iso;
    }
  }

  /* ======================================================================
   * Goal-aware planning helpers (apply manual step offsets + deload)
   * ==================================================================== */
  function effectiveGoalsForDay(state, now) {
    // Returns goals with step offset baked into a shallow copy the planner can read.
    return state.goals;
  }

  function adjustEntryForOffset(entry, offset) {
    if (!offset || entry.phase !== "main") return entry;
    // We can't re-run full planner here easily, so represent offset as a note.
    return entry;
  }

  /* ======================================================================
   * Build today's / a given day's workout, applying offsets + deload
   * ==================================================================== */
  function buildDay(state, dayIndex, dateISO, now) {
    // Clone goals and apply manual step offset by shifting start/target so the
    // planner's currentStepIndex lands on the adjusted step.
    const goals = state.goals.map((g) => {
      const offset = state.stepOffset[g.id] || 0;
      if (!offset) return g;
      const skill = SKILL_BY_ID[g.skillId];
      if (!skill) return g;
      // shift "now" effect by moving target date; simpler: attach _offset
      return { ...g, _offset: offset };
    });

    // Monkey-patch currentStepIndex via a wrapper: generate then adjust.
    const workout = P.workoutForDay(dayIndex, goals, now);

    // Apply offsets to main entries by replacing the prescribed step.
    const adjusted = {
      ...workout,
      entries: workout.entries.map((e) => {
        if (e.phase !== "main" || !e.goalId) return e;
        const goal = goals.find((g) => g.id === e.goalId);
        const offset = goal && goal._offset;
        if (!offset) return e;
        const skill = SKILL_BY_ID[goal.skillId];
        const baseIdx = P.currentStepIndex(goal, now);
        const idx = Math.min(skill.progressions.length - 1, Math.max(0, baseIdx + offset));
        const step = skill.progressions[idx];
        return {
          ...e,
          name: `${skill.label}: ${step.name}`,
          type: step.type,
          sets: step.sets,
          value: step.value,
          prescription: step.type === "hold" ? `${step.sets} × ${step.value}s` : `${step.sets} × ${step.value} ism.`,
          note: (offset < 0 ? "↓ Könnyített (AI) · " : "↑ Nehezített (AI) · ") + (step.note || `szint ${idx + 1}/${skill.progressions.length}`),
        };
      }),
    };

    // Deload: reduce sets by ~40% (min 2) on main/accessory entries.
    if (state.deload[dateISO]) {
      adjusted.deload = true;
      adjusted.entries = adjusted.entries.map((e) => {
        if (e.phase === "main" || e.phase === "accessory") {
          const sets = Math.max(2, Math.round(e.sets * 0.6));
          return {
            ...e,
            sets,
            prescription: e.type === "hold" ? `${sets} × ${e.value}s` : `${sets} × ${e.value} ism.`,
            note: "🪶 Deload · " + (e.note || ""),
          };
        }
        return e;
      });
    }

    return adjusted;
  }

  /* ======================================================================
   * Add-goal form
   * ==================================================================== */
  function AddGoalForm({ onAdd, onClose }) {
    const [skillId, setSkillId] = useState(SKILLS[0].id);
    const defaultTarget = useMemo(() => {
      const d = new Date();
      d.setDate(d.getDate() + 7 * (SKILLS[0].baselineWeeks || 16));
      return d.toISOString().slice(0, 10);
    }, []);
    const [targetDate, setTargetDate] = useState(defaultTarget);

    const skill = SKILL_BY_ID[skillId];
    const minDate = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

    // Suggest a realistic date when skill changes.
    function onSkillChange(id) {
      setSkillId(id);
      const s = SKILL_BY_ID[id];
      const d = new Date();
      d.setDate(d.getDate() + 7 * (s.baselineWeeks || 16));
      setTargetDate(d.toISOString().slice(0, 10));
    }

    const weeks = P.weeksBetween(new Date(), new Date(targetDate));
    const tight = weeks < (skill.baselineWeeks || 16) * 0.6;

    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onAdd(skillId, targetDate);
          onClose();
        }}
        className="space-y-5"
      >
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Erőelem</label>
          <select
            value={skillId}
            onChange={(e) => onSkillChange(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-base-700 px-3.5 py-3 text-sm text-slate-100 focus:border-neon-violet/60 focus:outline-none"
          >
            {SKILLS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.emoji} {s.label} — {s.category}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">{skill.description}</p>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Céldátum</label>
          <input
            type="date"
            value={targetDate}
            min={minDate}
            onChange={(e) => setTargetDate(e.target.value)}
            required
            className="w-full rounded-xl border border-white/10 bg-base-700 px-3.5 py-3 text-sm text-slate-100 focus:border-neon-violet/60 focus:outline-none"
          />
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-slate-400">
              Keret: <span className="font-semibold text-slate-200">{weeks} hét</span>
            </span>
            <span className="text-slate-500">Ajánlott: ~{skill.baselineWeeks} hét</span>
          </div>
          {tight && (
            <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
              ⚠️ Ez ambiciózus határidő ehhez az elemhez — a terv agresszív lesz. Fontold meg a kitolását a biztonságos fejlődésért.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Mégse</Button>
          <Button type="submit"><Icon.Plus className="h-4 w-4" /> Cél hozzáadása</Button>
        </div>
      </form>
    );
  }

  /* ======================================================================
   * Goal card
   * ==================================================================== */
  function GoalCard({ goal, now, onRemove, onSetProgress, stepOffset }) {
    const skill = SKILL_BY_ID[goal.skillId];
    if (!skill) return null;
    const ac = accent(skill.accent);
    const rem = P.formatRemaining(goal.targetDate, now);
    const progress = P.goalProgress(goal, now);
    const baseIdx = P.currentStepIndex(goal, now);
    const idx = Math.min(skill.progressions.length - 1, Math.max(0, baseIdx + (stepOffset || 0)));
    const step = skill.progressions[idx];

    return (
      <div className={`glass glass-hover group relative overflow-hidden rounded-2xl p-5 ${rem.overdue ? "opacity-80" : ""}`}>
        <div className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full ${ac.bg} opacity-10 blur-2xl`} />
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`grid h-11 w-11 place-items-center rounded-xl bg-base-600 text-2xl ring-1 ${ac.ring}`}>{skill.emoji}</div>
            <div>
              <div className="font-display text-base font-bold leading-tight">{skill.label}</div>
              <Badge accent={skill.accent}>{skill.category}</Badge>
            </div>
          </div>
          <button
            onClick={() => onRemove(goal.id)}
            className="rounded-lg p-1.5 text-slate-500 opacity-0 transition group-hover:opacity-100 hover:bg-rose-500/15 hover:text-rose-300"
            title="Cél törlése"
          >
            <Icon.Trash className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5 text-slate-300">
            <Icon.Clock className={`h-4 w-4 ${rem.overdue ? "text-rose-400" : ac.text}`} />
            <span className={rem.overdue ? "text-rose-400 font-semibold" : "font-semibold"}>{rem.label}</span>
          </div>
          <span className="text-slate-500">·</span>
          <span className="text-slate-400">{fmtDate(goal.targetDate)}</span>
        </div>

        <div className="mt-4">
          <ProgressBar value={progress} accent={skill.accent} />
        </div>

        <div className="mt-4 rounded-xl border border-white/5 bg-base-700/50 p-3">
          <div className="text-[11px] uppercase tracking-wide text-slate-500">Aktuális rávezető</div>
          <div className="mt-0.5 text-sm font-semibold text-slate-100">{step.name}</div>
          <div className={`text-xs ${ac.text}`}>{step.type === "hold" ? `${step.sets} × ${step.value}s` : `${step.sets} × ${step.value} ism.`} · szint {idx + 1}/{skill.progressions.length}{stepOffset ? (stepOffset < 0 ? " (AI könnyítve)" : " (AI nehezítve)") : ""}</div>
        </div>

        <div className="mt-4">
          <label className="mb-1 flex justify-between text-[11px] text-slate-400">
            <span>Logolt haladás</span>
            <span className={`font-semibold ${ac.text}`}>{Math.round((goal.loggedProgress || 0) * 100)}%</span>
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={Math.round((goal.loggedProgress || 0) * 100)}
            onChange={(e) => onSetProgress(goal.id, Number(e.target.value) / 100)}
          />
        </div>
      </div>
    );
  }

  /* ======================================================================
   * Dashboard page
   * ==================================================================== */
  function Dashboard({ state, actions, now }) {
    const [open, setOpen] = useState(false);
    const goals = state.goals;

    const stats = useMemo(() => {
      const total = goals.length;
      const avg = total ? goals.reduce((s, g) => s + P.goalProgress(g, now), 0) / total : 0;
      const soonest = goals
        .map((g) => P.formatRemaining(g.targetDate, now))
        .filter((r) => !r.overdue)
        .sort((a, b) => a.days - b.days)[0];
      return { total, avg, soonest };
    }, [goals, now]);

    return (
      <div className="animate-fade-in space-y-6">
        <PageHeader
          title="Dashboard"
          subtitle="Aktív céljaid áttekintése és kezelése"
          action={<Button onClick={() => setOpen(true)}><Icon.Plus className="h-4 w-4" /> Új cél</Button>}
        />

        {/* summary stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Aktív célok" value={stats.total} accent="violet" icon={<Icon.Bolt className="h-5 w-5" />} />
          <StatCard label="Átlagos haladás" value={`${Math.round(stats.avg * 100)}%`} accent="blue" icon={<Icon.Sparkle className="h-5 w-5" />} />
          <StatCard label="Legközelebbi határidő" value={stats.soonest ? stats.soonest.label : "—"} accent="green" icon={<Icon.Clock className="h-5 w-5" />} />
        </div>

        {goals.length === 0 ? (
          <EmptyState
            title="Még nincs célod"
            desc="Adj hozzá egy calisthenics erőelemet és egy céldátumot — a rendszer azonnal napi edzéstervet készít hozzá."
            action={<Button onClick={() => setOpen(true)}><Icon.Plus className="h-4 w-4" /> Első cél hozzáadása</Button>}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {goals.map((g) => (
              <GoalCard
                key={g.id}
                goal={g}
                now={now}
                stepOffset={state.stepOffset[g.id] || 0}
                onRemove={actions.removeGoal}
                onSetProgress={actions.setLoggedProgress}
              />
            ))}
          </div>
        )}

        <Modal open={open} onClose={() => setOpen(false)} title="Új cél hozzáadása">
          <AddGoalForm onAdd={actions.addGoal} onClose={() => setOpen(false)} />
        </Modal>
      </div>
    );
  }

  function StatCard({ label, value, accent: a, icon }) {
    const ac = accent(a);
    return (
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide text-slate-400">{label}</span>
          <span className={`grid h-9 w-9 place-items-center rounded-lg bg-base-600 ${ac.text}`}>{icon}</span>
        </div>
        <div className="mt-3 font-display text-2xl font-bold">{value}</div>
      </div>
    );
  }

  /* ======================================================================
   * Schedule page (weekly overview + daily view)
   * ==================================================================== */
  function Schedule({ state, actions, now }) {
    const [dayIndex, setDayIndex] = useState(todayWeekdayIndex());

    const activeCats = useMemo(
      () => Array.from(new Set(state.goals.map((g) => SKILL_BY_ID[g.skillId]?.category).filter(Boolean))),
      [state.goals]
    );
    const week = useMemo(() => P.buildWeekTemplate(activeCats), [activeCats]);

    // date for the selected weekday within the current week (Mon-based)
    const dateISO = useMemo(() => {
      const base = new Date(now);
      const diff = dayIndex - todayWeekdayIndex();
      base.setDate(base.getDate() + diff);
      base.setHours(0, 0, 0, 0);
      return base.toISOString().slice(0, 10);
    }, [dayIndex, now]);

    const workout = useMemo(() => buildDay(state, dayIndex, dateISO, now), [state, dayIndex, dateISO, now]);

    if (state.goals.length === 0) {
      return (
        <div className="animate-fade-in">
          <PageHeader title="Edzésterv" subtitle="Heti bontás és napi nézet" />
          <EmptyState
            title="Nincs mit tervezni"
            desc="Adj hozzá legalább egy célt a Dashboardon, és itt automatikusan megjelenik a heti edzésterved."
          />
        </div>
      );
    }

    const completedCount = workout.entries.filter((e) => state.completed[`${dateISO}:${e.id}`]).length;
    const totalCount = workout.entries.length;
    const dayDone = totalCount > 0 && completedCount === totalCount;

    return (
      <div className="animate-fade-in space-y-6">
        <PageHeader title="Edzésterv" subtitle="Push · Pull · Láb kiegyensúlyozott heti bontásban" />

        {/* weekly strip */}
        <div className="grid grid-cols-7 gap-2">
          {week.map((themes, i) => {
            const isRest = themes.length === 0;
            const isSel = i === dayIndex;
            const isToday = i === todayWeekdayIndex();
            return (
              <button
                key={i}
                onClick={() => setDayIndex(i)}
                className={`relative rounded-xl border p-2.5 text-center transition ${
                  isSel ? "border-neon-violet/60 bg-neon-violet/10 shadow-glow" : "border-white/5 bg-base-700/40 hover:border-white/15"
                }`}
              >
                <div className="text-[10px] uppercase tracking-wide text-slate-500">{DAY_LABELS[i].slice(0, 3)}</div>
                <div className={`mt-1 text-base ${isRest ? "opacity-40" : ""}`}>
                  {isRest ? "💤" : themes.includes("PUSH") ? "🫸" : themes.includes("PULL") ? "🫳" : "🦵"}
                </div>
                {isToday && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-neon-green" />}
              </button>
            );
          })}
        </div>

        {/* daily view */}
        <div className="glass rounded-2xl p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-xl font-bold">{DAY_LABELS[dayIndex]}</h3>
                {dayIndex === todayWeekdayIndex() && <Badge accent="green">Ma</Badge>}
                {workout.deload && <Badge accent="blue">Deload</Badge>}
              </div>
              <p className="mt-0.5 text-sm text-slate-400">{P.dayThemeLabel(workout.themes)} · {fmtDate(dateISO)}</p>
            </div>
            <div className="flex items-center gap-3">
              {state.deload[dateISO] && (
                <Button variant="subtle" onClick={() => actions.clearDeload(dateISO)}>Deload vissza</Button>
              )}
              <div className="text-right">
                <div className="text-xs text-slate-400">Teljesítve</div>
                <div className={`font-display text-lg font-bold ${dayDone ? "text-neon-green" : ""}`}>
                  {completedCount}/{totalCount}
                </div>
              </div>
            </div>
          </div>

          {dayDone && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-neon-green/30 bg-neon-green/10 px-4 py-3 text-sm text-neon-green animate-fade-in">
              <Icon.Check className="h-4 w-4" /> Mai edzés teljesítve — szép munka! 🎉
            </div>
          )}

          <div className="mt-5 space-y-2.5">
            {workout.entries.map((e) => {
              const key = `${dateISO}:${e.id}`;
              const done = !!state.completed[key];
              return (
                <ExerciseRow key={e.id} entry={e} done={done} onToggle={() => actions.toggleEntry(dateISO, e.id)} />
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  function ExerciseRow({ entry, done, onToggle }) {
    const ac = accent(entry.accent);
    const phaseLabel = {
      warmup: "Bemelegítés",
      main: "Fő gyakorlat",
      accessory: "Kiegészítő",
      cooldown: "Levezetés",
      rest: "Pihenő",
    }[entry.phase];

    return (
      <button
        onClick={onToggle}
        className={`flex w-full items-center gap-3.5 rounded-xl border p-3.5 text-left transition ${
          done ? "border-neon-green/30 bg-neon-green/5" : "border-white/5 bg-base-700/40 hover:border-white/15 hover:bg-base-700/70"
        }`}
      >
        <span
          className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 transition ${
            done ? "border-neon-green bg-neon-green text-base-900" : "border-slate-500"
          }`}
        >
          {done && <Icon.Check className="h-3.5 w-3.5" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className={`truncate text-sm font-semibold ${done ? "text-slate-400 line-through" : "text-slate-100"}`}>
            {entry.name}
          </div>
          {entry.note && <div className="truncate text-xs text-slate-500">{entry.note}</div>}
        </div>
        <div className="shrink-0 text-right">
          <div className={`text-sm font-bold ${done ? "text-slate-500" : ac.text}`}>{entry.prescription}</div>
          <div className="text-[10px] uppercase tracking-wide text-slate-600">{phaseLabel}</div>
        </div>
      </button>
    );
  }

  /* ======================================================================
   * AI Coach — shared conversation logic + chat UI
   * ==================================================================== */
  function useCoach(state, actions, now) {
    const todayIdx = todayWeekdayIndex();
    const dateISO = CF.todayISO();
    const todayWorkout = useMemo(() => buildDay(state, todayIdx, dateISO, now), [state, dateISO, now]);

    const send = useCallback(
      async (text) => {
        const trimmed = text.trim();
        if (!trimmed) return;

        const userMsg = { id: Date.now() + "u", role: "user", text: trimmed, ts: Date.now() };
        const pendingId = Date.now() + "a";
        actions.chatPush(userMsg);
        // Typing placeholder (replaced in-place once the answer arrives).
        actions.chatPush({ id: pendingId, role: "assistant", text: "", pending: true, ts: Date.now() });

        // Pass recent history so Gemini has conversational memory.
        const history = state.chat
          .filter((m) => m.role === "user" || m.role === "assistant")
          .slice(-8)
          .map((m) => ({ role: m.role, text: m.text }));

        let res;
        try {
          res = await CF.coach.respond({
            message: trimmed,
            context: { goals: state.goals, todayWorkout, history },
            settings: state.settings,
          });
        } catch (e) {
          res = { text: "Hiba történt a válasz közben: " + (e && e.message ? e.message : e), source: "error" };
        }

        actions.chatUpdate(pendingId, {
          text: res.text,
          action: res.action || null,
          pending: false,
          source: res.source,
          error: res.error || null,
        });
      },
      [actions, state.goals, state.chat, state.settings, todayWorkout]
    );

    const applyAction = useCallback(
      (action) => {
        if (!action) return;
        switch (action.type) {
          case "DELOAD_TODAY":
            actions.deloadToday(dateISO);
            break;
          case "REGRESS_GOAL":
            if (action.goalId) actions.regressGoal(action.goalId);
            break;
          case "PROGRESS_GOAL":
            if (action.goalId) actions.progressGoal(action.goalId);
            break;
        }
        actions.chatPush({
          id: Date.now() + "s",
          role: "system",
          text: `✅ Alkalmazva: ${action.label}. Nézd meg az Edzésterv oldalon!`,
          ts: Date.now(),
        });
      },
      [actions, dateISO]
    );

    return { send, applyAction, todayWorkout };
  }

  const QUICK_PROMPTS = [
    "Mi a mai edzésem?",
    "Fáj a csuklóm planche lean közben, mit csináljak?",
    "Túl nehéz volt a mai front lever, tegyünk könnyebbet.",
    "Mi a helyes forma a muscle-upnál?",
  ];

  function ChatMessages({ chat, onApply, compact }) {
    const endRef = useRef(null);
    useEffect(() => {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chat.length]);

    if (!chat.length) {
      return (
        <div className="flex h-full flex-col items-center justify-center px-6 text-center text-slate-400">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-neon-violet to-neon-blue shadow-glow">
            <Icon.Sparkle className="h-7 w-7 text-white" />
          </div>
          <p className="mt-4 font-display text-base font-semibold text-slate-200">AI Coach</p>
          <p className="mt-1 text-sm">Ismerem a céljaidat és a mai edzésedet. Kérdezz bármit!</p>
        </div>
      );
    }

    return (
      <div className="chat-scroll flex-1 space-y-3 overflow-y-auto px-1">
        {chat.map((m) => (
          <ChatBubble key={m.id} msg={m} onApply={onApply} compact={compact} />
        ))}
        <div ref={endRef} />
      </div>
    );
  }

  function ChatBubble({ msg, onApply }) {
    if (msg.role === "system") {
      return (
        <div className="mx-auto w-fit rounded-full border border-neon-green/30 bg-neon-green/10 px-3 py-1 text-xs text-neon-green animate-fade-in">
          {msg.text}
        </div>
      );
    }
    const isUser = msg.role === "user";
    return (
      <div className={`flex animate-fade-in ${isUser ? "justify-end" : "justify-start"}`}>
        <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "bg-gradient-to-r from-neon-violet to-neon-blue text-white"
            : "border border-white/10 bg-base-700/80 text-slate-100"
        }`}>
          {msg.pending ? (
            <TypingDots />
          ) : (
            <div className="whitespace-pre-wrap">{msg.text}</div>
          )}
          {msg.action && (
            <button
              onClick={() => onApply(msg.action)}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-neon-green/40 bg-neon-green/10 px-3 py-1.5 text-xs font-semibold text-neon-green hover:bg-neon-green/20"
            >
              <Icon.Check className="h-3.5 w-3.5" /> {msg.action.label}
            </button>
          )}
          {!isUser && !msg.pending && msg.source === "fallback" && (
            <div className="mt-2 border-t border-white/10 pt-2 text-[11px] text-amber-300/90">
              ⚠️ A Gemini nem válaszolt ({msg.error}), ezért a beépített motor felelt.
            </div>
          )}
          {!isUser && !msg.pending && msg.source === "gemini" && (
            <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-500">
              <Icon.Sparkle className="h-3 w-3 text-neon-violet" /> Gemini
            </div>
          )}
        </div>
      </div>
    );
  }

  function TypingDots() {
    return (
      <div className="flex items-center gap-1 py-1">
        {[0, 150, 300].map((d) => (
          <span
            key={d}
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400"
            style={{ animationDelay: `${d}ms` }}
          />
        ))}
      </div>
    );
  }

  function ChatInput({ onSend, placeholder }) {
    const [text, setText] = useState("");
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSend(text);
          setText("");
        }}
        className="flex items-center gap-2"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder || "Írj az AI edződnek…"}
          className="flex-1 rounded-xl border border-white/10 bg-base-700 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:border-neon-violet/60 focus:outline-none"
        />
        <Button type="submit" disabled={!text.trim()} className="px-3.5"><Icon.Send className="h-4 w-4" /></Button>
      </form>
    );
  }

  /* ---- AI settings (Gemini bring-your-own-key) -------------------------- */
  function AISettingsModal({ open, onClose, settings, onSave }) {
    const [apiKey, setApiKey] = useState(settings.apiKey || "");
    const [model, setModel] = useState(settings.model || "gemini-2.5-pro");
    const [useGemini, setUseGemini] = useState(!!settings.useGemini);
    const [reveal, setReveal] = useState(false);
    const [testState, setTestState] = useState({ status: "idle", msg: "" });

    useEffect(() => {
      if (open) {
        setApiKey(settings.apiKey || "");
        setModel(settings.model || "gemini-2.5-pro");
        setUseGemini(!!settings.useGemini);
        setTestState({ status: "idle", msg: "" });
      }
    }, [open, settings]);

    async function runTest() {
      if (!apiKey.trim()) {
        setTestState({ status: "error", msg: "Előbb add meg az API kulcsot." });
        return;
      }
      setTestState({ status: "loading", msg: "Kapcsolat tesztelése…" });
      try {
        await CF.gemini.testKey({ apiKey: apiKey.trim(), model });
        setTestState({ status: "ok", msg: "Sikeres kapcsolat! A kulcs működik. ✅" });
      } catch (e) {
        setTestState({ status: "error", msg: (e && e.message) || "Ismeretlen hiba." });
      }
    }

    function save() {
      onSave({ apiKey: apiKey.trim(), model, useGemini: useGemini && !!apiKey.trim() });
      onClose();
    }

    function clearKey() {
      setApiKey("");
      setUseGemini(false);
      onSave({ apiKey: "", model, useGemini: false });
      setTestState({ status: "idle", msg: "Kulcs törölve ebből a böngészőből." });
    }

    return (
      <Modal open={open} onClose={onClose} title="AI beállítások — Gemini">
        <div className="space-y-5">
          <div className="rounded-xl border border-neon-blue/20 bg-neon-blue/5 p-3 text-xs leading-relaxed text-slate-300">
            🔒 A kulcsod <b>csak ebben a böngészőben</b> (localStorage) tárolódik — nem kerül a szerverre, a repóba, és nem látja senki más. A hívás közvetlenül a Google Gemini API-hoz megy.
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Gemini API kulcs
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type={reveal ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIza…"
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full rounded-xl border border-white/10 bg-base-700 px-3.5 py-3 pr-10 text-sm text-slate-100 placeholder-slate-500 focus:border-neon-violet/60 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setReveal((r) => !r)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 hover:text-slate-200"
                  title={reveal ? "Elrejtés" : "Megjelenítés"}
                >
                  {reveal ? <Icon.EyeOff className="h-4 w-4" /> : <Icon.Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <p className="mt-1.5 text-xs text-slate-500">
              Kulcs igénylése:{" "}
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-neon-blue hover:underline">
                aistudio.google.com/apikey
              </a>
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Modell</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-base-700 px-3.5 py-3 text-sm text-slate-100 focus:border-neon-violet/60 focus:outline-none"
            >
              {CF.gemini.MODELS.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-base-700/50 p-3.5 cursor-pointer">
            <input
              type="checkbox"
              checked={useGemini}
              onChange={(e) => setUseGemini(e.target.checked)}
              className="h-4 w-4 accent-neon-violet"
            />
            <span className="text-sm">
              <span className="font-semibold">Gemini használata</span>
              <span className="block text-xs text-slate-400">Ha ki van kapcsolva, a beépített (offline) edző motor válaszol.</span>
            </span>
          </label>

          {testState.msg && (
            <div className={`rounded-lg px-3 py-2 text-xs ${
              testState.status === "ok" ? "border border-neon-green/30 bg-neon-green/10 text-neon-green"
              : testState.status === "error" ? "border border-rose-500/30 bg-rose-500/10 text-rose-300"
              : "border border-white/10 bg-base-700/60 text-slate-300"
            }`}>
              {testState.msg}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={runTest} disabled={testState.status === "loading"}>
                {testState.status === "loading" ? "Tesztelés…" : "Kapcsolat teszt"}
              </Button>
              {settings.apiKey && (
                <Button type="button" variant="danger" onClick={clearKey}>Kulcs törlése</Button>
              )}
            </div>
            <Button type="button" onClick={save}>Mentés</Button>
          </div>
        </div>
      </Modal>
    );
  }

  function CoachStatusPill({ settings, onOpen }) {
    const active = settings.useGemini && settings.apiKey;
    return (
      <button
        onClick={onOpen}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${
          active ? "border-neon-violet/40 bg-neon-violet/10 text-neon-violet" : "border-white/10 bg-base-700/60 text-slate-400"
        }`}
        title="AI beállítások"
      >
        <Icon.Sparkle className="h-3.5 w-3.5" />
        {active ? `Gemini (${settings.model.replace("gemini-", "")})` : "Beépített motor"}
        <Icon.Cog className="h-3.5 w-3.5 opacity-70" />
      </button>
    );
  }

  function CoachPage({ state, actions, now }) {
    const { send, applyAction } = useCoach(state, actions, now);
    const [settingsOpen, setSettingsOpen] = useState(false);
    return (
      <div className="animate-fade-in">
        <PageHeader
          title="AI Coach"
          subtitle="Személyre szabott tanácsadás a céljaid és mai edzésed ismeretében"
          action={
            <div className="flex items-center gap-2">
              <CoachStatusPill settings={state.settings} onOpen={() => setSettingsOpen(true)} />
              {state.chat.length > 0 && <Button variant="ghost" onClick={actions.chatClear}>Előzmény törlése</Button>}
            </div>
          }
        />
        <div className="glass flex h-[62vh] flex-col rounded-2xl p-4 sm:p-5">
          <ChatMessages chat={state.chat} onApply={applyAction} />
          {!state.chat.length && (
            <div className="my-4 flex flex-wrap gap-2">
              {QUICK_PROMPTS.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="rounded-full border border-white/10 bg-base-700/60 px-3 py-1.5 text-xs text-slate-300 hover:border-neon-violet/50 hover:text-white"
                >
                  {q}
                </button>
              ))}
            </div>
          )}
          <div className="mt-3">
            <ChatInput onSend={send} />
          </div>
        </div>

        <AISettingsModal
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          settings={state.settings}
          onSave={actions.setSettings}
        />
      </div>
    );
  }

  /* ---- Floating chat widget --------------------------------------------- */
  function ChatWidget({ state, actions, now }) {
    const [open, setOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const { send, applyAction } = useCoach(state, actions, now);
    const geminiActive = state.settings.useGemini && state.settings.apiKey;

    return (
      <>
        {/* launcher */}
        <button
          onClick={() => setOpen((o) => !o)}
          className="fixed bottom-20 right-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-neon-violet to-neon-blue shadow-glow md:bottom-6"
          aria-label="AI Coach"
        >
          {!open && <span className="absolute inset-0 animate-pulse-ring rounded-full bg-neon-violet/40" />}
          {open ? <Icon.Close className="h-6 w-6 text-white" /> : <Icon.Sparkle className="h-6 w-6 text-white" />}
        </button>

        {open && (
          <div className="fixed bottom-36 right-5 z-40 flex h-[70vh] max-h-[560px] w-[calc(100vw-2.5rem)] max-w-sm flex-col rounded-2xl md:bottom-24 glass animate-slide-up shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-neon-violet to-neon-blue">
                  <Icon.Sparkle className="h-4 w-4 text-white" />
                </span>
                <div>
                  <div className="text-sm font-bold">AI Coach</div>
                  <div className="flex items-center gap-1 text-[10px] text-neon-green">
                    <span className="h-1.5 w-1.5 rounded-full bg-neon-green" />
                    {geminiActive ? `Gemini (${state.settings.model.replace("gemini-", "")})` : "Beépített motor"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setSettingsOpen(true)} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white" title="AI beállítások">
                  <Icon.Cog className="h-5 w-5" />
                </button>
                <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white">
                  <Icon.Close className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="flex flex-1 flex-col overflow-hidden p-3">
              <ChatMessages chat={state.chat} onApply={applyAction} compact />
              {!state.chat.length && (
                <div className="my-3 flex flex-wrap gap-1.5">
                  {QUICK_PROMPTS.slice(0, 3).map((q) => (
                    <button key={q} onClick={() => send(q)} className="rounded-full border border-white/10 bg-base-700/60 px-2.5 py-1 text-[11px] text-slate-300 hover:border-neon-violet/50 hover:text-white">
                      {q}
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-2">
                <ChatInput onSend={send} />
              </div>
            </div>
          </div>
        )}

        <AISettingsModal
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          settings={state.settings}
          onSave={actions.setSettings}
        />
      </>
    );
  }

  /* ======================================================================
   * Shared layout pieces
   * ==================================================================== */
  function PageHeader({ title, subtitle, action }) {
    return (
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
        </div>
        {action}
      </div>
    );
  }

  function EmptyState({ title, desc, action }) {
    return (
      <div className="glass mt-6 flex flex-col items-center rounded-2xl p-10 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-base-600 text-3xl">🏋️</div>
        <h3 className="mt-4 font-display text-lg font-bold">{title}</h3>
        <p className="mt-1 max-w-md text-sm text-slate-400">{desc}</p>
        {action && <div className="mt-5">{action}</div>}
      </div>
    );
  }

  const NAV = [
    { id: "dashboard", label: "Dashboard", icon: Icon.Dashboard },
    { id: "schedule", label: "Edzésterv", icon: Icon.Calendar },
    { id: "coach", label: "AI Coach", icon: Icon.Chat },
  ];

  function Sidebar({ page, setPage }) {
    return (
      <aside className="hidden w-60 shrink-0 flex-col border-r border-white/5 bg-base-800/40 p-5 md:flex">
        <Logo />
        <nav className="mt-8 space-y-1">
          {NAV.map((n) => {
            const Ico = n.icon;
            const active = page === n.id;
            return (
              <button
                key={n.id}
                onClick={() => setPage(n.id)}
                className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
                  active ? "bg-neon-violet/15 text-white shadow-glow" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                }`}
              >
                <Ico className={`h-5 w-5 ${active ? "text-neon-violet" : ""}`} />
                {n.label}
              </button>
            );
          })}
        </nav>
        <div className="mt-auto rounded-xl border border-white/5 bg-base-700/40 p-3 text-xs text-slate-500">
          <div className="font-semibold text-slate-300">💡 Tipp</div>
          <p className="mt-1 leading-relaxed">A statikus elemek lassan fejlődnek — a következetesség veri a intenzitást.</p>
        </div>
      </aside>
    );
  }

  function BottomNav({ page, setPage }) {
    return (
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-white/10 bg-base-800/90 backdrop-blur md:hidden">
        {NAV.map((n) => {
          const Ico = n.icon;
          const active = page === n.id;
          return (
            <button key={n.id} onClick={() => setPage(n.id)} className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] ${active ? "text-neon-violet" : "text-slate-500"}`}>
              <Ico className="h-5 w-5" />
              {n.label}
            </button>
          );
        })}
      </nav>
    );
  }

  /* ======================================================================
   * Root App
   * ==================================================================== */
  function App() {
    const { state, actions } = CF.useStore();
    const [page, setPage] = useState("dashboard");
    // "now" ticks are not needed frequently; compute once per mount/render.
    const now = useMemo(() => new Date(), []);

    return (
      <div className="flex h-screen overflow-hidden">
        <Sidebar page={page} setPage={setPage} />

        <div className="flex min-w-0 flex-1 flex-col">
          {/* mobile top bar */}
          <header className="flex items-center justify-between border-b border-white/5 bg-base-800/40 px-4 py-3 md:hidden">
            <Logo />
          </header>

          <main className="flex-1 overflow-y-auto px-4 py-6 pb-24 sm:px-6 md:px-8 md:pb-8">
            <div className="mx-auto max-w-6xl">
              {page === "dashboard" && <Dashboard state={state} actions={actions} now={now} />}
              {page === "schedule" && <Schedule state={state} actions={actions} now={now} />}
              {page === "coach" && <CoachPage state={state} actions={actions} now={now} />}
            </div>
          </main>
        </div>

        <BottomNav page={page} setPage={setPage} />
        {page !== "coach" && <ChatWidget state={state} actions={actions} now={now} />}
      </div>
    );
  }

  const root = ReactDOM.createRoot(document.getElementById("root"));
  root.render(<App />);
})();
