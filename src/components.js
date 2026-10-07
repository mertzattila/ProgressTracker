/* ===========================================================================
 * CaliForge — Reusable presentational components
 * ---------------------------------------------------------------------------
 * Small, dependency-free building blocks shared across pages: inline SVG
 * icons, buttons, progress bars, goal cards, exercise rows, modal, etc.
 * All styled with Tailwind utility classes + the custom theme in index.html.
 * ========================================================================= */

window.CF = window.CF || {};

(function () {
  const { useState, useEffect, useRef } = React;

  /* ---- accent helpers ---------------------------------------------------- */
  const ACCENT = {
    blue: {
      text: "text-neon-blue",
      bg: "bg-neon-blue",
      ring: "ring-neon-blue/40",
      border: "border-neon-blue/40",
      glow: "shadow-glow-blue",
      from: "from-neon-blue",
    },
    violet: {
      text: "text-neon-violet",
      bg: "bg-neon-violet",
      ring: "ring-neon-violet/40",
      border: "border-neon-violet/40",
      glow: "shadow-glow",
      from: "from-neon-violet",
    },
    green: {
      text: "text-neon-green",
      bg: "bg-neon-green",
      ring: "ring-neon-green/40",
      border: "border-neon-green/40",
      glow: "shadow-glow-green",
      from: "from-neon-green",
    },
  };
  const accent = (a) => ACCENT[a] || ACCENT.violet;

  /* ---- icons (inline SVG) ------------------------------------------------ */
  const Icon = {
    Dashboard: (p) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
        <rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" />
      </svg>
    ),
    Calendar: (p) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
        <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    ),
    Chat: (p) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
        <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
    Plus: (p) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}><path d="M12 5v14M5 12h14" /></svg>
    ),
    Check: (p) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20 6 9 17l-5-5" /></svg>
    ),
    Trash: (p) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
        <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      </svg>
    ),
    Clock: (p) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
    ),
    Send: (p) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m22 2-7 20-4-9-9-4z" /><path d="M22 2 11 13" /></svg>
    ),
    Close: (p) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}><path d="M18 6 6 18M6 6l12 12" /></svg>
    ),
    Bolt: (p) => (
      <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M13 2 3 14h7l-1 8 10-12h-7z" /></svg>
    ),
    Sparkle: (p) => (
      <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6z" /></svg>
    ),
  };

  /* ---- Logo -------------------------------------------------------------- */
  function Logo({ compact }) {
    return (
      <div className="flex items-center gap-2.5 select-none">
        <div className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-neon-violet to-neon-blue shadow-glow">
          <Icon.Bolt className="h-5 w-5 text-white" />
        </div>
        {!compact && (
          <div className="leading-none">
            <div className="font-display text-lg font-bold tracking-tight text-gradient">CaliForge</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Calisthenics Planner</div>
          </div>
        )}
      </div>
    );
  }

  /* ---- Button ------------------------------------------------------------ */
  function Button({ variant = "primary", className = "", children, ...rest }) {
    const base =
      "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-violet/60 disabled:opacity-40 disabled:cursor-not-allowed";
    const variants = {
      primary:
        "bg-gradient-to-r from-neon-violet to-neon-blue text-white hover:shadow-glow hover:brightness-110",
      ghost: "bg-base-600/60 text-slate-200 hover:bg-base-500 border border-white/5",
      subtle: "text-slate-300 hover:text-white hover:bg-white/5",
      danger: "bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 border border-rose-500/30",
    };
    return (
      <button className={`${base} ${variants[variant]} ${className}`} {...rest}>
        {children}
      </button>
    );
  }

  /* ---- ProgressBar ------------------------------------------------------- */
  function ProgressBar({ value, accent: a = "violet", showLabel = true }) {
    const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
    const ac = accent(a);
    return (
      <div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-base-600">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${ac.from} to-white/70 transition-all duration-700`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {showLabel && (
          <div className="mt-1.5 flex justify-between text-[11px] text-slate-400">
            <span>Haladás</span>
            <span className={`font-semibold ${ac.text}`}>{pct}%</span>
          </div>
        )}
      </div>
    );
  }

  /* ---- Modal ------------------------------------------------------------- */
  function Modal({ open, onClose, title, children }) {
    useEffect(() => {
      function onKey(e) {
        if (e.key === "Escape") onClose();
      }
      if (open) document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    if (!open) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose} />
        <div className="glass relative w-full max-w-lg rounded-2xl p-6 shadow-2xl animate-slide-up">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-lg font-bold">{title}</h3>
            <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white">
              <Icon.Close className="h-5 w-5" />
            </button>
          </div>
          {children}
        </div>
      </div>
    );
  }

  /* ---- Badge ------------------------------------------------------------- */
  function Badge({ accent: a = "violet", children }) {
    const ac = accent(a);
    return (
      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${ac.border} ${ac.text} bg-white/5`}>
        {children}
      </span>
    );
  }

  window.CF.ui = { Icon, Logo, Button, ProgressBar, Modal, Badge, accent, ACCENT };
})();
