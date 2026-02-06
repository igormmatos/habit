# Habit
Portfolio-ready landing + Vite scaffold for the Habit tracker. This repo keeps the original 3.x HTML builds intact while setting up a modern frontend workflow.

## Demo
Coming soon. For now, run locally with Vite.

## Features
- Modern Vite vanilla JS setup
- Landing page with app preview
- Dedicated App placeholder screen
- Legacy archive page linking the original HTML builds
- Export/import JSON data + demo seed data

## Roadmap (Short)
1. Habit creation + local-first storage
2. Stacks workflow and daily check-ins
3. Insights and lightweight analytics

## Run Locally
```bash
npm install
npm run dev
```

Build for production:
```bash
npm run build
npm run preview
```

## Project Structure
```
.
├── index.html
├── app.html
├── legacy.html
├── src/
│   ├── main.js
│   ├── app.js
│   └── style.css
├── legacy/
│   ├── habit_stack_master_3.0.html
│   └── habit_tracker_master_3.0.html
└── package.json
```

## Legacy
The original standalone HTML versions live in `legacy/` and are preserved without changes:
- `legacy/habit_stack_master_3.0.html`
- `legacy/habit_tracker_master_3.0.html`

If the build server does not serve the `legacy/` folder, open these files directly from the repository.

## Data Import/Export
In the app view (`/app.html`) you can:
- Export a JSON snapshot of your current data.
- Import a JSON snapshot (replaces existing data after confirmation).
- Load demo data (3 habits + 14 days of check-ins).
- Clear all saved data.

## Stack -> Print -> PDF
1. Open `stack.html` and configure your plan (metadata + habits).
2. Click **Abrir Print Tracker** to send data into `tracker.html`.
3. In `tracker.html`, adjust days/priority/optional habits and click **Gerar preview**.
4. Export a PDF via **Exportar PDF** (A4 landscape, gerado client-side).
