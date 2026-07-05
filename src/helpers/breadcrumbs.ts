/**
 * Client-side transaction breadcrumbs (FAN-50 / VEL-1a).
 *
 * Consumers (e.g. the ff site) emit lifecycle breadcrumbs through velocity-tools
 * rather than writing to Firebase directly. `writeBreadcrumb` POSTs to the Velocity
 * API, which persists the record into the shared `traces` collection in the Velocity
 * Firebase (minty-cli) at `projects/<projectId>/campaigns/<campaignId>/traces/<correlationId>`,
 * per ADR 0001 / VEL-1c. Client breadcrumbs and engine traces (VEL-1b) share that
 * collection and join by `correlationId`, so the admin portal (VEL-1d) can stitch the
 * full path of a transaction.
 *
 * Emission is strictly best-effort — it must never throw into or delay the
 * transaction flow, and nothing here is ever shown to site users.
 */

export type TxBreadcrumbAction = 'mint' | 'redeem' | 'purchase' | 'sell' | 'list' | 'cancel';

export type TxBreadcrumbPhase =
  | 'attempt-initiated'
  | 'submitted'
  | 'succeeded'
  | 'user-declined'
  | 'engine-unreachable'
  | 'failed';

export interface WriteBreadcrumbInput {
  /** Campaign id the transaction belongs to (resolves the traces subcollection). */
  campaign: string;
  /** Shared with the engine trace (UUID v4). */
  correlationId: string;
  action: TxBreadcrumbAction;
  phase: TxBreadcrumbPhase;
  /** Short, non-PII error summary for the failure phases. */
  detail?: string;
  /** Optional client timestamp; the server also stamps its own. */
  at?: string;
  /** Overrides for API base/key when not using the NEXT_PUBLIC_VELOCITY_* env vars. */
  apiBase?: string;
  apiKey?: string;
}

/**
 * Persist a single breadcrumb via the Velocity API. Fire-and-forget: uses
 * `keepalive` so it flushes across a navigation, and swallows every error.
 */
export function writeBreadcrumb(input: WriteBreadcrumbInput): void {
  try {
    if (typeof fetch !== 'function') return;
    const apiBase = input.apiBase ?? process.env.NEXT_PUBLIC_VELOCITY_API ?? '';
    const apiKey = input.apiKey ?? process.env.NEXT_PUBLIC_VELOCITY_API_KEY ?? '';
    if (!apiBase || !input.campaign || !input.correlationId) return;

    void fetch(`${apiBase}/campaign/${input.campaign}/breadcrumb`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'jetplane-api-key': apiKey,
      },
      body: JSON.stringify({
        correlationId: input.correlationId,
        action: input.action,
        phase: input.phase,
        detail: input.detail,
        at: input.at ?? new Date().toISOString(),
      }),
      keepalive: true,
    }).catch(() => {
      /* best-effort only */
    });
  } catch {
    /* best-effort only */
  }
}
