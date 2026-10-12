export type Usage = {
  ctx: number | null
  fiveHour: number | null
  fiveHourReset: string | null
  sevenDay: number | null
  sevenDayReset: string | null
}

declare module 'claude-code' {
  interface PluginState {
    'richmond': { usage: Usage }
  }
}
