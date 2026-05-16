# Vite Migration Plan

## Why migrate

`frontend/` runs on `react-scripts` (Create React App), which Facebook
officially **deprecated in early 2025**. It still works, but:

- No more security patches for the build toolchain.
- Webpack 5 + Babel cold-starts are slow (Vite is roughly 10–20× faster).
- New libraries are dropping CRA-compatible examples.
- HMR is flakier than Vite's.

This is not urgent — nothing is broken — but it's the kind of thing that
will get more painful the longer it's left.

## Scope

Frontend only. Backend stays as-is.

## Step-by-step

### 1. Install Vite

```powershell
cd frontend
npm install --save-dev vite @vitejs/plugin-react
```

### 2. Rename entry HTML

Move `public/index.html` → `index.html` (project root of `frontend/`).
Inside it, replace the CRA placeholders:

- `%PUBLIC_URL%/favicon.ico` → `/favicon.ico`
- `%PUBLIC_URL%/manifest.json` → `/manifest.json`
- Add this just before `</body>`:
  ```html
  <script type="module" src="/src/index.js"></script>
  ```
- Delete the existing `<noscript>` block referencing CRA.

### 3. Add `vite.config.js`

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 3000,
    open: true,
  },
  build: {
    outDir: 'build', // keep CRA's output dir for any deploy scripts
  },
});
```

### 4. Switch env-var prefix

CRA: `REACT_APP_*` → Vite: `VITE_*`.

In `frontend/.env`, rename:
```
REACT_APP_SPOTIFY_CLIENT_ID  → VITE_SPOTIFY_CLIENT_ID
REACT_APP_SPOTIFY_REDIRECT_URI → VITE_SPOTIFY_REDIRECT_URI
REACT_APP_API_URL → VITE_API_URL
```

And in code, `process.env.REACT_APP_X` → `import.meta.env.VITE_X`.
Files to touch (grep first):
- `src/utils/spotifyApi.js`
- `src/pages/Login.js`
- any others that grep turns up

### 5. Rename `.js` → `.jsx`

Vite is stricter than CRA — any file that contains JSX must end in `.jsx`.
Easiest sweep (PowerShell):

```powershell
Get-ChildItem -Recurse -Filter *.js src\ |
  Where-Object { (Select-String -Path $_.FullName -Pattern '<[A-Z]|className=|</') } |
  Rename-Item -NewName { $_.Name -replace '\.js$', '.jsx' }
```

Then update import statements that explicitly reference `.js`. Most are
extensionless, so this is usually a small cleanup.

### 6. Update `package.json` scripts

```json
{
  "scripts": {
    "start": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "react-scripts test"
  }
}
```

(Keep `react-scripts test` for now — migrating Jest to Vitest is a
separate task.)

### 7. Remove CRA

```powershell
npm uninstall react-scripts
```

You can keep `react-scripts` installed during the transition if Jest is
still using it. Once tests are migrated, drop it.

### 8. Verify

- `npm start` → app loads at `http://127.0.0.1:3000`.
- Spotify login flow still works (the env var rename is the most likely
  cause of breakage here — double-check the redirect URI).
- `npm run build` → check the `build/` folder produces a valid bundle.

## Gotchas to expect

1. **Tailwind** — should "just work" since it has a Vite plugin already
   wired through PostCSS. If `tailwind.config.js` references `./src/**/*.js`,
   broaden it to `./src/**/*.{js,jsx}`.
2. **Imports of CSS from `node_modules`** — Vite is fine with these but
   the path may need the package's exact export.
3. **`process.env`** — anything not renamed to `import.meta.env` will be
   undefined. Grep for `process.env` and fix what's missing.
4. **Public assets** — references via `process.env.PUBLIC_URL` need to
   change to just `/asset.png`.

## Rollback

The migration is git-revertable in one commit. Nothing on the backend or
in the deployed build pipeline needs to change to roll back.
