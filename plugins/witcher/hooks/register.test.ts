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

function fakeWear(on: any, result = { exitCode: 0, stdout: 'Відьмак на шляху: тема corvo-bianco\n', stderr: '' }) {
  const calls: string[][] = []
  on('process.run', (_$: any, e: any) => {
    calls.push([...e.argv])
    return { value: { ...result, isStdoutTruncated: false, isStderrTruncated: false } }
  })
  return calls
}

test('/witcher runs wear.sh on with the default theme and relays what it changed', async ($, on) => {
  const calls = fakeWear(on)
  const text = await run($, '')
  expect(calls.length).toBe(1)
  expect(calls[0]?.slice(1)).toEqual([expect.stringMatching(/\/scripts\/wear\.sh$/), 'on'])
  expect(text).toMatch(/Відьмак на шляху: тема corvo-bianco/)
  expect(text).toMatch(/Перезапусти/)
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

test('a failed wear.sh shows its stderr instead of a restart hint', async ($, on) => {
  fakeWear(on, { exitCode: 1, stdout: '', stderr: 'нема теми novigrad, є: corvo-bianco, kaer-morhen\n' })
  const text = await run($, 'novigrad')
  expect(text).toMatch(/нема теми novigrad/)
  expect(text).not.toMatch(/Перезапусти/)
})

async function mountOnDuty($: any, on: any, active: string, marker = { active }) {
  // Stands for the engine's own band, drawn when the plugin passes
  on('ui.render', { component: 'AbovePrompt' }, ($: any, e: any) => $.ui.resolve(e).Text({ children: 'engine band' }))
  on('env.get', (_$: any, e: any) => ({ value: e.name === 'HOME' ? '/home/fan' : undefined }))
  on('fs.read', (_$: any, e: any) => {
    if (e.path !== '/home/fan/.claude/personas/active') throw new Error('ENOENT')
    return { value: `${marker.active}\n` }
  })
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000, percent: 12 }, rateLimits: [] } }))
  on('command.register', (_$: any, e: any) => ({ value: { command: e.name } }))
  on('session.start', (_$: any, e: any) => ({ cwd: e.cwd }))
  on('turn.complete', () => ({ text: '' }))
  mock.clock(on)
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

test('a switch made in another session hides the band once the turn completes', async ($, on) => {
  const marker = { active: 'witcher' }
  const band = await mountOnDuty($, on, 'witcher', marker)
  expect(await band.find({ text: /Токсичність/ })).toBeDefined()
  marker.active = 'richmond'
  await ($ as any).turn.complete({ reason: 'answer', answer: 'ok' })
  expect(await band.find({ text: /Токсичність/ })).toBeUndefined()
})

test('the band stays off after the persona was taken off', async ($, on) => {
  const band = await mountOnDuty($, on, 'none')
  expect(await band.find({ text: /Токсичність/ })).toBeUndefined()
  expect(await band.find({ text: /engine band/ })).toBeDefined()
})
