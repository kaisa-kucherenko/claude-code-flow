import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Usage } from '../types'

// Nelson Road's HUD: the session is one match whose clock is the context fill,
// the 5-hour window is five balls (one per hour) and the 7-day window is the
// BELIEVE sign over the locker-room door (one letter per day). Both resources
// read as what is left, so a full row is good news; the match clock reads as
// time spent, so a late minute is the warning.
const usage = atom({ plugin: 'richmond', key: 'usage' } as const, {
  ctx: null,
  fiveHour: null,
  fiveHourReset: null,
  sevenDay: null,
  sevenDayReset: null,
} as Usage)

// The match follows a session that is handed off to a fresh one between 30 and
// 40 % of context: regular time ends at 30, extra time at 40, then penalties.
const HALF_TIME = 15
const FULL_TIME = 30
const EXTRA_TIME = 40

// The sign's canonical look: yellow capitals on a royal-blue board.
const SIGN_BLUE = '#2F4BB0'
const SIGN_YELLOW = '#FFD93D'
const SIGN_FADED = '#7F8FD6'
const SIGN_TORN = '#8a2b2b'

type Phase = { label: string; kicks?: string; tone: 'text' | 'warning' | 'error' }

// Context percent → match phase. One number on the band is enough: the percent
// is what the handoff decision is made on, the phase says how late it is.
export function phase(ctx: number): Phase {
  if (ctx <= 0) return { label: 'Стартовий свисток', tone: 'text' }
  if (ctx < HALF_TIME) return { label: '1-й тайм', tone: 'text' }
  if (ctx < FULL_TIME) return { label: '2-й тайм', tone: 'text' }
  if (ctx < EXTRA_TIME) return { label: 'Додатковий час', tone: 'warning' }
  // One kick every two percent; after the fifth the shoot-out just goes on,
  // kick by kick, the way a real one does.
  const kicks = Math.floor((ctx - EXTRA_TIME) / 2)
  if (kicks <= 5) return { label: 'Серія пенальті', kicks: '●'.repeat(kicks) + '◯'.repeat(5 - kicks), tone: 'error' }
  return { label: 'Серія пенальті', kicks: `●●●●● +${kicks - 5}`, tone: 'error' }
}

// Whole units left out of `total`, so the last ball / letter only goes once
// the window is actually spent.
export function unitsLeft(percentUsed: number, total: number): number {
  const left = Math.min(100, Math.max(0, 100 - percentUsed))
  return Math.ceil((left / 100) * total)
}

const DAYS = ['нд', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']

function hhmm(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function dayHhmm(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${DAYS[d.getDay()]} ${hhmm(iso)}`
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
    sevenDayReset: limit('seven_day')?.resetsAt ?? null,
  }
  await update($, usage, () => next)
}

// Wearing the persona rewrites the person's own settings, so it is a command
// they run, never a side effect of installing the plugin. wear.sh owns the
// list of themes and says what it changed.
async function wear($: Dollar, args: string): Promise<string> {
  const arg = args.trim()
  const argv = ['bash', `${$.plugin.root}/scripts/wear.sh`, ...(arg === 'off' ? ['off'] : ['on', ...(arg ? [arg] : [])])]
  const r = await $.process.run(argv).catch((err: unknown) => ({ exitCode: -1, stdout: '', stderr: String(err) }))
  if (r.exitCode !== 0) return `Не вийшло: ${r.stderr.trim()}`
  return `${r.stdout.trim()}\nПерезапусти Claude Code (/exit, потім claude -c), щоб зміни підхопились.`
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'richmond',
      description: 'Вдягнути персону Річмонд: тема, спінер, statusline, профіль терміналу',
      argumentHint: '[nelson-road | diamond-dogs | off]',
    })
    await refreshUsage($)
    return next(e)
  })

  on('command.run', { command: 'richmond' }, async ($, e) => ({ text: await wear($, e.args) }))

  on('session.measure', async ($, e, next) => {
    await refreshUsage($)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    await refreshUsage($)
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)

    const u = await read($, usage)
    const { Box, Text } = $.ui.resolve(e)

    const wide = e.props.bodyColumns >= 110
    const label = (long: string, short: string) => (wide ? long : short)
    const resourceColor = (used: number) => (used >= 90 ? 'error' : used >= 70 ? 'warning' : 'success')

    const ctx = u.ctx ?? 0
    const match = phase(ctx)

    const balls = u.fiveHour !== null ? unitsLeft(u.fiveHour, 5) : 0
    const letters = u.sevenDay !== null ? unitsLeft(u.sevenDay, 7) : 7
    const torn = u.sevenDay !== null && letters === 0
    const sign = 'BELIEVE'.split('')

    return (
      <Box flexDirection="column" marginTop={1}>
        <Box flexDirection="row">
          <Text>
            <Text color={match.tone}>⏱ </Text>
            <Text color={match.tone} bold={match.tone === 'error'}>{match.label}</Text>
            {match.kicks ? <Text color={match.tone}> {match.kicks}</Text> : null}
            <Text dimColor>  ctx </Text>
            <Text color={match.tone}>{ctx}%</Text>
            <Text dimColor>  ┃  </Text>
          </Text>
          {u.fiveHour !== null ? (
            <Text>
              <Text color={resourceColor(u.fiveHour)}>{'⚽'.repeat(balls)}</Text>
              <Text dimColor>{'◯ '.repeat(5 - balls)}</Text>
              <Text dimColor> {label('5h ', '')}</Text>
              <Text color={resourceColor(u.fiveHour)}>{u.fiveHour}%</Text>
              <Text dimColor>{u.fiveHourReset ? ` ↻ ${hhmm(u.fiveHourReset)}` : ''}</Text>
              <Text dimColor>  ┃  </Text>
            </Text>
          ) : null}
          {u.sevenDay !== null ? (
            <Text>
              {torn ? <Text color="error">✂ </Text> : null}
              <Text backgroundColor={torn ? SIGN_TORN : SIGN_BLUE}> </Text>
              {sign.map((ch, i) => (
                <Text
                  key={String(i)}
                  backgroundColor={torn ? SIGN_TORN : SIGN_BLUE}
                  color={i < letters ? SIGN_YELLOW : SIGN_FADED}
                  bold={i < letters}
                >
                  {ch}
                </Text>
              ))}
              <Text backgroundColor={torn ? SIGN_TORN : SIGN_BLUE}> </Text>
              <Text dimColor> {label('7d ', '')}</Text>
              <Text color={resourceColor(u.sevenDay)}>{u.sevenDay}%</Text>
              <Text dimColor>{u.sevenDayReset ? ` ↻ ${dayHhmm(u.sevenDayReset)}` : ''}</Text>
            </Text>
          ) : null}
        </Box>
      </Box>
    )
  })
}
