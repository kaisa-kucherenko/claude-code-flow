import { expect, mock, test } from 'claude-code/testing'

test('the band draws vitality, stamina and toxicity from the session usage', async ($, on) => {
  on('session.usage', () => ({ value: {
    startedAt: 0,
    context: { window: 200000, tokens: 24000, percent: 12 },
    rateLimits: [
      { kind: 'five_hour', percentUsed: 24, resetsAt: '2026-10-09T11:20:00Z' },
      { kind: 'seven_day', percentUsed: 43 },
    ],
  } }))

  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  mock.clock(on)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })

  const band = await $.ui.mount({
    plugin: 'witcher',
    surface: 'terminal',
    component: 'AbovePrompt',
    props: {
      hasSurvey: false,
      isWorking: false,
      maxRows: 6,
      bodyColumns: 160,
      scroll: { offset: 0, bodyRows: 5 },
      view: {},
    },
  })

  const text = (await band.drawn()) as { type: string }
  expect(text.type).toBe('Box')
  expect(await band.find({ text: /Вітальність/ })).toBeDefined()
  expect(await band.find({ text: /43%/ })).toBeDefined()
  expect(await band.find({ text: /Витривалість/ })).toBeDefined()
  expect(await band.find({ text: /24%/ })).toBeDefined()
  expect(await band.find({ text: /Токсичність/ })).toBeDefined()
  expect(await band.find({ text: /12%/ })).toBeDefined()
})

test('toxicity past the handoff line turns the bar', async ($, on) => {
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000, percent: 34 }, rateLimits: [] } }))

  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  mock.clock(on)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })

  const band = await $.ui.mount({
    plugin: 'witcher',
    surface: 'terminal',
    component: 'AbovePrompt',
    props: {
      hasSurvey: false,
      isWorking: false,
      maxRows: 6,
      bodyColumns: 160,
      scroll: { offset: 0, bodyRows: 5 },
      view: {},
    },
  })

  const toxTexts = await band.findAll({ type: 'Text', text: /34%/ })
  expect(toxTexts.some(t => t.props.color === 'warning')).toBe(true)
})

test('the bar drains like the game while the number counts what is spent', async ($, on) => {
  on('session.usage', () => ({ value: {
    startedAt: 0,
    context: { window: 200000, percent: 5 },
    rateLimits: [{ kind: 'five_hour', percentUsed: 80, resetsAt: '2026-10-09T11:20:00Z' }],
  } }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  mock.clock(on)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  const band = await $.ui.mount({
    plugin: 'witcher', surface: 'terminal', component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 160, scroll: { offset: 0, bodyRows: 5 }, view: {} },
  })
  // 80 % spent: two of ten cells remain, and the number still says 80
  expect(await band.find({ text: /^▰▰▱▱▱▱▱▱▱▱$/ })).toBeDefined()
  const texts = await band.findAll({ type: 'Text', text: /80%/ })
  expect(texts.some(t => t.props.color === 'warning')).toBe(true)
})

// The test's `$` stands for the engine, so a command runs without a composer origin.
const run = async ($: any, args: string): Promise<string> => (await $.command.run({ command: 'witcher', args })).text ?? ''

function fakeWear(on: any, result = { exitCode: 0, stdout: 'Відьмак на шляху\nNow, in every open session: the HUD, sounds, status line and spinner verbs.\nTheme: pick “Witcher Corvo Bianco” in /theme for this session; new sessions start with it.\n', stderr: '' }) {
  const calls: string[][] = []
  on('process.run', (_$: any, e: any) => {
    calls.push([...e.argv])
    return { value: { ...result, isStdoutTruncated: false, isStderrTruncated: false } }
  })
  return calls
}

test('/witcher runs wear.sh on with the default theme and relays its report as is', async ($, on) => {
  const calls = fakeWear(on)
  const text = await run($, '')
  expect(calls.length).toBe(1)
  expect(calls[0]?.slice(1)).toEqual([expect.stringMatching(/\/scripts\/wear\.sh$/), 'on'])
  expect(text).toBe('Відьмак на шляху\nNow, in every open session: the HUD, sounds, status line and spinner verbs.\nTheme: pick “Witcher Corvo Bianco” in /theme for this session; new sessions start with it.')
})

test('/witcher <theme> passes the theme through, trimmed', async ($, on) => {
  const calls = fakeWear(on)
  await run($, ' kaer-morhen ')
  expect(calls[0]?.slice(2)).toEqual(['on', 'kaer-morhen'])
})

test('/witcher off takes the persona off', async ($, on) => {
  const calls = fakeWear(on)
  await run($, 'off')
  expect(calls[0]?.slice(2)).toEqual(['off'])
})

test('a failed wear.sh shows its stderr', async ($, on) => {
  fakeWear(on, { exitCode: 1, stdout: '', stderr: 'no theme novigrad; available: corvo-bianco, kaer-morhen\n' })
  const text = await run($, 'novigrad')
  expect(text).toMatch(/no theme novigrad/)
  expect(text).toMatch(/^Failed: /)
})

// The mocked clock of the last mount, so a test can move time
let clock: any

async function mountOnDuty($: any, on: any, active: string, marker: { active: string | undefined } = { active }) {
  // Stands for the engine's own band, drawn when the plugin passes
  on('ui.render', { component: 'AbovePrompt' }, ($: any, e: any) => $.ui.resolve(e).Text({ children: 'engine band' }))
  on('env.get', (_$: any, e: any) => ({ value: e.name === 'HOME' ? '/home/fan' : undefined }))
  on('fs.read', (_$: any, e: any) => {
    if (marker.active === undefined || e.path !== '/home/fan/.claude/personas/active') throw new Error('ENOENT')
    return { value: `${marker.active}\n` }
  })
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000, percent: 12 }, rateLimits: [] } }))
  on('command.register', (_$: any, e: any) => ({ value: { command: e.name } }))
  on('session.start', (_$: any, e: any) => ({ cwd: e.cwd }))
  clock = mock.clock(on)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  return $.ui.mount({
    plugin: 'witcher', surface: 'terminal', component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 160, scroll: { offset: 0, bodyRows: 5 }, view: {} },
  })
}

test('the band shows when this persona is on duty', async ($, on) => {
  const band = await mountOnDuty($, on, 'witcher')
  expect(await band.find({ text: /Токсичність/ })).toBeDefined()
})

test('the band stays off while another persona is on duty', async ($, on) => {
  const band = await mountOnDuty($, on, 'richmond')
  expect(await band.find({ text: /Токсичність/ })).toBeUndefined()
  expect(await band.find({ text: /engine band/ })).toBeDefined()
})

test('a switch made elsewhere hides the band within a few seconds, no restart', async ($, on) => {
  const marker = { active: 'witcher' }
  const band = await mountOnDuty($, on, 'witcher', marker)
  expect(await band.find({ text: /Токсичність/ })).toBeDefined()
  marker.active = 'richmond'
  await clock.advance(3000)
  expect(await band.find({ text: /Токсичність/ })).toBeUndefined()
  expect(await band.find({ text: /engine band/ })).toBeDefined()
})

test('a marker that cannot be read mid-switch does not flash an off-duty band', async ($, on) => {
  const marker = { active: 'richmond' as string | undefined }
  const band = await mountOnDuty($, on, 'richmond', marker)
  expect(await band.find({ text: /Токсичність/ })).toBeUndefined()
  marker.active = undefined
  await clock.advance(3000)
  expect(await band.find({ text: /Токсичність/ })).toBeUndefined()
})

test('the band stays off after the persona was taken off', async ($, on) => {
  const band = await mountOnDuty($, on, 'none')
  expect(await band.find({ text: /Токсичність/ })).toBeUndefined()
  expect(await band.find({ text: /engine band/ })).toBeDefined()
})

const OWN = ['Медитує', 'Читає бестіарій', 'Іде по сліду', 'Точить срібний меч']
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
  const line = await $.ui.mount({ plugin: 'witcher', surface, component: 'Spinner', props: SPINNER(word, message) })
  return (await line.find({ type: 'Text' }))?.text
}

test('on duty, a word left from another persona becomes one of this one\'s verbs', async ($, on) => {
  expect(OWN).toContain(await mountSpinner($, on, 'witcher', 'Гарчить замість свистка'))
})

test('the swapped verb holds for the whole turn', async ($, on) => {
  const first = await mountSpinner($, on, 'witcher', 'Гарчить замість свистка')
  for (let frame = 0; frame < 6; frame++) expect(await drawnWord($, 'Гарчить замість свистка')).toBe(first)
})

test('a word that is already this persona\'s stays as the engine sampled it', async ($, on) => {
  expect(await mountSpinner($, on, 'witcher', OWN[0]!)).toBe(OWN[0])
  for (const verb of OWN.slice(1)) expect(await drawnWord($, verb)).toBe(verb)
})

test('off duty, the spinner word is left alone', async ($, on) => {
  expect(await mountSpinner($, on, 'someone-else', 'Гарчить замість свистка')).toBe('Гарчить замість свистка')
})

test('a state message is left alone', async ($, on) => {
  expect(await mountSpinner($, on, 'witcher', 'Гарчить замість свистка', 'Compacting conversation')).toBe('Compacting conversation')
})

test('on the desktop the word names a step and stays as it is', async ($, on) => {
  expect(await mountSpinner($, on, 'witcher', 'Creating notes.md', null, { surface: 'desktop' })).toBe('Creating notes.md')
})

test('without its verbs file the plugin leaves the engine word', async ($, on) => {
  expect(await mountSpinner($, on, 'witcher', 'Гарчить замість свистка', null, { verbs: false })).toBe('Гарчить замість свистка')
})

test('a switch made elsewhere hands the spinner on screen back within a few seconds', async ($, on) => {
  const marker = { active: 'witcher' }
  await mountSpinner($, on, 'witcher', 'Гарчить замість свистка', null, { marker })
  const line = await $.ui.mount({ plugin: 'witcher', surface: 'terminal', component: 'Spinner', props: SPINNER('Гарчить замість свистка') })
  expect(OWN).toContain((await line.find({ type: 'Text' }))?.text)
  marker.active = 'someone-else'
  await clock.advance(3000)
  expect((await line.find({ type: 'Text' }))?.text).toBe('Гарчить замість свистка')
})

test('a long turn moves to the next verb every 30 seconds', async ($, on) => {
  await mountSpinner($, on, 'witcher', OWN[0]!)
  const line = await $.ui.mount({ plugin: 'witcher', surface: 'terminal', component: 'Spinner', props: SPINNER(OWN[0]!) })
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
  await mountSpinner($, on, 'witcher', OWN[0]!)
  const line = await $.ui.mount({ plugin: 'witcher', surface: 'terminal', component: 'Spinner', props: SPINNER(OWN[0]!) })
  await clock.advance(35000)
  expect((await line.find({ type: 'Text' }))?.text).toBe(OWN[0])
  await clock.advance(30000)
  expect((await line.find({ type: 'Text' }))?.text).toBe(OWN[1])
})
