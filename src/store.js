/* ===========================================================================
 * CaliForge — App state store (React hook, localStorage-backed)
 * ---------------------------------------------------------------------------
 * A tiny reducer-based store exposed as a hook, so there is one source of
 * truth for goals, completed exercises, chat history, and manual plan
 * overrides (regress/progress a goal, deload a day). State persists to
 * localStorage so a refresh keeps the athlete's data.
 * ========================================================================= */

window.CF = window.CF || {};

(function () {
  const { useReducer, useEffect, useMemo, useCallback } = React;
  const STORAGE_KEY = "califorge:v1";

  function todayISO() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
  }

  function uid() {
    return "g_" + Math.random().toString(36).slice(2, 9);
  }

  const initialState = {
    goals: [],
    // completion keyed by `${dateISO}:${entryId}` -> true
    completed: {},
    // manual step offsets per goal (from AI regress/progress)
    stepOffset: {},
    // deload days: set of dateISO -> true
    deload: {},
    chat: [],
    // AI settings — API key lives ONLY in this visitor's localStorage.
    settings: {
      apiKey: "",
      model: "gemini-2.5-pro",
      useGemini: false,
    },
  };

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return initialState;
      const parsed = JSON.parse(raw);
      return {
        ...initialState,
        ...parsed,
        // deep-merge settings so new fields get defaults
        settings: { ...initialState.settings, ...(parsed.settings || {}) },
      };
    } catch {
      return initialState;
    }
  }

  function reducer(state, action) {
    switch (action.type) {
      case "ADD_GOAL": {
        const goal = {
          id: uid(),
          skillId: action.skillId,
          startDate: action.startDate || todayISO(),
          targetDate: action.targetDate,
          loggedProgress: 0,
          createdAt: Date.now(),
        };
        return { ...state, goals: [...state.goals, goal] };
      }
      case "REMOVE_GOAL": {
        const stepOffset = { ...state.stepOffset };
        delete stepOffset[action.goalId];
        return {
          ...state,
          goals: state.goals.filter((g) => g.id !== action.goalId),
          stepOffset,
        };
      }
      case "TOGGLE_ENTRY": {
        const key = `${action.dateISO}:${action.entryId}`;
        const completed = { ...state.completed };
        if (completed[key]) delete completed[key];
        else completed[key] = true;
        return { ...state, completed };
      }
      case "SET_LOGGED_PROGRESS": {
        return {
          ...state,
          goals: state.goals.map((g) =>
            g.id === action.goalId ? { ...g, loggedProgress: action.value } : g
          ),
        };
      }
      case "REGRESS_GOAL": {
        const cur = state.stepOffset[action.goalId] || 0;
        return { ...state, stepOffset: { ...state.stepOffset, [action.goalId]: cur - 1 } };
      }
      case "PROGRESS_GOAL": {
        const cur = state.stepOffset[action.goalId] || 0;
        return { ...state, stepOffset: { ...state.stepOffset, [action.goalId]: cur + 1 } };
      }
      case "DELOAD_TODAY": {
        return { ...state, deload: { ...state.deload, [action.dateISO]: true } };
      }
      case "CLEAR_DELOAD": {
        const deload = { ...state.deload };
        delete deload[action.dateISO];
        return { ...state, deload };
      }
      case "CHAT_PUSH": {
        return { ...state, chat: [...state.chat, action.message] };
      }
      case "CHAT_UPDATE": {
        return {
          ...state,
          chat: state.chat.map((m) =>
            m.id === action.id ? { ...m, ...action.patch } : m
          ),
        };
      }
      case "CHAT_CLEAR": {
        return { ...state, chat: [] };
      }
      case "SET_SETTINGS": {
        return { ...state, settings: { ...state.settings, ...action.patch } };
      }
      case "RESET_ALL":
        return initialState;
      default:
        return state;
    }
  }

  function useStore() {
    const [state, dispatch] = useReducer(reducer, undefined, load);

    useEffect(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        /* ignore quota errors */
      }
    }, [state]);

    const actions = useMemo(
      () => ({
        addGoal: (skillId, targetDate, startDate) =>
          dispatch({ type: "ADD_GOAL", skillId, targetDate, startDate }),
        removeGoal: (goalId) => dispatch({ type: "REMOVE_GOAL", goalId }),
        toggleEntry: (dateISO, entryId) => dispatch({ type: "TOGGLE_ENTRY", dateISO, entryId }),
        setLoggedProgress: (goalId, value) => dispatch({ type: "SET_LOGGED_PROGRESS", goalId, value }),
        regressGoal: (goalId) => dispatch({ type: "REGRESS_GOAL", goalId }),
        progressGoal: (goalId) => dispatch({ type: "PROGRESS_GOAL", goalId }),
        deloadToday: (dateISO) => dispatch({ type: "DELOAD_TODAY", dateISO }),
        clearDeload: (dateISO) => dispatch({ type: "CLEAR_DELOAD", dateISO }),
        chatPush: (message) => dispatch({ type: "CHAT_PUSH", message }),
        chatUpdate: (id, patch) => dispatch({ type: "CHAT_UPDATE", id, patch }),
        chatClear: () => dispatch({ type: "CHAT_CLEAR" }),
        setSettings: (patch) => dispatch({ type: "SET_SETTINGS", patch }),
        resetAll: () => dispatch({ type: "RESET_ALL" }),
      }),
      []
    );

    return { state, actions };
  }

  window.CF.useStore = useStore;
  window.CF.todayISO = todayISO;
})();
