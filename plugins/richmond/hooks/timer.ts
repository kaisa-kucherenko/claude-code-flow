// The /timer break reminder as the HUD sees it. scripts/timer.sh owns the timer
// itself (systemd counts the time and rings), so every session, whichever
// plugin set it, reads the same files under persona-timer/. The engine does not
// let `$` cross an import, so this file holds the state and the rules and each
// register.tsx does the reading and writing.

export type TimerView = { kind: 'none' } | { kind: 'counting'; leftMs: number } | { kind: 'rang' }

let timer: { id: string; endsAt: number } | null = null
let rang: { id: string } | null = null
let seen: string | null = null

function parse(text: string | null): Record<string, unknown> | null {
  if (!text) return null
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    return null
  }
}

// Takes what the three state files hold now (null when missing) and says
// whether what the band shows has changed
export function applyTimerFiles(timerText: string | null, rangText: string | null, seenText: string | null): boolean {
  const t = parse(timerText)
  const r = parse(rangText)
  const nextTimer = t && typeof t.endsAt === 'number' ? { id: String(t.id), endsAt: t.endsAt } : null
  const nextRang = r ? { id: String(r.id) } : null
  const nextSeen = seenText?.trim() || null
  const changed = nextTimer?.id !== timer?.id || nextRang?.id !== rang?.id || nextSeen !== seen
  timer = nextTimer
  rang = nextRang
  seen = nextSeen
  return changed
}

// The ring clears timer.json within seconds of the end; one still there long
// after is a timer lost to a reboot or a killed session, not one about to ring
const STALE_AFTER_MS = 60_000

export function isCounting(now: number): boolean {
  return timer !== null && now - timer.endsAt < STALE_AFTER_MS
}

export function timerViewAt(now: number): TimerView {
  if (timer && now - timer.endsAt < STALE_AFTER_MS) return { kind: 'counting', leftMs: Math.max(0, timer.endsAt - now) }
  if (rang && rang.id !== seen) return { kind: 'rang' }
  return { kind: 'none' }
}

// A prompt means the person is back: the reminder has done its job, in every
// session at once. Returns the id to record as seen, or null when nothing rang.
export function takeSeen(): string | null {
  if (!rang || rang.id === seen) return null
  seen = rang.id
  return seen
}

export function formatLeft(ms: number): string {
  const total = Math.ceil(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const ss = String(total % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

export function timerArgs(args: string): string[] {
  const arg = args.trim()
  return arg === '' ? ['status'] : arg.toLowerCase() === 'off' ? ['off'] : ['set', arg]
}

// A /clear or a resume goes on in the same process, so only a real exit counts
export function isExit(reason: string): boolean {
  return reason === 'prompt_input_exit' || reason === 'logout' || reason === 'other'
}

export const TIMER_COMMAND = {
  name: 'timer',
  description: 'Remind me to take a break: /timer 45m or 1h; no argument shows the timer, off cancels it',
  argumentHint: '[45m | 1h | off]',
}
