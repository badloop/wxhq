/**
 * errorBus — a tiny framework-agnostic pub/sub for surfacing backend/API
 * failures to a global UI overlay.
 *
 * Any module (services, hooks, Leaflet layer callbacks) can call
 * {@link reportError} without importing React. The UI subscribes via
 * {@link subscribeErrors} + {@link getErrors} (designed to plug straight into
 * React's `useSyncExternalStore`).
 *
 * Errors are deduplicated by `source + message`: a repeated failure bumps a
 * `count` and resurfaces the toast instead of stacking duplicates. The list is
 * capped at {@link MAX_ERRORS} most-recent entries.
 */

export type ErrorSeverity = 'error' | 'warning' | 'info';

export interface AppError {
  id: string;
  /** Short origin label, e.g. "IEM", "NWS API", "Radar". */
  source: string;
  /** Human-readable summary shown in the toast. */
  message: string;
  /** Optional extra context (URL, stack message) shown in the expandable area. */
  detail?: string;
  severity: ErrorSeverity;
  /** How many times this same source+message has been reported. */
  count: number;
  firstSeen: number;
  lastSeen: number;
}

export interface ReportErrorInput {
  source: string;
  message: string;
  detail?: string;
  severity?: ErrorSeverity;
}

/** Maximum number of distinct errors kept in memory (newest first). */
const MAX_ERRORS = 50;

// Immutable snapshot: every mutation replaces the array reference so that
// `useSyncExternalStore` can cheaply detect change by identity.
let errors: AppError[] = [];
let seq = 0;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function keyOf(source: string, message: string): string {
  return `${source}\u0000${message}`;
}

/**
 * Report a backend/API failure. Deduplicates by `source + message`; returns the
 * resulting (new or updated) error record. Always echoes to the console so the
 * failure is visible in devtools regardless of the UI state.
 */
export function reportError(input: ReportErrorInput): AppError {
  const severity: ErrorSeverity = input.severity ?? 'error';
  const now = Date.now();
  const key = keyOf(input.source, input.message);

  const logLine = `[wxhq:${input.source}] ${input.message}${input.detail ? ` — ${input.detail}` : ''}`;
  if (severity === 'error') console.error(logLine);
  else if (severity === 'warning') console.warn(logLine);
  else console.info(logLine);

  const existing = errors.find((e) => keyOf(e.source, e.message) === key);
  if (existing) {
    const updated: AppError = {
      ...existing,
      count: existing.count + 1,
      lastSeen: now,
      detail: input.detail ?? existing.detail,
      severity,
    };
    // Move the resurfacing error to the front so the user notices it again.
    errors = [updated, ...errors.filter((e) => e.id !== existing.id)];
    emit();
    return updated;
  }

  const created: AppError = {
    id: `err-${++seq}-${now}`,
    source: input.source,
    message: input.message,
    detail: input.detail,
    severity,
    count: 1,
    firstSeen: now,
    lastSeen: now,
  };
  errors = [created, ...errors].slice(0, MAX_ERRORS);
  emit();
  return created;
}

/** Remove a single error by id. */
export function dismissError(id: string): void {
  const next = errors.filter((e) => e.id !== id);
  if (next.length !== errors.length) {
    errors = next;
    emit();
  }
}

/** Remove all errors. */
export function clearErrors(): void {
  if (errors.length > 0) {
    errors = [];
    emit();
  }
}

/** Current immutable snapshot of all errors (newest first). */
export function getErrors(): AppError[] {
  return errors;
}

/**
 * Subscribe to error-list changes. Returns an unsubscribe function.
 * Pairs with {@link getErrors} for `useSyncExternalStore`.
 */
export function subscribeErrors(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
