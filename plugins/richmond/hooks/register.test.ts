import { expect, mock, test } from 'claude-code/testing'

const props = { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 160, scroll: { offset: 0, bodyRows: 5 }, view: {} }

type T = { props: { bold?: boolean; color?: string } }
async function mount($: any, on: any, usage: object, active?: string, marker = { active }) {
  // Stands for the engine's own band, drawn when the plugin passes
  on('ui.render', { component: 'AbovePrompt' }, ($: any, e: any) => $.ui.resolve(e).Text({ children: 'engine band' }))
  on('env.get', (_$: any, e: any) => ({ value: e.name === 'HOME' ? '/home/fan' : undefined }))
  on('fs.read', (_$: any, e: any) => {
    if (marker.active === undefined || e.path !== '/home/fan/.claude/personas/active') throw new Error('ENOENT')
    return { value: `${marker.active}\n` }
  })
  on('session.usage', () => ({ value: { startedAt: 0, rateLimits: [], ...usage } }))
  on('command.register', (_$: any, e: any) => ({ value: { command: e.name } }))
  on('session.start', (_$: any, e: any) => ({ cwd: e.cwd }))
  on('turn.complete', () => ({ text: '' }))
  mock.clock(on)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  return $.ui.mount({ plugin: 'richmond', surface: 'terminal', component: 'AbovePrompt', props })
}

const FULL = { context: { window: 200000, percent: 23 }, rateLimits: [{ kind: 'seven_day', percentUsed: 43 }] }

test('the band shows when this persona is on duty', async ($, on) => {
  const band = await mount($, on, FULL, 'richmond')
  expect(await band.find({ text: /2-й тайм/ })).toBeDefined()
})

test('the band stays off while another persona is on duty', async ($, on) => {
  const band = await mount($, on, FULL, 'witcher')
  expect(await band.find({ text: /2-й тайм/ })).toBeUndefined()
  expect(await band.find({ text: /engine band/ })).toBeDefined()
})

test('a switch made in another session hides the band once the turn completes', async ($, on) => {
  const marker = { active: 'richmond' as string | undefined }
  const band = await mount($, on, FULL, undefined, marker)
  expect(await band.find({ text: /2-й тайм/ })).toBeDefined()
  marker.active = 'witcher'
  await ($ as any).turn.complete({ reason: 'answer', answer: 'ok' })
  expect(await band.find({ text: /2-й тайм/ })).toBeUndefined()
})

test('the band stays off after the persona was taken off', async ($, on) => {
  const band = await mount($, on, FULL, 'none')
  expect(await band.find({ text: /2-й тайм/ })).toBeUndefined()
  expect(await band.find({ text: /engine band/ })).toBeDefined()
})

test('the band draws the match clock, the balls and the sign from the session usage', async ($, on) => {
  const band = await mount($, on, {
    context: { window: 200000, tokens: 46000, percent: 23 },
    rateLimits: [
      { kind: 'five_hour', percentUsed: 24, resetsAt: '2026-10-12T11:20:00Z' },
      { kind: 'seven_day', percentUsed: 43, resetsAt: '2026-10-13T06:00:00Z' },
    ],
  })
  expect((await band.drawn() as { type: string }).type).toBe('Box')
  // 23 % sits in the second half
  expect(await band.find({ text: /2-й тайм/ })).toBeDefined()
  expect(await band.find({ text: /23%/ })).toBeDefined()
  // 76 % of five hours left → four balls, one empty slot
  expect(await band.find({ text: /^⚽⚽⚽⚽$/ })).toBeDefined()
  expect(await band.find({ text: /^◯ $/ })).toBeDefined()
  expect(await band.find({ text: /24%/ })).toBeDefined()
  // 57 % of seven days left → four lit letters, three faded
  const lit = await band.findAll({ type: 'Text', text: /^[BELIEV]$/ })
  expect(lit.filter((t: T) => t.props.bold).length).toBe(4)
  expect(lit.filter((t: T) => !t.props.bold).length).toBe(3)
  expect(await band.find({ text: /43%/ })).toBeDefined()
})

test('extra time turns the clock to the warning tone at 30 %', async ($, on) => {
  const band = await mount($, on, { context: { window: 200000, percent: 34 } })
  const label = await band.findAll({ type: 'Text', text: /Додатковий час/ })
  expect(label.some((t: T) => t.props.color === 'warning')).toBe(true)
})

test('past 40 % the match goes to penalties, one kick per two percent', async ($, on) => {
  const band = await mount($, on, { context: { window: 200000, percent: 45 } })
  const kicks = await band.findAll({ type: 'Text', text: /^ ●●◯◯◯$/ })
  expect(kicks.some((t: T) => t.props.color === 'error')).toBe(true)
  expect(await band.find({ text: /Серія пенальті/ })).toBeDefined()
})

test('a spent week tears the sign', async ($, on) => {
  const band = await mount($, on, {
    context: { window: 200000, percent: 5 },
    rateLimits: [{ kind: 'seven_day', percentUsed: 100 }],
  })
  expect(await band.find({ text: /✂/ })).toBeDefined()
  const letters = await band.findAll({ type: 'Text', text: /^[BELIEV]$/ })
  expect(letters.every((t: T) => !t.props.bold)).toBe(true)
})

// The test's `$` stands for the engine, so a command runs without a composer origin.
const run = async ($: any, args: string): Promise<string> => (await $.command.run({ command: 'richmond', args })).text ?? ''

function fakeWear(on: any, result = { exitCode: 0, stdout: 'Річмонд на полі: тема nelson-road\n', stderr: '' }) {
  const calls: string[][] = []
  on('process.run', (_$: any, e: any) => {
    calls.push([...e.argv])
    return { value: { ...result, isStdoutTruncated: false, isStderrTruncated: false } }
  })
  return calls
}

test('/richmond runs wear.sh on with the default theme and relays what it changed', async ($, on) => {
  const calls = fakeWear(on)
  const text = await run($, '')
  expect(calls.length).toBe(1)
  expect(calls[0]?.slice(1)).toEqual([expect.stringMatching(/\/scripts\/wear\.sh$/), 'on'])
  expect(text).toMatch(/Річмонд на полі: тема nelson-road/)
  expect(text).toMatch(/Перезапусти/)
})

test('/richmond <theme> passes the theme through, trimmed', async ($, on) => {
  const calls = fakeWear(on)
  await run($, ' diamond-dogs ')
  expect(calls[0]?.slice(2)).toEqual(['on', 'diamond-dogs'])
})

test('/richmond off takes the persona off', async ($, on) => {
  const calls = fakeWear(on)
  await run($, 'off')
  expect(calls[0]?.slice(2)).toEqual(['off'])
})

test('a failed wear.sh shows its stderr instead of a restart hint', async ($, on) => {
  fakeWear(on, { exitCode: 1, stdout: '', stderr: 'нема теми anfield, є: nelson-road, diamond-dogs\n' })
  const text = await run($, 'anfield')
  expect(text).toMatch(/нема теми anfield/)
  expect(text).not.toMatch(/Перезапусти/)
})
