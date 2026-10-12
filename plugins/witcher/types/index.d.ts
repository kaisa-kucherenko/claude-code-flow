export type Usage = {
  ctx: number | null
  fiveHour: number | null
  fiveHourReset: string | null
  sevenDay: number | null
}

declare module 'claude-code' {
  interface PluginState {
    'witcher': { usage: Usage }
  }
}
