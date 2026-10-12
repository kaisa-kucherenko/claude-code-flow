import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Usage } from '../types'

// The game's HUD: toxicity climbs as the session drinks context, stamina
// drains fast and comes back (the 5-hour window), vitality drains slowly (the
// 7-day window). Running agents are the engine's own panel below the prompt
// (subagentStatusLine), not this band.
const usage = atom({ plugin: 'witcher', key: 'usage' } as const, {
  ctx: null,
  fiveHour: null,
  fiveHourReset: null,
  sevenDay: null,
} as Usage)

// A session is meant to be handed off to a fresh one at 30 % of context, so the
// toxicity bar marks that line the way the game marks the overdose threshold.
const TOXICITY_THRESHOLD = 30
// Past this the handoff is overdue, and the bar turns red.
const TOXICITY_OVERDOSE = 40

function bar(percent: number, width: number): string {
  const filled = Math.round((Math.min(100, Math.max(0, percent)) / 100) * width)
  return '▰'.repeat(filled) + '▱'.repeat(width - filled)
}

// Toxicity carries the threshold mark inside the bar, like the game's line.
function toxicityBar(percent: number, width: number): string {
  const cells = bar(percent, width).split('')
  const mark = Math.round((TOXICITY_THRESHOLD / 100) * width)
  if (mark < width) cells[mark] = cells[mark] === '▰' ? '▮' : '│'
  return cells.join('')
}

function hhmm(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

type Dollar = EngineInterface

async function refreshUsage($: Dollar) {
  const u = await $.session.usage()
  const limit = (kind: string) => u.rateLimits.find(r => r.kind === kind)
  const next: Usage = {
    ctx: u.context.percent ?? (u.context.tokens ? Math.round((u.context.tokens / u.context.window) * 100) : null),
    fiveHour: limit('five_hour')?.percentUsed ?? null,
    fiveHourReset: limit('five_hour')?.resetsAt ?? null,
    sevenDay: limit('seven_day')?.percentUsed ?? null,
  }
  await update($, usage, () => next)
}

// Several persona plugins can sit side by side; personas/active names the one
// on duty and the others keep quiet. Undefined when the marker can't be read:
// at session start that means nobody has chosen yet, so a lone plugin works
// straight after install; mid-session it is a switch in progress.
async function isOnDuty($: Dollar): Promise<boolean | undefined> {
  try {
    const dir = (await $.env.get('CLAUDE_CONFIG_DIR')) ?? `${await $.env.get('HOME')}/.claude`
    const active = String(await $.fs.read(`${dir}/personas/active`)).trim()
    return active === 'witcher'
  } catch {
    return undefined
  }
}

// Unknown until first asked: a default either way would flash the wrong band.
let onDuty: boolean | undefined
let stopWatching: (() => void) | undefined

// The switch can come from another plugin's command or another session, and
// neither can reach this module, so it polls the marker and redraws on change.
const DUTY_POLL_MS = 3000

async function recheckDuty($: Dollar) {
  const now = await isOnDuty($)
  if (now === undefined || now === onDuty) return
  onDuty = now
  $.ui.invalidate('ui.render')
}

// The engine samples the spinner word from the verbs it read at session start,
// so a persona put on mid-session would keep the previous one's words; on duty,
// this plugin swaps in its own.
let verbs: readonly string[] = []

async function loadVerbs($: Dollar) {
  try {
    verbs = JSON.parse(String(await $.fs.read(`${$.plugin.root}/persona/verbs.json`))).verbs ?? []
  } catch {
    verbs = []
  }
}

// The engine samples its word once per turn, so the verb starts from it (or
// from a hash of a word that isn't this persona's) and moves `step` verbs on,
// one step per `spinnerSeconds`: a long turn doesn't sit on one line, and
// redraws within a step keep the same verb.
export function ownVerb(sampled: string, own: readonly string[], step = 0): string {
  if (own.length === 0) return sampled
  let start = own.indexOf(sampled)
  if (start < 0) {
    let h = 0
    for (const ch of sampled) h = (h * 31 + ch.charCodeAt(0)) >>> 0
    start = h % own.length
  }
  return own[(start + step) % own.length]!
}

// When each sampled word was first drawn: the main spinner and each agent's
// carry their own word, so each counts its steps from its own start.
const firstSeen = new Map<string, number>()

async function stepsSince($: Dollar, word: string, stepMs: number): Promise<number> {
  const now = await $.clock.now()
  if (firstSeen.size > 64) firstSeen.clear()
  const start = firstSeen.get(word) ?? now
  firstSeen.set(word, start)
  return Math.floor((now - start) / stepMs)
}

// Redraws often enough that a step lands within a few seconds of falling due
const SPINNER_TICK_MS = 5000

// Wearing the persona rewrites the person's own settings, so it is a command
// they run, never a side effect of installing the plugin. wear.sh owns the
// list of themes and says what changed and where it shows up.
async function wear($: Dollar, args: string): Promise<string> {
  const arg = args.trim()
  const argv = ['bash', `${$.plugin.root}/scripts/wear.sh`, ...(arg === 'off' ? ['off'] : ['on', ...(arg ? [arg] : [])])]
  const r = await $.process.run(argv).catch((err: unknown) => ({ exitCode: -1, stdout: '', stderr: String(err) }))
  if (r.exitCode !== 0) return `Failed: ${r.stderr.trim()}`
  return r.stdout.trim()
}

export const register: Register = (on, options) => {
  const stepMs = Math.max(10, Number(options.spinnerSeconds) || 30) * 1000

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'witcher',
      description: 'Put on The Witcher 3 persona: theme, spinner, status line, terminal profile',
      argumentHint: '[corvo-bianco | kaer-morhen | off]',
    })
    onDuty = (await isOnDuty($)) ?? true
    // Each session start re-arms the poll with its own `$`
    stopWatching?.()
    const duty = $.clock.every(DUTY_POLL_MS, () => void recheckDuty($))
    const tick = $.clock.every(SPINNER_TICK_MS, () => {
      if (onDuty) $.ui.invalidate('ui.render')
    })
    stopWatching = () => {
      duty.cancel()
      tick.cancel()
    }
    await loadVerbs($)
    await refreshUsage($)
    return next(e)
  })

  on('command.run', { command: 'witcher' }, async ($, e) => {
    const text = await wear($, e.args)
    await recheckDuty($)
    return { text }
  })

  on('session.measure', async ($, e, next) => {
    await refreshUsage($)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    await refreshUsage($)
    return next(e)
  })

  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    // A message (compacting, a hook running) says what is happening, and on the
    // desktop the word names the step being done; both stay as they are
    if (!onDuty || e.surface !== 'terminal' || e.props.message !== null) return next(e)
    const step = await stepsSince($, e.props.word, stepMs)
    return next({ ...e, props: { ...e.props, word: ownVerb(e.props.word, verbs, step) } })
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    onDuty ??= (await isOnDuty($)) ?? true
    if (e.props.hasSurvey || !onDuty) return next(e)

    const u = await read($, usage)
    const { Box, Text } = $.ui.resolve(e)

    const wide = e.props.bodyColumns >= 110
    const w = wide ? 10 : 6
    const label = (long: string, short: string) => (wide ? long : short)

    const tox = u.ctx ?? 0
    const toxColor = tox >= TOXICITY_OVERDOSE ? 'error' : tox >= TOXICITY_THRESHOLD ? 'warning' : 'success'
    // The bar reads like the game (full = good, it drains); the number reads
    // like /usage (how much is spent), tagged ctx / 5h / 7d so it cannot be
    // mistaken for what is left.
    const leftColor = (used: number) => (used >= 90 ? 'error' : used >= 70 ? 'warning' : 'success')

    return (
      <Box flexDirection="column" marginTop={1}>
        <Box flexDirection="row">
          <Text>
            <Text color={toxColor}>☠ </Text>
            <Text dimColor>{label('Токсичність ', '')}</Text>
            <Text color={toxColor}>{toxicityBar(tox, w)}</Text>
            <Text dimColor> ctx </Text>
            <Text color={toxColor}>{tox}%</Text>
            <Text dimColor>   </Text>
          </Text>
          {u.fiveHour !== null ? (
            <Text>
              <Text color="warning">⚡ </Text>
              <Text dimColor>{label('Витривалість ', '')}</Text>
              <Text color={leftColor(u.fiveHour)}>{bar(100 - u.fiveHour, w)}</Text>
              <Text dimColor> 5h </Text>
              <Text color={leftColor(u.fiveHour)}>{u.fiveHour}%</Text>
              <Text dimColor>{u.fiveHourReset ? ` ↻ ${hhmm(u.fiveHourReset)}` : ''}</Text>
              <Text dimColor>   </Text>
            </Text>
          ) : null}
          {u.sevenDay !== null ? (
            <Text>
              <Text color="error">♥ </Text>
              <Text dimColor>{label('Вітальність ', '')}</Text>
              <Text color={leftColor(u.sevenDay)}>{bar(100 - u.sevenDay, w)}</Text>
              <Text dimColor> 7d </Text>
              <Text color={leftColor(u.sevenDay)}>{u.sevenDay}%</Text>
            </Text>
          ) : null}
        </Box>
      </Box>
    )
  })
}
