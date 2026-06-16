# Verdant

Early infrastructure repair intelligence for cities. Verdant helps municipal teams catch visible damage before it becomes wasteful full replacement.

## Pages

- **/** — Landing page
- **/auth** — Sign in / create account
- **/dashboard** — Upload inspection photos (protected)

## Run locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173).

## Stack

- React 19 + Vite
- React Router
- Lucide icons
- Local mock auth (localStorage)

## Next steps

- Wire Supabase auth
- Connect YOLOv8 + analysis API
- Results view with clickable damage overlays
