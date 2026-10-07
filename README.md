# ⚡ CaliForge — Intelligens Calisthenics Edzéstervező & Célkövető

Modern, reszponzív webalkalmazás, amely segít megtervezni és nyomon követni a
calisthenics erőelemek (Front Lever, Planche, Muscle-up, Human Flag, stb.)
felé vezető utat — napi szintre lebontott edzéstervvel és beépített **AI
edzővel**.

![tech](https://img.shields.io/badge/React-18-38bdf8) ![tech](https://img.shields.io/badge/Tailwind-CSS-a855f7) ![mode](https://img.shields.io/badge/UI-Dark%20Mode-22e5a4)

---

## ✨ Fő funkciók

### 1. Dashboard & több cél kezelése (Multi-Goal System)
- Új célok hozzáadása legördülő menüből a legnépszerűbb elemekkel
  (Full Planche, Straddle Planche, Front Lever, Muscle-up, Handstand,
  Human Flag, L-Sit, Pistol Squat).
- Minden célhoz **céldátum** rendelhető (date picker).
- **Párhuzamos célok** támogatása — minden cél külön kártyán jelenik meg a
  hátralévő idővel (hetek/napok), progressziós sávval és az aktuális
  rávezető gyakorlattal.
- Logolható kézi haladás csúszkával.

### 2. Intelligens edzésterv-generátor & naptár (Schedule Builder)
- Automatikus **Push–Pull–Láb/Core** heti bontás, úgy elosztva, hogy a
  **Planche (Push)** és a **Front Lever (Pull)** napok ne ütközzenek, de
  mindegyik elegendő volument kapjon.
- Interaktív **napi nézet**: aznapi gyakorlatok, szériák, ismétlések vagy
  tartásidő (pl. _Advanced Tuck Front Lever hold: 4×10s_, _Planche lean: 5×15s_).
- A gyakorlatok **kipipálhatók** egyértelmű vizuális visszajelzéssel; a nap
  elkészültekor ünneplő állapot jelenik meg.

### 3. Beépített AI asszisztens (AI Coach)
- Dedikált **AI Coach oldal** + a képernyő sarkából megnyitható **lebegő
  chat widget**.
- Ismeri az aktuális célokat és az aznapi edzéstervet.
- Kérdezhetsz **formáról**, **sérülésről** (pl. _„Fáj a csuklóm planche lean
  közben, mit csináljak?”_), vagy kérheted a terv **azonnali módosítását**
  (pl. _„Túl nehéz volt a mai front lever, tegyünk könnyebb rávezetőket”_).
- Az AI javaslatai **egy kattintással alkalmazhatók** (könnyítés/nehezítés,
  deload nap).

---

## 🎨 UI / UX
- Alapértelmezett **sötét mód**, sportos-minimalista dizájn.
- **Neon** akcentus színek (kék / lila / neonzöld), finom glow és
  üveghatású (glassmorphism) panelek.
- Teljesen **reszponzív**: asztali oldalsáv, mobil alsó navigáció.
- Az összes adat a böngésző **localStorage**-ában tárolódik (frissítés után
  is megmarad).

---

## 🚀 Futtatás

Az alkalmazás **build-mentes** — React, Tailwind és Babel CDN-ről töltődik,
így csak egy statikus kiszolgáló kell:

```bash
# a projekt gyökeréből
python3 -m http.server 8080
# majd nyisd meg: http://localhost:8080
```

vagy bármely statikus szerverrel (`npx serve`, VS Code Live Server, stb.).

> Internetkapcsolat szükséges az első betöltéshez (CDN függőségek).

---

## 🧱 Projektstruktúra

```
.
├── index.html          # belépési pont, CDN-ek + Tailwind téma konfig
├── styles.css          # globális stílusok, scrollbar, slider, glass utility
└── src/
    ├── data.js         # erőelem/gyakorlat tudásbázis + progressziók
    ├── planner.js      # ütemező & progressziós motor (tiszta függvények)
    ├── coach.js        # AI Coach motor (intent-felismerés + válaszok)
    ├── store.js        # állapotkezelés (reducer + localStorage hook)
    ├── components.js    # újrahasznosítható UI komponensek + ikonok
    └── app.js          # alkalmazás-váz, oldalak, navigáció, chat widget
```

### Architektúra megjegyzés az AI-ról
Az AI Coach egy **determinisztikus, kontextustudatos** motor (`src/coach.js`),
amelynek publikus API-ja szándékosan egy chat-completion hívás formáját
követi:

```js
CF.coach.respond({ message, context }) // -> { text, action? }
```

Így ha később valódi LLM-et szeretnél bekötni, az egy **drop-in csere** a
`respond` függvényben — a UI és az állapotkezelés változatlan maradhat.

---

## 📋 Támogatott erőelemek
Front Lever · Straddle Planche · Full Planche · Muscle-up ·
Freestanding Handstand · Human Flag · L-Sit → V-Sit · Pistol Squat

Mindegyikhez beépített, nehézség szerint rendezett rávezető progresszió és
kiegészítő gyakorlatok tartoznak.
