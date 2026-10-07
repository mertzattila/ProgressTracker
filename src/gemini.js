/* ===========================================================================
 * CaliForge — Gemini API client (browser, "bring your own key")
 * ---------------------------------------------------------------------------
 * Calls Google's Gemini API directly from the browser using an API key that
 * the user supplies in the app's AI settings. The key is stored ONLY in the
 * visitor's own localStorage (see store.js) and is never committed to the
 * repo or sent anywhere except Google's endpoint.
 *
 *   POST https://generativelanguage.googleapis.com/v1beta/models/<model>:generateContent
 *
 * The coach asks Gemini to answer as a calisthenics coach AND, when the user
 * wants to change the plan, to emit a structured action. We get that reliably
 * via responseSchema (JSON mode): the model returns { reply, action? }.
 *
 * Public API (mirrors a chat-completion call):
 *     await CF.gemini.generate({ apiKey, model, system, history, message })
 *       -> { text, action? }     // action: { type, goalId?, label }
 * ========================================================================= */

window.CF = window.CF || {};

(function () {
  const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

  const MODELS = [
    { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro (okosabb)" },
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash (gyors)" },
  ];

  // Structured output schema so plan-modifying actions are machine-readable.
  const RESPONSE_SCHEMA = {
    type: "OBJECT",
    properties: {
      reply: {
        type: "STRING",
        description: "A coach válasza a felhasználónak, magyarul, barátságos és szakszerű hangnemben.",
      },
      action: {
        type: "OBJECT",
        nullable: true,
        description:
          "Opcionális terv-módosítás, CSAK ha a felhasználó edzésterv-változtatást kér vagy az indokolt.",
        properties: {
          type: {
            type: "STRING",
            enum: ["DELOAD_TODAY", "REGRESS_GOAL", "PROGRESS_GOAL", "NONE"],
          },
          goalId: {
            type: "STRING",
            nullable: true,
            description: "A cél azonosítója REGRESS_GOAL/PROGRESS_GOAL esetén.",
          },
          label: {
            type: "STRING",
            description: "Rövid, kattintható gombfelirat az akcióhoz, magyarul.",
          },
        },
        required: ["type", "label"],
      },
    },
    required: ["reply"],
  };

  /**
   * Low-level call. Returns parsed { text, action? } or throws with a
   * human-friendly Hungarian message.
   */
  async function generate({ apiKey, model, system, history, message, signal }) {
    if (!apiKey) throw new Error("Hiányzik az API kulcs.");
    const useModel = model || "gemini-2.5-pro";

    // Build conversation: prior turns + the new user message.
    const contents = [];
    (history || []).forEach((m) => {
      if (m.role !== "user" && m.role !== "assistant") return;
      contents.push({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.text }],
      });
    });
    contents.push({ role: "user", parts: [{ text: message }] });

    const body = {
      systemInstruction: system ? { parts: [{ text: system }] } : undefined,
      contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
      // Keep safety at default; coaching content is benign.
    };

    let res;
    try {
      res = await fetch(
        `${ENDPOINT}/${encodeURIComponent(useModel)}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify(body),
          signal,
        }
      );
    } catch (e) {
      throw new Error("Hálózati hiba a Gemini hívásakor. Ellenőrizd az internetkapcsolatot.");
    }

    if (!res.ok) {
      let detail = "";
      try {
        const err = await res.json();
        detail = err?.error?.message || "";
      } catch {
        /* ignore */
      }
      if (res.status === 400 && /API key not valid/i.test(detail)) {
        throw new Error("Érvénytelen API kulcs. Ellenőrizd a kulcsot az AI beállításokban.");
      }
      if (res.status === 403) {
        throw new Error("A kulcs nem jogosult ehhez a modellhez, vagy nincs engedélyezve a Generative Language API.");
      }
      if (res.status === 429) {
        throw new Error("Elérted a Gemini kvóta/limit korlátot. Próbáld kicsit később.");
      }
      throw new Error(`Gemini hiba (${res.status})${detail ? ": " + detail : ""}.`);
    }

    const data = await res.json();
    const candidate = data?.candidates?.[0];
    const text = candidate?.content?.parts?.map((p) => p.text).join("") || "";

    if (!text) {
      const blocked = data?.promptFeedback?.blockReason || candidate?.finishReason;
      throw new Error(blocked ? `A válasz nem jött létre (${blocked}).` : "Üres válasz a Geminitől.");
    }

    // responseSchema guarantees JSON, but be defensive.
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { text: text.trim() };
    }

    const out = { text: (parsed.reply || "").trim() || "…" };
    if (parsed.action && parsed.action.type && parsed.action.type !== "NONE") {
      out.action = {
        type: parsed.action.type,
        goalId: parsed.action.goalId || null,
        label: parsed.action.label || "Terv módosítása",
      };
    }
    return out;
  }

  /** Lightweight key check used by the "Teszt" button in settings. */
  async function testKey({ apiKey, model }) {
    const r = await generate({
      apiKey,
      model,
      system: "Te egy teszt vagy. Válaszolj pontosan ennyivel a reply mezőben: OK.",
      history: [],
      message: "ping",
    });
    return r;
  }

  window.CF.gemini = { generate, testKey, MODELS };
})();
