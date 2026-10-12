import { expect, mock, test } from 'claude-code/testing'

const props = { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 160, scroll: { offset: 0, bodyRows: 5 }, view: {} }

type T = { props: { bold?: boolean; color?: string } }
// The mocked clock of the last mount, so a test can move time
let clock: any

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
  clock = mock.clock(on)
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

test('a switch made elsewhere hides the band within a few seconds, no restart', async ($, on) => {
  const marker = { active: 'richmond' as string | undefined }
  const band = await mount($, on, FULL, undefined, marker)
  expect(await band.find({ text: /2-й тайм/ })).toBeDefined()
  marker.active = 'witcher'
  await clock.advance(3000)
  expect(await band.find({ text: /2-й тайм/ })).toBeUndefined()
  expect(await band.find({ text: /engine band/ })).toBeDefined()
})

test('a marker that cannot be read mid-switch does not flash an off-duty band', async ($, on) => {
  const marker = { active: 'witcher' as string | undefined }
  const band = await mount($, on, FULL, undefined, marker)
  expect(await band.find({ text: /2-й тайм/ })).toBeUndefined()
  marker.active = undefined
  await clock.advance(3000)
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

function fakeWear(on: any, result = { exitCode: 0, stdout: 'Річмонд на полі\nNow, in every open session: the HUD, sounds, status line and spinner verbs.\nTheme: pick “Richmond Nelson Road” in /theme for this session; new sessions start with it.\n', stderr: '' }) {
  const calls: string[][] = []
  on('process.run', (_$: any, e: any) => {
    calls.push([...e.argv])
    return { value: { ...result, isStdoutTruncated: false, isStderrTruncated: false } }
  })
  return calls
}

test('/richmond runs wear.sh on with the default theme and relays its report as is', async ($, on) => {
  const calls = fakeWear(on)
  const text = await run($, '')
  expect(calls.length).toBe(1)
  expect(calls[0]?.slice(1)).toEqual([expect.stringMatching(/\/scripts\/wear\.sh$/), 'on'])
  expect(text).toBe('Річмонд на полі\nNow, in every open session: the HUD, sounds, status line and spinner verbs.\nTheme: pick “Richmond Nelson Road” in /theme for this session; new sessions start with it.')
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

test('a failed wear.sh shows its stderr', async ($, on) => {
  fakeWear(on, { exitCode: 1, stdout: '', stderr: 'no theme anfield; available: nelson-road, diamond-dogs\n' })
  const text = await run($, 'anfield')
  expect(text).toMatch(/no theme anfield/)
  expect(text).toMatch(/^Failed: /)
})

const OWN = ['Пече бісквіти для боса', 'Підклеює плакат «BELIEVE»', 'Гарчить замість свистка', 'Обіймає Джеймі']
const SPINNER = (word: string, message: string | null = null) => ({ word, message, suffix: '…', mode: 'responding' as const })

async function mountSpinner($: any, on: any, active: string, word: string, message: string | null = null, opts: { marker?: { active: string }; verbs?: boolean; surface?: string } = {}) {
  const marker = opts.marker ?? { active }
  // Stands for the engine's own spinner line, drawn from whatever props reach it
  on('ui.render', { component: 'Spinner' }, ($: any, e: any) => $.ui.resolve(e).Text({ children: e.props.message ?? e.props.word }))
  on('env.get', (_$: any, e: any) => ({ value: e.name === 'HOME' ? '/home/fan' : undefined }))
  on('fs.read', (_$: any, e: any) => {
    if (e.path === '/home/fan/.claude/personas/active') return { value: `${marker.active}\n` }
    if (e.path.endsWith('/persona/verbs.json') && opts.verbs !== false) return { value: JSON.stringify({ mode: 'replace', verbs: OWN }) }
    throw new Error('ENOENT')
  })
  on('session.usage', () => ({ value: { startedAt: 0, rateLimits: [], context: { window: 200000, percent: 1 } } }))
  on('command.register', (_$: any, e: any) => ({ value: { command: e.name } }))
  on('session.start', (_$: any, e: any) => ({ cwd: e.cwd }))
  clock = mock.clock(on)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  return drawnWord($, word, message, opts.surface)
}

async function drawnWord($: any, word: string, message: string | null = null, surface = 'terminal') {
  const line = await $.ui.mount({ plugin: 'richmond', surface, component: 'Spinner', props: SPINNER(word, message) })
  return (await line.find({ type: 'Text' }))?.text
}

test('on duty, a word left from another persona becomes one of this one\'s verbs', async ($, on) => {
  expect(OWN).toContain(await mountSpinner($, on, 'richmond', 'Медитує'))
})

test('the swapped verb holds for the whole turn', async ($, on) => {
  const first = await mountSpinner($, on, 'richmond', 'Медитує')
  for (let frame = 0; frame < 6; frame++) expect(await drawnWord($, 'Медитує')).toBe(first)
})

test('a word that is already this persona\'s stays as the engine sampled it', async ($, on) => {
  expect(await mountSpinner($, on, 'richmond', OWN[0]!)).toBe(OWN[0])
  for (const verb of OWN.slice(1)) expect(await drawnWord($, verb)).toBe(verb)
})

test('off duty, the spinner word is left alone', async ($, on) => {
  expect(await mountSpinner($, on, 'someone-else', 'Медитує')).toBe('Медитує')
})

test('a state message is left alone', async ($, on) => {
  expect(await mountSpinner($, on, 'richmond', 'Медитує', 'Compacting conversation')).toBe('Compacting conversation')
})

test('on the desktop the word names a step and stays as it is', async ($, on) => {
  expect(await mountSpinner($, on, 'richmond', 'Creating notes.md', null, { surface: 'desktop' })).toBe('Creating notes.md')
})

test('without its verbs file the plugin leaves the engine word', async ($, on) => {
  expect(await mountSpinner($, on, 'richmond', 'Медитує', null, { verbs: false })).toBe('Медитує')
})

test('a switch made elsewhere hands the spinner on screen back within a few seconds', async ($, on) => {
  const marker = { active: 'richmond' }
  await mountSpinner($, on, 'richmond', 'Медитує', null, { marker })
  const line = await $.ui.mount({ plugin: 'richmond', surface: 'terminal', component: 'Spinner', props: SPINNER('Медитує') })
  expect(OWN).toContain((await line.find({ type: 'Text' }))?.text)
  marker.active = 'someone-else'
  await clock.advance(3000)
  expect((await line.find({ type: 'Text' }))?.text).toBe('Медитує')
})

test('a long turn moves to the next verb every 30 seconds', async ($, on) => {
  await mountSpinner($, on, 'richmond', OWN[0]!)
  const line = await $.ui.mount({ plugin: 'richmond', surface: 'terminal', component: 'Spinner', props: SPINNER(OWN[0]!) })
  const word = async () => (await line.find({ type: 'Text' }))?.text
  expect(await word()).toBe(OWN[0])
  await clock.advance(25000)
  expect(await word()).toBe(OWN[0])
  await clock.advance(10000)
  expect(await word()).toBe(OWN[1])
  await clock.advance(30000)
  expect(await word()).toBe(OWN[2])
})

test('spinnerSeconds sets how often the verb moves on', { options: { spinnerSeconds: 60 } }, async ($, on) => {
  await mountSpinner($, on, 'richmond', OWN[0]!)
  const line = await $.ui.mount({ plugin: 'richmond', surface: 'terminal', component: 'Spinner', props: SPINNER(OWN[0]!) })
  await clock.advance(35000)
  expect((await line.find({ type: 'Text' }))?.text).toBe(OWN[0])
  await clock.advance(30000)
  expect((await line.find({ type: 'Text' }))?.text).toBe(OWN[1])
})
