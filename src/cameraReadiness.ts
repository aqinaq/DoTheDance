export type CameraReadiness = { since: number | null; last: number; ready: boolean }
export const emptyReadiness = (): CameraReadiness => ({ since: null, last: 0, ready: false })

// Require a continuous view, rather than enabling practice after one lucky frame.
export function observeCamera(previous: CameraReadiness, now: number, issue: string | null): CameraReadiness {
  if (issue) return { since: null, last: now, ready: false }
  const since = previous.since === null || now - previous.last > 500 ? now : previous.since
  return { since, last: now, ready: now - since >= 800 }
}
