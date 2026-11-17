---
name: angular-mcp
description: >-
  Uses the Angular CLI MCP server (angular-cli) and Angular v22 best practices for developing,
  building, testing, serving, and migrating this Angular project. Use when creating or modifying
  Angular components, services, directives, pipes, routes, templates, Signal Forms, state with
  signals, running builds or unit tests, managing the dev server, or searching Angular documentation.
---

# Angular CLI MCP & Angular v22 Skill

This skill integrates the official **Angular CLI MCP Server (`angular-cli`)** with modern **Angular v22** standards and the **DRA.CIN (`dracin`)** project conventions.

## 1. Mandatory MCP Tool Workflow

Always prefer the `angular-cli` MCP server tools over raw shell commands for Angular CLI operations:

1. **Discover Workspace First (`list_projects`)**
   - Always start by calling `list_projects` to retrieve the workspace `path` (`c:\dracin streaming\angular.json`), `frameworkVersion` (`22`), project `name` (`dracin`), `selectorPrefix` (`app`), `styleLanguage` (`css`), `unitTestFramework` (`vitest`), and available `targets` (`build`, `serve`, `test`).
   - Pass the returned workspace `path` (`workspace` or `workspacePath`) and project `name` (`dracin`) to subsequent MCP tools.

2. **Load Coding Standards (`get_best_practices`)**
   - Before generating or editing Angular code, call `get_best_practices` with `workspacePath` (or read [references/best-practices.md](./references/best-practices.md)) to ensure compliance with Angular v22 conventions.

3. **Verify APIs & Concepts (`search_documentation`)**
   - When unsure about Angular v22 APIs (e.g., Signal Forms, `linkedSignal`, `resource`, router APIs), call `search_documentation` with concise keywords, `version: 22`, and `includeTopContent: true` when full page details are needed.

4. **Build & Test (`run_target`)**
   - Use `run_target` with `project: "dracin"` and `target: "build"` or `target: "test"` to run production/development builds and headless Vitest unit tests.
   - Note: `run_target` does not support watch mode (`serve`). Use the `devserver_*` tools for the development server.

5. **Manage Development Server (`devserver_start`, `devserver_wait_for_build`, `devserver_stop`)**
   - Start the dev server in the background using `devserver_start` (default project port in `angular.json` is `4400`).
   - Immediately call `devserver_wait_for_build` after starting—and after every file edit—to verify compilation succeeds and inspect any build/template diagnostics.
   - Stop the server cleanly with `devserver_stop` when finished.

6. **Zoneless & OnPush Migration (`onpush_zoneless_migration`)**
   - Call `onpush_zoneless_migration` with an absolute file or directory path (`c:\dracin streaming\src\app\...`) to get iterative, one-step-at-a-time guidance for zoneless compatibility.

7. **Interactive Learning (`ai_tutor`)**
   - Call `ai_tutor` if the user asks for an interactive, guided Angular tutorial.

---

## 2. Angular v22 Coding Rules (Quick Reference)

For the full reference guide, read [references/best-practices.md](./references/best-practices.md).

- **Standalone by Default**: All components, directives, and pipes are standalone. **Do NOT** set `standalone: true` in `@Component`, `@Directive`, or `@Pipe` decorators.
- **OnPush by Default in v22+**: **Do NOT** explicitly set `changeDetection: ChangeDetectionStrategy.OnPush` in `@Component` (it is the default in Angular v22+).
- **Signals & Reactivity**:
  - Use `signal()` for local mutable state (`set` / `update`, never `mutate`).
  - Use `computed()` for derived read-only state and `linkedSignal()` for synchronized dependent state.
  - Use `input()`, `output()`, and `model()` functions instead of `@Input()` / `@Output()` decorators.
- **Dependency Injection & Services**:
  - Use `inject()` instead of constructor parameter injection.
  - Prefer `@Service()` (or `@Injectable({ providedIn: 'root' })`) for singleton services.
- **Templates & Control Flow**:
  - Always use built-in control flow (`@if`, `@for`, `@switch`, `@let`, `@defer`) instead of `*ngIf`, `*ngFor`, `*ngSwitch`.
  - Always include `track` in `@for` loops.
  - Bind `[class]` and `[style]` directly instead of `ngClass` and `ngStyle`.
  - Do not import `CommonModule`; import only specific pipes/directives if needed.
- **Host Bindings**:
  - Declare host listeners and bindings inside the `host: { ... }` property of `@Component` / `@Directive`. Never use `@HostBinding` or `@HostListener`.
- **Forms**:
  - Prefer **Signal Forms** (`@angular/forms/signals`) or Reactive Forms over template-driven forms.

---

## 3. Project Context (`dracin`)

- **Framework & UI**: Angular 22 + Tailwind CSS v4 (`src/styles.css` with `@theme` CSS variables) + PrimeNG v22 (`primeng`, `@primeuix/themes`, `primeicons`).
- **Internationalization**: `@jsverse/transloco` — keep user-facing copy localized where applicable.
- **Testing**:
  - Unit tests: **Vitest** (`npm test` or MCP `run_target` with `target: "test"`).
  - E2E tests: **Playwright** (`playwright.config.ts`, `e2e/`).
- **Code Generation via Schematics**:
  - To inspect available Angular schematics options via CLI when needed: `npx ng generate --help` or `npx ng generate component --help`.
