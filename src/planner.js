/* ===========================================================================
 * CaliForge — Scheduling & progression engine
 * ---------------------------------------------------------------------------
 * Pure functions (no React) that turn a list of goals into:
 *   1. a weekly split (Push / Pull / Legs+Core / Rest), balancing categories so
 *      that heavy PUSH (Planche) and heavy PULL (Front Lever) land on different
 *      days while still getting enough volume;
 *   2. a per-day workout (warm-up + skill progression blocks + accessories);
 *   3. progression math — which lead-up step a goal should be on given how far
 *      along its timeline the athlete is.
 * ========================================================================= */

window.CF = window.CF || {};

(function () {
  const { CATEGORY, SKILL_BY_ID, WARMUP } = window.CF;

  const DAY_LABELS = ["Hétfő", "Kedd", "Szerda", "Csütörtök", "Péntek", "Szombat", "Vasárnap"];

  /* ---- date helpers ------------------------------------------------------ */
  const MS_PER_DAY = 86400000;

  function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  function daysBetween(from, to) {
    return Math.round((startOfDay(to) - startOfDay(from)) / MS_PER_DAY);
  }

  function weeksBetween(from, to) {
    return Math.max(0, Math.ceil(daysBetween(from, to) / 7));
  }

  function formatRemaining(targetDate, now = new Date()) {
    const days = daysBetween(now, targetDate);
    if (days < 0) return { days, weeks: 0, label: "Lejárt", overdue: true };
    const weeks = Math.floor(days / 7);
    const rem = days % 7;
    let label;
    if (days === 0) label = "Ma a határidő";
    else if (weeks === 0) label = `${days} nap`;
    else if (rem === 0) label = `${weeks} hét`;
    else label = `${weeks} hét ${rem} nap`;
    return { days, weeks, label, overdue: false };
  }

  /* ---- progression math -------------------------------------------------- */
  /**
   * Given a goal, figure out which progression step the athlete should train.
   * We map elapsed time (startDate -> targetDate) linearly across the steps,
   * clamped so you always have at least the first step and never skip the last.
   */
  function currentStepIndex(goal, now = new Date()) {
    const skill = SKILL_BY_ID[goal.skillId];
    if (!skill) return 0;
    const steps = skill.progressions.length;
    const total = Math.max(1, daysBetween(goal.startDate, goal.targetDate));
    const elapsed = Math.max(0, daysBetween(goal.startDate, now));
    const frac = Math.min(0.999, elapsed / total);
    return Math.min(steps - 1, Math.floor(frac * steps));
  }

  /**
   * Overall progress 0..1 for a goal — blends elapsed-time fraction with the
   * manual completion the athlete has logged (if any), favouring logged work.
   */
  function goalProgress(goal, now = new Date()) {
    const total = Math.max(1, daysBetween(goal.startDate, goal.targetDate));
    const elapsed = daysBetween(goal.startDate, now);
    const timeFrac = Math.min(1, Math.max(0, elapsed / total));
    const logged = typeof goal.loggedProgress === "number" ? goal.loggedProgress : null;
    if (logged === null) return timeFrac;
    // weight logged work 70%, timeline 30%
    return Math.min(1, logged * 0.7 + timeFrac * 0.3);
  }

  /* ---- weekly split ------------------------------------------------------ */
  /**
   * Build a 7-day template of category "themes". We always separate the two
   * most demanding categories (PUSH vs PULL) and insert rest/active days.
   * Returns array of 7 arrays of category keys, e.g. ["PUSH"], ["PULL"], [].
   */
  function buildWeekTemplate(activeCategories) {
    const has = (c) => activeCategories.includes(c);
    // Canonical PPL-ish week. Empty array = rest / mobility day.
    const template = [
      [CATEGORY.PUSH], // Mon
      [CATEGORY.PULL], // Tue
      [CATEGORY.LEGS, CATEGORY.CORE], // Wed
      [], // Thu rest
      [CATEGORY.PUSH], // Fri
      [CATEGORY.PULL], // Sat
      [], // Sun rest
    ];
    // Drop categories nobody is training to keep days focused.
    return template.map((day) => day.filter((c) => has(c) || (c === CATEGORY.CORE && has(CATEGORY.CORE))));
  }

  /* ---- per-day workout --------------------------------------------------- */
  function prescriptionText(step) {
    if (step.type === "hold") return `${step.sets} × ${step.value}s`;
    return `${step.sets} × ${step.value} ism.`;
  }

  /**
   * For a given weekday index (0=Mon) and the athlete's goals, produce the
   * workout: an ordered list of exercise entries with a stable id so the UI can
   * track completion.
   */
  function workoutForDay(dayIndex, goals, now = new Date()) {
    const activeCategories = Array.from(new Set(goals.map((g) => SKILL_BY_ID[g.skillId]?.category).filter(Boolean)));
    const week = buildWeekTemplate(activeCategories);
    const themes = week[dayIndex] || [];

    const isRest = themes.length === 0;
    const entries = [];

    if (isRest) {
      entries.push(
        mkEntry(dayIndex, "rest-mobility", "Aktív pihenő — mobilitás & nyújtás", "hold", 1, 300, "Könnyű keringésfokozás, csukló- és vállegészség."),
        mkEntry(dayIndex, "rest-core", "Könnyű core (hollow + plank)", "hold", 3, 30)
      );
      return { dayIndex, label: DAY_LABELS[dayIndex], isRest, themes, entries };
    }

    // Warm-up
    WARMUP.forEach((w, i) =>
      entries.push(mkEntry(dayIndex, `warmup-${i}`, w.name, w.type, w.sets, w.value, "Bemelegítés", "warmup"))
    );

    // Main skill blocks for goals whose category matches today's themes.
    goals.forEach((goal) => {
      const skill = SKILL_BY_ID[goal.skillId];
      if (!skill || !themes.includes(skill.category)) return;
      const idx = currentStepIndex(goal, now);
      const step = skill.progressions[idx];
      entries.push(
        mkEntry(
          dayIndex,
          `${goal.id}-main`,
          `${skill.label}: ${step.name}`,
          step.type,
          step.sets,
          step.value,
          step.note || `Cél-progresszió ${idx + 1}/${skill.progressions.length}`,
          "main",
          goal.id,
          skill.accent
        )
      );
      // One accessory per goal, rotated by weekday for variety.
      if (skill.accessories && skill.accessories.length) {
        const acc = skill.accessories[dayIndex % skill.accessories.length];
        entries.push(
          mkEntry(dayIndex, `${goal.id}-acc`, `${skill.label} segédgyakorlat: ${acc.name}`, acc.type, acc.sets, acc.value, "Kiegészítő volumen", "accessory", goal.id, skill.accent)
        );
      }
    });

    // Cooldown.
    entries.push(mkEntry(dayIndex, "cooldown", "Levezető nyújtás", "hold", 1, 180, "Mellkas, váll, csukló.", "cooldown"));

    return { dayIndex, label: DAY_LABELS[dayIndex], isRest, themes, entries };
  }

  function mkEntry(dayIndex, key, name, type, sets, value, note, phase = "main", goalId = null, accent = "violet") {
    return {
      id: `d${dayIndex}-${key}`,
      name,
      type,
      sets,
      value,
      prescription: type === "hold" ? `${sets} × ${value}s` : `${sets} × ${value} ism.`,
      note,
      phase,
      goalId,
      accent,
    };
  }

  /** Human-readable theme label for a day. */
  function dayThemeLabel(themes) {
    if (!themes || themes.length === 0) return "Pihenő / mobilitás";
    const map = { PUSH: "Push", PULL: "Pull", LEGS: "Láb", CORE: "Core" };
    return themes.map((t) => map[t] || t).join(" + ") + " nap";
  }

  window.CF.planner = {
    DAY_LABELS,
    daysBetween,
    weeksBetween,
    formatRemaining,
    currentStepIndex,
    goalProgress,
    buildWeekTemplate,
    workoutForDay,
    prescriptionText,
    dayThemeLabel,
  };
})();
