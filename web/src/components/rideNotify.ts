/**
 * Channel-agnostic ready-by notify for the Route tab.
 *
 * Local sending/sent chrome lives in `RideRouteTab`. This module is the single
 * call site for delivery. Today it always soft-succeeds with **no network**.
 * Real push / SMS lands with `docs/specs/planned/push-notifications.md` —
 * replace the body of {@link deliverRideReadyByNotify} (keep the request shape).
 */

export type RideNotifyChannel = "push" | "sms"

export type RideNotifyRequest = {
  channel: RideNotifyChannel
  /** Display label for who would be notified (e.g. family name). */
  to: string
  stopName: string
  /** Ready-by wall-clock label shown in UI (e.g. "3:40 PM"). */
  readyByLabel: string
}

export type RideNotifyResult =
  | { ok: true }
  | { ok: false; reason: string }

/**
 * Attempt ready-by delivery. Never throws; never hits the network in this PR.
 * Soft-fail by returning `{ ok: false }` when a future channel errors.
 */
export async function deliverRideReadyByNotify(
  _request: RideNotifyRequest,
): Promise<RideNotifyResult> {
  // push-notifications: send via registered device tokens / SMS here.
  return { ok: true }
}
