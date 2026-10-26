# EventWise AI

EventWise AI is a local-first event planning workspace for weddings, birthdays, and community events. It turns a short event brief into an editable budget, a dependency-aware timeline, a vendor pipeline, and transparent planning recommendations.

Built for PromptWars Challenge 5. The planner works fully without an account, a backend, or an AI provider. AI is disabled by default and only runs after an explicit user action.

## Features

- **Guided event setup** with validation, currency selection, dietary and accessibility notes, and planning priorities.
- **Explainable replanning** when the date, guest count, budget, currency, or event type changes. Completed, in-progress, and user-edited tasks are preserved, and the change summary can be dismissed.
- **Budget planner** with editable category allocations, contingency control, expense tracking, budget alerts, and a text-based allocation chart.
- **Dependency-aware timeline** with priority levels, overdue detection, blocked-task handling, search, filters, and safe task editing.
- **Vendor workspace** with status tracking, quotes, comparison, contact details, follow-up notes, and clearly labelled sample vendors.
- **Idea Studio** with deterministic, locally generated recommendations, assumptions, and an optional server-side AI enhancement.
- **Local persistence** with schema migration, corrupt-data recovery, JSON export, and a confirmed reset.
- **Accessible interface** with keyboard navigation, a skip link, focus management, labelled errors, an accessible confirmation dialog, reduced-motion support, and print styles.
- **Responsive layout** for desktop and mobile, including an off-canvas navigation menu.

## Quick Start

Requirements: Node.js 18 or newer and npm.

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

Create an event to generate the workspace. Sample vendors are included for demonstration and are clearly marked as sample data.

## Production Build

```bash
npm run build
npm run serve
```

Open `http://127.0.0.1:8787`. The production server serves `dist/` and the optional AI endpoint from the same origin.

## Optional AI Setup

AI is optional. Without provider credentials, the AI endpoint returns a clear `503` response and the app keeps working with deterministic recommendations.

The server reads configuration from its process environment:

| Variable | Purpose |
| --- | --- |
| `AI_API_KEY` | Provider API key. Required for AI requests. |
| `AI_BASE_URL` | OpenAI-compatible base URL. Defaults to `https://api.openai.com/v1`. |
| `AI_MODEL` | Model name. Defaults to `gpt-4o-mini`. |
| `PORT` | Server port. Defaults to `8787`. |
| `HOST` | Server host. Defaults to `127.0.0.1`. |

PowerShell example:

```powershell
$env:AI_API_KEY = "your-key"
$env:AI_MODEL = "gpt-4o-mini"
npm run api
```

In another terminal, run `npm run dev`. Vite proxies `/api` to the local AI server.

To use the production server with the same variables:

```powershell
npm run build
npm run serve
```

Then open Settings, go to Idea Studio, and press **Enhance with optional AI**. No AI request is made on page load, and nothing is sent unless that button is pressed.

`.env.example` documents the available variables. npm scripts do not load `.env` automatically. On Node versions that support it, you can start the server manually with:

```bash
node --env-file=.env server/index.mjs
```

Never commit a real API key.

## Privacy and Data Handling

- All planning data is stored in the browser under the localStorage key `eventwise-ai-v1`.
- Data stays on the device unless the user exports it or explicitly requests optional AI recommendations.
- The AI payload excludes the event name, vendor contact details, and private notes.
- AI requests include event type, date, guest count, budget summary, theme, city, priorities, dietary requirements, and accessibility needs.
- All AI output is validated, labelled as unverified, and never applied automatically.
- Reset in Settings clears the stored workspace after confirmation.

## Replanning Rules

Changing key event details triggers a deterministic replan:

- Completed and in-progress tasks retain their status and dates.
- User-added tasks and user-edited generated tasks are preserved, including custom due dates.
- Budget categories are rebalanced proportionally when the total budget changes.
- Vendor records and expenses are not discarded.
- The UI lists changed fields, preserved tasks, and newly added tasks in an explainable summary.

AI is never used to decide which work to preserve.

## Reliability and Testing

```bash
npm run type-check
npm run lint
npm run test
npm run build
```

The suite contains 57 tests covering budget calculations, validation, timeline dependencies, replanning preservation, persistence migration, AI payload privacy, AI response validation, server rate limiting, reducer behavior, dialogs, and form accessibility.

Useful development commands:

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite development server. |
| `npm run api` | Start the optional AI API only. |
| `npm run build` | Type-check and build the production bundle. |
| `npm run serve` | Serve `dist/` and the AI API together. |
| `npm run preview` | Preview the built Vite bundle. |
| `npm run lint` | Run ESLint with zero warnings allowed. |
| `npm run type-check` | Run the TypeScript project build check. |
| `npm run test` | Run the Vitest suite once. |
| `npm run test:watch` | Run Vitest in watch mode. |
| `npm run test:coverage` | Produce a coverage report. |

## Project Structure

```text
src/
  ai/           Optional AI client and payload privacy controls
  components/   Layout, shared components, and feature pages
  context/      App state, reducer, persistence integration
  data/         localStorage schema, migration, export helpers
  engine/       Deterministic budget, timeline, vendor, readiness,
                replanning, and validation logic
  test/         Shared test setup and fixtures
  types/        Domain types
  utils/        Currency, date, ID, and formatting helpers
server/
  ai.mjs        Request validation, prompt building, provider calls,
                output normalization, and rate limiting
  index.mjs     Static production server and API routing
```

## Planning Assumptions

- Budget percentages and timeline lead times are practical starting points, not verified vendor prices.
- Sample vendors are fictional and marked as sample data.
- The app does not include live vendor availability, payments, authentication, or multi-device sync.
- Users should confirm prices, dietary safety, accessibility arrangements, and contract terms with real suppliers.
- AI recommendations may be incomplete or wrong and require human review.

## Accessibility Notes

The interface uses semantic headings, labelled form controls, inline error associations, keyboard-operable dialogs, visible focus styles, a skip link, live validation summaries, text alternatives for budget allocations, and print-friendly output. Reduced-motion preferences are respected. Automated tests cover the main form and dialog interaction paths; manual review with assistive technology is still recommended before production use.
