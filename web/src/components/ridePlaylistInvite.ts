/**
 * Channel-agnostic invite-to-connect for the Playlist tab.
 *
 * Local sending/sent chrome lives in `RidePlaylistTab`. This module is the
 * single call site for delivery. Today it always soft-succeeds with **no
 * network**. Real push / SMS lands with
 * `docs/specs/planned/push-notifications.md` — replace the body of
 * {@link deliverPlaylistConnectInvite} (keep the request shape).
 */

import type { RideNotifyChannel, RideNotifyResult } from "@/components/rideNotify"

export type PlaylistInviteRequest = {
  channel: RideNotifyChannel
  /** Display label for who would be notified (e.g. family name). */
  to: string
  /** Kid display name on the tile. */
  kidName: string
}

/**
 * Attempt invite-to-connect delivery. Never throws; never hits the network in
 * this PR. Soft-fail by returning `{ ok: false }` when a future channel errors.
 */
export async function deliverPlaylistConnectInvite(
  _request: PlaylistInviteRequest,
): Promise<RideNotifyResult> {
  // push-notifications: send via registered device tokens / SMS here.
  return { ok: true }
}
