/* ===========================================================================
 * CaliForge — AI Coach engine
 * ---------------------------------------------------------------------------
 * A context-aware, intent-driven assistant. In this sandbox there is no
 * outbound network access to an LLM, so the coach is implemented as a
 * deterministic reasoning engine that:
 *   - understands the athlete's current goals and today's workout (context);
 *   - classifies the user's message intent (injury, difficulty, form,
 *     nutrition, motivation, plan question, greeting);
 *   - optionally proposes an on-the-fly plan modification the UI can apply.
 *
 * The public API intentionally mirrors a chat-completion call so that swapping
 * in a real LLM later is a drop-in change:
 *     CF.coach.respond({ message, context })  ->  { text, action? }
 * ========================================================================= */

window.CF = window.CF || {};

(function () {
  const { SKILL_BY_ID } = window.CF;

  const KEYWORDS = {
    injury: ["fáj", "sérül", "fájdal", "húzó", "ízület", "csukló", "váll", "könyök", "ropog", "pattog"],
    harder: ["nehéz", "túl nehéz", "nem megy", "nem bírtam", "kemény", "fáradt", "kimerült", "könnyebb"],
    easier: ["könnyű", "túl könnyű", "unalmas", "nehezebbet", "többet", "fejlesztés"],
    form: ["forma", "technik", "hogyan", "hogy csináljam", "helyes", "pozíció", "testtartás"],
    nutrition: ["táplál", "evés", "diéta", "fehérje", "kaja", "regener"],
    rest: ["pihen", "deload", "alvás", "overtraining", "túledzés"],
    plan: ["terv", "mai", "ma mit", "edzés", "program", "napi", "schedule"],
    motivation: ["motivá", "feladom", "elkeseredtem", "nem haladok", "lassan"],
    greeting: ["szia", "hello", "helló", "hali", "üdv", "jó napot"],
  };

  function detectIntent(msg) {
    const text = msg.toLowerCase();
    const score = {};
    for (const [intent, words] of Object.entries(KEYWORDS)) {
      score[intent] = words.reduce((n, w) => (text.includes(w) ? n + 1 : n), 0);
    }
    // Priority order for ties: safety first.
    const order = ["injury", "harder", "easier", "rest", "form", "nutrition", "plan", "motivation", "greeting"];
    let best = null;
    let bestScore = 0;
    for (const intent of order) {
      if (score[intent] > bestScore) {
        best = intent;
        bestScore = score[intent];
      }
    }
    return best || "unknown";
  }

  /** Identify which goal the message likely refers to (by skill name mention). */
  function detectGoal(msg, goals) {
    const text = msg.toLowerCase();
    for (const g of goals) {
      const skill = SKILL_BY_ID[g.skillId];
      if (!skill) continue;
      const name = skill.label.toLowerCase();
      if (text.includes(name) || name.split(" ").some((w) => w.length > 3 && text.includes(w))) {
        return g;
      }
    }
    return goals[0] || null;
  }

  function listGoals(goals) {
    if (!goals.length) return "Jelenleg nincs aktív célod — adj hozzá egyet a Dashboardon, és azonnal tervezek hozzá!";
    return goals
      .map((g) => {
        const s = SKILL_BY_ID[g.skillId];
        const rem = window.CF.planner.formatRemaining(g.targetDate);
        return `• ${s ? s.emoji + " " + s.label : g.skillId} — hátralévő idő: ${rem.label}`;
      })
      .join("\n");
  }

  function describeToday(todayWorkout) {
    if (!todayWorkout) return "Ma nincs betöltött edzésterv.";
    if (todayWorkout.isRest) {
      return "Ma pihenőnap van — mobilitás, könnyű core és regeneráció a fókusz. 🧘";
    }
    const main = todayWorkout.entries.filter((e) => e.phase === "main");
    const lines = main.map((e) => `• ${e.name} — ${e.prescription}`);
    return `Mai fő gyakorlataid (${window.CF.planner.dayThemeLabel(todayWorkout.themes)}):\n${lines.join("\n")}`;
  }

  /* ---- intent handlers --------------------------------------------------- */

  function handleInjury(msg) {
    const text = msg.toLowerCase();
    const wrist = text.includes("csukló");
    const shoulder = text.includes("váll");
    const elbow = text.includes("könyök");

    let specific = "";
    if (wrist) {
      specific =
        "A csuklófájdalom planche/planche lean közben nagyon gyakori. Javaslatom:\n" +
        "1. Állj le a fájdalmat okozó gyakorlattal — a fájdalmon átnyomni sosem jó.\n" +
        "2. Próbáld öklön vagy fogantyún (parallettes) végezni, hogy a csukló semleges maradjon.\n" +
        "3. Napi 2× csukló-mobilizáció és erősítés (wrist extension/flexion, 2×15).\n" +
        "4. Fokozatosan terheld újra, 50%-os volumennel kezdve.";
    } else if (shoulder) {
      specific =
        "Vállfájdalomnál a protrakció és a scapula kontroll a kulcs:\n" +
        "1. Kerüld a végtartományú statikus terhelést pár napig.\n" +
        "2. Erősítsd a rotátorköpenyt (band external rotation, 3×15) és a scapula push-upot.\n" +
        "3. Ha szúró/éles a fájdalom, az pihenést és szakember véleményét kívánja.";
    } else if (elbow) {
      specific =
        "Könyökfájdalom (gyakran „golfer's/tennis elbow”) túlterhelésre utal:\n" +
        "1. Csökkentsd a húzó/toló volument 30-40%-kal 1-2 hétig.\n" +
        "2. Excentrikus alkar-megerősítés segít (pl. lassú csuklóhajlítás súllyal).\n" +
        "3. Melegíts be alaposabban az ízület körül.";
    } else {
      specific =
        "Fájdalomnál mindig a biztonság az első:\n" +
        "1. Különböztesd meg az izomfáradtságot (normál) az ízületi/éles fájdalomtól (állj le).\n" +
        "2. Csökkentsd az érintett mozgásminta volumenét, és adj 2-3 nap regenerációt.\n" +
        "3. Melegíts be célzottan az adott ízületre.";
    }

    return {
      text:
        specific +
        "\n\n⚠️ Nem vagyok orvos — ha a fájdalom éles, tartós vagy duzzanattal jár, keress fel szakembert. Addig is beállíthatom a mai edzést kímélő módra.",
      action: { type: "DELOAD_TODAY", label: "Mai edzés kímélő módra (−40% volumen)" },
    };
  }

  function handleHarder(msg, goal) {
    const skill = goal ? SKILL_BY_ID[goal.skillId] : null;
    const name = skill ? skill.label : "elem";
    return {
      text:
        `Semmi gond — a túl nehéz nap jelzés, nem kudarc. A(z) ${name} esetében visszaléphetünk egy könnyebb rávezetőre, ` +
        `és csökkenthetjük a tartásidőt/ismétlést, hogy tiszta technikával tudj dolgozni. ` +
        `Alkalmazzam ezt a mai tervre?`,
      action: goal
        ? { type: "REGRESS_GOAL", goalId: goal.id, label: `${name}: egy szinttel könnyebb rávezető` }
        : { type: "DELOAD_TODAY", label: "Mai edzés könnyítése (−30%)" },
    };
  }

  function handleEasier(msg, goal) {
    const skill = goal ? SKILL_BY_ID[goal.skillId] : null;
    const name = skill ? skill.label : "elem";
    return {
      text:
        `Ez remek jel — készen állsz a következő lépcsőre! A(z) ${name} progresszióban előreléphetünk egy nehezebb ` +
        `rávezetőre. Figyelj a tiszta formára az új szinten. Léptessem feljebb a mai tervet?`,
      action: goal
        ? { type: "PROGRESS_GOAL", goalId: goal.id, label: `${name}: egy szinttel nehezebb rávezető` }
        : null,
    };
  }

  function handleForm(msg, goal) {
    const skill = goal ? SKILL_BY_ID[goal.skillId] : null;
    if (!skill) {
      return { text: "Mondd meg, melyik elem technikájáról kérdezel (pl. Front Lever, Planche), és részletesen elmagyarázom a kulcspontokat." };
    }
    const tips = {
      "front-lever":
        "Front Lever kulcspontok:\n• Nyújtott, zárt könyök végig.\n• Húzd le és hátra a lapockát (depresszió + retrakció).\n• Feszítsd a hasat és a farizmot — a test egyetlen merev deszka.\n• A csípő ne essen le; a kéz húzza a rudat a comb felé.",
      "straddle-planche":
        "Straddle Planche kulcspontok:\n• Erős protrakció (told el magad a földtől).\n• Könyök zárva, bicepsz előre forgatva.\n• Dönts előre, amíg a váll jóval a kéz elé kerül.\n• Terpeszd a lábat a kar csökkentéséhez.",
      "full-planche":
        "Full Planche kulcspontok:\n• Maximális protrakció és előredőlés.\n• Feszes glute + quad, hogy a test egyenes maradjon.\n• Türelmes negatívokkal építsd a végtartományt.",
      "muscle-up":
        "Muscle-up kulcspontok:\n• Robbanékony, mellkasig érő húzás (false grip segít).\n• Gyors átfordulás: told a csuklót a rúd fölé.\n• Zárd a dipet felül teljes nyújtásig.",
      "handstand":
        "Handstand kulcspontok:\n• Nyomj a padlóba az ujjbegyekkel az egyensúlyért.\n• Hollow test, zárt borda, feszes glute.\n• A tekintet a kezek közé, enyhén előre.",
      "human-flag":
        "Human Flag kulcspontok:\n• Felső kar húz, alsó kar nyom.\n• Erős oldalsó core-feszítés, feszes test.\n• Kezdd tuck-ból, majd nyisd a lábat.",
      "l-sit":
        "L-sit kulcspontok:\n• Vállat nyomd le (depresszió), ne húzd a fülhöz.\n• Aktív kompresszió a csípőhajlítókkal.\n• Nyújtott térd, lefelé mutató lábujj.",
      "pistol-squat":
        "Pistol Squat kulcspontok:\n• Boka- és csípőmobilitás elengedhetetlen.\n• Tartsd a sarkat a földön, a térd kövesse a lábfejet.\n• Nyújtsd előre a kezet és a szabad lábat egyensúlyként.",
    };
    return { text: tips[skill.id] || `A(z) ${skill.label} technikájához tiszta ízületi pozíciót, aktív lapockát és feszes törzset tarts szem előtt.` };
  }

  function handleNutrition() {
    return {
      text:
        "Calisthenics erőelemekhez a regeneráció táplálkozási alapjai:\n" +
        "• Fehérje: kb. 1.6–2.0 g / testtömeg-kg naponta.\n" +
        "• Elegendő energia (ne légy tartós kalóriahiányban erőépítés közben).\n" +
        "• Alvás 7–9 óra — ez a legfontosabb „szupplement”.\n" +
        "• Hidratálás és elegendő mikrotápanyag (zöldség, gyümölcs).\n\n" +
        "Konkrét étrendi tanácshoz dietetikus tud személyre szabottan segíteni.",
    };
  }

  function handleRest() {
    return {
      text:
        "A statikus erőelemek erősen terhelik az ízületeket és az idegrendszert. Ha fáradt vagy:\n" +
        "• Iktass be egy deload hetet (volumen −40–50%).\n" +
        "• Figyeld a jeleket: alvásminőség, kedv, teljesítmény visszaesése.\n" +
        "• A pihenőnapokon maradj aktív (mobilitás, séta).\n\n" +
        "Szeretnéd, hogy a mai napot pihenő/kímélő módra állítsam?",
      action: { type: "DELOAD_TODAY", label: "Mai nap deload módra" },
    };
  }

  function handleMotivation(goals) {
    const n = goals.length;
    return {
      text:
        (n
          ? `${n} aktív célon dolgozol — ez önmagában elismerésre méltó. `
          : "") +
        "A statikus elemek a leglassabban fejlődő készségek közé tartoznak; a haladás nem lineáris, hanem ugrásszerű. " +
        "Amit most építesz (ínszalag- és idegrendszeri adaptáció), gyakran láthatatlan — aztán egyszer csak „beugrik”. " +
        "Maradj a terv mellett, logold az edzéseket, és bízz a folyamatban. 💪",
    };
  }

  function handlePlan(todayWorkout, goals) {
    return { text: `${describeToday(todayWorkout)}\n\nAktív céljaid:\n${listGoals(goals)}` };
  }

  function handleGreeting(goals, todayWorkout) {
    return {
      text:
        "Szia! 👋 Én vagyok a CaliForge AI edződ. Ismerem az aktuális céljaidat és a mai edzéstervedet.\n\n" +
        describeToday(todayWorkout) +
        "\n\nKérdezhetsz technikáról, sérülésről, vagy kérheted a terv módosítását (pl. „túl nehéz volt a mai front lever”).",
    };
  }

  function handleUnknown(goals, todayWorkout) {
    return {
      text:
        "Nem vagyok biztos benne, pontosan mire gondolsz, de segítek! Például kérdezhetsz:\n" +
        "• „Fáj a csuklóm planche lean közben, mit csináljak?”\n" +
        "• „Túl nehéz volt a mai front lever, tegyünk könnyebbet.”\n" +
        "• „Mi a helyes forma a muscle-upnál?”\n" +
        "• „Mi a mai edzésem?”\n\n" +
        describeToday(todayWorkout),
    };
  }

  /* ---- public API -------------------------------------------------------- */
  function respond({ message, context }) {
    const goals = (context && context.goals) || [];
    const todayWorkout = context && context.todayWorkout;
    const intent = detectIntent(message);
    const goal = detectGoal(message, goals);

    switch (intent) {
      case "injury":
        return { intent, ...handleInjury(message) };
      case "harder":
        return { intent, ...handleHarder(message, goal) };
      case "easier":
        return { intent, ...handleEasier(message, goal) };
      case "form":
        return { intent, ...handleForm(message, goal) };
      case "nutrition":
        return { intent, ...handleNutrition() };
      case "rest":
        return { intent, ...handleRest() };
      case "plan":
        return { intent, ...handlePlan(todayWorkout, goals) };
      case "motivation":
        return { intent, ...handleMotivation(goals) };
      case "greeting":
        return { intent, ...handleGreeting(goals, todayWorkout) };
      default:
        return { intent, ...handleUnknown(goals, todayWorkout) };
    }
  }

  window.CF.coach = { respond, detectIntent };
})();
