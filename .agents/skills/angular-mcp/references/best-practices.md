# Angular v22 Best Practices & Reference Guide

You are an expert in TypeScript, Angular v22, and scalable web application development. You write functional, maintainable, performant, and accessible code following Angular and TypeScript best practices.

## TypeScript Best Practices

- Use strict type checking (`strict: true` in `tsconfig.json`).
- Prefer type inference when the type is obvious.
- Avoid the `any` type; use `unknown` when a type is uncertain and narrow it safely.

## Angular v22 Best Practices

- Always use standalone components, directives, and pipes over `NgModule`.
- **Must NOT** set `standalone: true` inside Angular decorators (`@Component`, `@Directive`, `@Pipe`). It is the default in Angular v20+.
- **Do NOT** set `changeDetection: ChangeDetectionStrategy.OnPush` explicitly. `OnPush` is the default in Angular v22+.
- Use signals for state management.
- Implement lazy loading (`loadComponent` / `loadChildren`) for feature routes.
- **Do NOT** use the `@HostBinding` and `@HostListener` decorators. Put host bindings inside the `host` object of the `@Component` or `@Directive` decorator instead.
- Use `NgOptimizedImage` for all static images (does not work for inline base64 images).

## Accessibility Requirements

- Must pass all AXE checks.
- Must follow all WCAG AA minimums, including focus management, color contrast, semantic HTML landmarks, and ARIA attributes.

## Components

- Keep components small and focused on a single responsibility.
- Use `input()` and `output()` functions instead of `@Input()` and `@Output()` decorators.
- Use `model()` for two-way bound properties with `[(prop)]` syntax instead of pairing `input()` with `output()`.
- Use `computed()` for derived state.
- Use `linkedSignal()` for state derived from multiple reactive sources that must stay synchronized.
- Prefer inline templates for small components; when using external templates/styles, use paths relative to the component TS file.
- Prefer Signal Forms (`@angular/forms/signals`) for new forms. They are stable in Angular v22+ and provide signal-based state, type-safe field access, and schema-based validation.
- When not using Signal Forms, prefer Reactive Forms instead of Template-driven forms.
- **Do NOT** use `ngClass`; use `[class]` or `[class.name]` bindings instead.
- **Do NOT** use `ngStyle`; use `[style]` or `[style.prop]` bindings instead.
- **Do NOT** import `CommonModule`; import only the specific directives and pipes the template uses (such as `AsyncPipe` or `DatePipe`).

## State Management

- Use `signal()` for local component state.
- Use `computed()` for derived state.
- Keep state transformations pure and predictable.
- **Do NOT** use `mutate` on signals; use `update` or `set` instead.

## Templates

- Keep templates simple and avoid complex inline logic.
- Use native control flow (`@if`, `@for`, `@switch`, `@let`, `@defer`) instead of `*ngIf`, `*ngFor`, `*ngSwitch`.
- Always provide a unique `track` expression in `@for` blocks (e.g., `@for (item of items(); track item.id)`).
- Use `AsyncPipe` or `toSignal()` (`@angular/core/rxjs-interop`) to handle observables cleanly.
- Do not assume browser globals like `new Date()` or `window` are available directly inside template expressions.

## Services & Dependency Injection

- Design services around a single responsibility.
- Prefer the `@Service` decorator over `@Injectable({ providedIn: 'root' })` for new singleton services in Angular v22+.
- Always use the `inject()` function instead of constructor injection.
