# Markr — Shot List Planner

A dark, premium desktop + web app for filmmakers to plan and manage shot lists.

**Web app:** https://stephanteig.github.io/shotlist-planner/  
**Latest release:** https://github.com/stephanteig/shotlist-planner/releases/latest

---

## Stack

| Layer | Tech |
|---|---|
| Desktop shell | Tauri v2 (Rust) |
| Frontend | React 18 + TypeScript + Vite 5 |
| Styling | Tailwind CSS v3 + CSS variables |
| State | Zustand v5 |
| Routing | react-router-dom v6 (HashRouter) |
| Drag & drop | @dnd-kit/core + @dnd-kit/sortable |
| Icons | lucide-react |
| Auth | Firebase Auth (Google sign-in) |
| Database | Firestore (cloud sync) |
| CI/CD | GitHub Actions |
| Web deploy | GitHub Pages |

---

## Features

- **Multi-project dashboard** — create, switch, delete projects
- **Shot list editor** — sections (scenes) with drag-and-drop rows (shots)
- **Shot fields** — scene, shot number, type, lens, movement, lighting, audio, notes
- **Progress tracking** — mark shots as done, see completion %
- **Google login** — Firebase Auth with PKCE desktop OAuth flow
- **Cloud sync** — Firestore per user; toggle Local/Cloud in Settings (desktop only)
- **Import/Export** — `.swshot` JSON, backward-compatible with old single-page version
- **Dark premium UI** — frameless window, custom titlebar, accent color picker
- **Settings** — font size, compact mode, accent color, storage mode
- **Desktop builds** — Mac (Apple Silicon + Intel) and Windows via GitHub Actions

---

## Pages

| Route | Page |
|---|---|
| `/` | Dashboard — stats cards + project list |
| `/project/:id` | Project view — shot list editor with drag & drop |
| `/settings` | Settings — appearance, account, storage |

---

## Project structure

```
src/
  components/
    auth/         UserMenu.tsx
    layout/       AppShell.tsx, Titlebar.tsx, Sidebar.tsx
    ui/           shadcn-style primitives
  lib/
    auth-desktop.ts   PKCE Google OAuth for Tauri
    firebase.ts       Firebase init (graceful degradation)
    firestore.ts      Cloud sync helpers
    platform.ts       isTauri() / isWeb()
  pages/
    Dashboard.tsx
    ProjectView.tsx
    Settings.tsx
  store/
    authStore.ts
    projectStore.ts
    settingsStore.ts
  types/index.ts

src-tauri/
  src/lib.rs          Rust: OAuth TCP listener + open crate
  capabilities/       Tauri ACL permissions
  tauri.conf.json
  Cargo.toml

.github/workflows/
  build-desktop.yml   Mac + Windows on git tags
  deploy-pages.yml    GitHub Pages on main push
```

---

## Local development

### Prerequisites

- Node.js 20+
- Docker — used by `npm run dev` to run the local backend stack
- Rust stable — `rustup update` (only for Tauri desktop builds)
- Xcode Command Line Tools (Mac, only for Tauri desktop builds)

### Setup

```bash
git clone https://github.com/stephanteig/shotlist-planner.git
cd shotlist-planner
npm install
cp .env.example .env.local   # fill in Firebase values
npm run dev                   # runs Azurite + Vite (5173) + Hono (8080)
```

Open http://localhost:5173 and sign in with Google. Data persists in the
local Azurite container; `docker compose down -v` resets everything.

### Desktop development (Tauri)

```bash
npm run tauri:dev
```

Desktop dev requires Rust stable (`rustup update`) and Xcode Command Line
Tools on macOS. The Tauri window loads from Vite's dev server — run
`npm run dev` first so the backend is reachable, or set
`VITE_API_URL=http://localhost:8080` in `.env.local` to talk to the
locally-running Hono.

---

## Environment variables (`.env.local`)

```env
# Firebase — Console → Project Settings → Your apps → Web app config
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=

# Google Desktop OAuth — Cloud Console → APIs & Services → Credentials
# Type: Desktop application
VITE_GOOGLE_DESKTOP_CLIENT_ID=
VITE_GOOGLE_DESKTOP_CLIENT_SECRET=
```

All vars must also be added as **GitHub repository secrets** for CI builds.

---

## Desktop OAuth (PKCE)

Firebase's `signInWithPopup` doesn't work in Tauri because `tauri://localhost` can't be added as an authorized domain. Instead the desktop app uses a system-browser PKCE flow:

1. Rust binds an ephemeral `127.0.0.1` port
2. Builds Google OAuth URL with PKCE `code_challenge` + `redirect_uri`
3. Opens system browser via Rust `open` crate (`open::that_detached`)
4. User completes Google sign-in in their normal browser
5. Google redirects to `http://127.0.0.1:<port>?code=...`
6. Rust parses the code, serves a success page, emits `oauth::code` Tauri event
7. TypeScript exchanges code for tokens at `oauth2.googleapis.com/token` (with `client_secret`)
8. Signs into Firebase with `signInWithCredential(GoogleAuthProvider.credential(...))`

`http://127.0.0.1` on any port is always allowed for Desktop OAuth clients.

---

## Releasing

```bash
git tag v1.0.0
git push origin v1.0.0
```

Produces a draft GitHub Release with:

| File | Platform |
|---|---|
| `Markr_x.x.x_aarch64.dmg` | Mac Apple Silicon |
| `Markr_x.x.x_x64.dmg` | Mac Intel |
| `Markr_x.x.x_x64_en-US.msi` | Windows installer |
| `Markr_x.x.x_x64-setup.exe` | Windows setup |

Publish the draft manually:

```bash
gh release edit vX.X.X --draft=false --latest
```

### Required GitHub secrets

`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`,
`VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`,
`VITE_GOOGLE_DESKTOP_CLIENT_ID`, `VITE_GOOGLE_DESKTOP_CLIENT_SECRET`

---

## Mac install note

macOS blocks unsigned apps. After installing, run once:

```bash
xattr -cr /Applications/Markr.app
```

Removing this requirement needs an Apple Developer certificate ($99/year).

---

## Storage modes (desktop)

| Mode | Behaviour |
|---|---|
| **Local** | `localStorage` only. No login needed. |
| **Cloud** | `localStorage` + Firestore. Requires Google login. Cross-device sync. |

Web always uses cloud when signed in. Firestore writes are debounced 1.2 s to `users/{uid}/projects/{id}`.

---

## Next steps

- [ ] Code signing (removes xattr requirement)
- [ ] Auto-publish releases (remove manual `gh release edit` step)
- [ ] iOS / Android (Tauri mobile or Capacitor — not started)
- [ ] Offline Firestore support
