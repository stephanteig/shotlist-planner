# Shotlist Planner

A lightweight, offline-capable PWA for planning photo and video shoots. Built for Studio Wallin — runs entirely in the browser, installs on iPhone/Android, and syncs nothing to any server.

**Live app:** https://stephanteig.github.io/shotlist-planner/

---

## Features

- **Sections** — group shots by location, scene, or time of day, each with a custom color
- **Three row types** — Shot (camera icon), Note (pencil), Quote (speech bubble)
- **Check off shots** as you go — strikethrough with progress bar update
- **Drag and drop** rows to reorder within a section
- **Collapse sections** to keep the list tidy on set
- **Focus mode** — hides sidebar, expands editor full-screen
- **Templates** — quick-start with a Real Estate, Interview, or Event template
- **Export / Import** — save your shotlist as a `.swshot` JSON file and share or re-import it
- **AI-ready JSON format** — ask an AI to generate a shotlist and paste/import the file
- **PWA** — installable on iOS (Add to Home Screen) and Android, works fully offline
- **Dark UI** — DaisyUI `night` theme with violet accent

---

## How to Use

### Building a shotlist

1. Fill in **Client**, **Date**, and **Crew** in the top panel (right sidebar on desktop, swipe via tab bar on mobile)
2. Click **+ Add Section** to create a scene/location group
3. Inside a section, click **+ Shot**, **+ Note**, or **+ Quote** to add rows
4. Tap the colored circle on a section to cycle through 8 accent colors
5. Drag the ⠿ handle to reorder rows
6. Check the checkbox when a shot is done — progress bar updates live

### On mobile

The app has a bottom tab bar with two tabs:
- **Editor** — the shotlist
- **Info** — client/date/crew panel

The overflow menu (⋮) on each section gives access to Delete, Collapse, and color options.

---

## Exporting and Importing

### Export

Click the **Export** button (bottom of sidebar / Info tab). The app downloads a `.swshot` file named after the client and date, e.g. `ola-nordmann-2024-01-20.swshot`.

### Import

Click **Import** (or drag a `.swshot` file onto the page). The app validates the file and replaces the current shotlist.

---

## JSON Format (`.swshot`)

The export format is plain JSON with a `.swshot` extension. You can generate this with an AI assistant and import it directly.

### Full schema

```json
{
  "_app": "sw-shotlist",
  "_version": 1,
  "exportedAt": "2024-01-15T10:30:00.000Z",
  "meta": {
    "client": "Ola Nordmann",
    "date": "2024-01-20",
    "crew": "Stephan / Markus"
  },
  "sections": [
    {
      "id": 1714000000000.123,
      "name": "Åpning",
      "color": "#7c6af7",
      "collapsed": false,
      "rows": [
        {
          "id": 1714000000001.456,
          "type": "shot",
          "text": "Wide av stue",
          "checked": false
        },
        {
          "id": 1714000000002.789,
          "type": "note",
          "text": "Husk ekstra batteri",
          "checked": false
        },
        {
          "id": 1714000000003.012,
          "type": "quote",
          "text": "Dette er en perfekt leilighet",
          "checked": false
        }
      ]
    }
  ]
}
```

### Field reference

| Field | Type | Required | Description |
|---|---|---|---|
| `_app` | string | **Yes** | Must be `"sw-shotlist"` — used for import validation |
| `_version` | number | Yes | Format version, currently `1` |
| `exportedAt` | ISO 8601 string | No | Timestamp of export |
| `meta.client` | string | No | Client name shown in the header |
| `meta.date` | string (`YYYY-MM-DD`) | No | Shoot date |
| `meta.crew` | string | No | Crew names, comma or slash separated |
| `sections[].id` | float | Yes | Unique numeric ID (use `Date.now() + Math.random()`) |
| `sections[].name` | string | Yes | Section label, e.g. `"Eksteriør"` |
| `sections[].color` | hex string | Yes | One of the 8 accent colors (see below) |
| `sections[].collapsed` | boolean | Yes | Start collapsed (`true`) or expanded (`false`) |
| `sections[].rows[].id` | float | Yes | Unique numeric ID |
| `sections[].rows[].type` | `"shot"` \| `"note"` \| `"quote"` | Yes | Row type — affects icon and styling |
| `sections[].rows[].text` | string | Yes | The row content |
| `sections[].rows[].checked` | boolean | Yes | Whether the shot has been completed |

### Available section colors

```
#7c6af7  violet (default)
#34d399  green
#60a5fa  blue
#fbbf24  amber
#f87171  red
#f472b6  pink
#2dd4bf  teal
#a78bfa  lavender
```

---

## Generating a shotlist with AI

You can ask any AI assistant to produce a `.swshot` file for you. Use this prompt:

> Generate a shotlist for a **[type of shoot]** at **[location/client]** on **[date]** with crew **[names]**.  
> Output a valid `.swshot` JSON file using exactly this schema:
>
> ```json
> {
>   "_app": "sw-shotlist",
>   "_version": 1,
>   "exportedAt": "<current ISO timestamp>",
>   "meta": { "client": "...", "date": "YYYY-MM-DD", "crew": "..." },
>   "sections": [
>     {
>       "id": <unique float>,
>       "name": "Section name",
>       "color": "<one of: #7c6af7 #34d399 #60a5fa #fbbf24 #f87171 #f472b6 #2dd4bf #a78bfa>",
>       "collapsed": false,
>       "rows": [
>         { "id": <unique float>, "type": "shot", "text": "...", "checked": false },
>         { "id": <unique float>, "type": "note", "text": "...", "checked": false }
>       ]
>     }
>   ]
> }
> ```
>
> Use `type: "shot"` for camera shots, `type: "note"` for reminders/logistics, and `type: "quote"` for interview questions or quotes.  
> For IDs, use sequential numbers like `1714000000001.1`, `1714000000001.2`, etc.

Save the AI's output as `my-shoot.swshot` and import it into the app.

---

## PWA Installation

### iPhone / iPad
1. Open the app in Safari
2. Tap the Share button → **Add to Home Screen**
3. The app installs with a custom icon and runs full-screen

### Android
1. Open in Chrome
2. Tap the three-dot menu → **Add to Home Screen** (or look for the install banner)

The service worker caches all assets — the app works fully offline after first load.

---

## Local Development

```bash
git clone https://github.com/stephanteig/shotlist-planner
cd shotlist-planner
# open src/index.html in a browser — no build step required
```

The app is a single HTML file. No bundler, no dependencies to install. DaisyUI and Google Fonts are loaded from CDN.

### Deploy

Pushes to `main` automatically deploy via GitHub Actions to `stephanteig.github.io/shotlist-planner/`.

The workflow copies `src/*` into the `stephanteig.github.io` pages repo and commits.

---

## Tech Stack

- Vanilla JS (no framework)
- [DaisyUI v4](https://daisyui.com) — Tailwind CSS component library
- [Tailwind CSS v3](https://tailwindcss.com) (via DaisyUI CDN)
- [DM Mono + Syne](https://fonts.google.com) — Google Fonts
- Service Worker + Web App Manifest (PWA)
- GitHub Actions (auto-deploy)

---

*Made by [Studio Wallin](https://github.com/stephanteig)*
