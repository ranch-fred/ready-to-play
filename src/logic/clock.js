// A pausable stopwatch in seconds, shared by the session timer and the 3D animation so they stay in sync.
export function createClock() {
  let start = performance.now()
  let pausedAt = null
  return {
    now: () => ((pausedAt ?? performance.now()) - start) / 1000,
    reset() {
      start = performance.now()
      if (pausedAt !== null) pausedAt = start
    },
    pause() {
      if (pausedAt === null) pausedAt = performance.now()
    },
    resume() {
      if (pausedAt !== null) {
        start += performance.now() - pausedAt
        pausedAt = null
      }
    },
    get paused() {
      return pausedAt !== null
    },
  }
}

export const STILL = { now: () => 0 }
