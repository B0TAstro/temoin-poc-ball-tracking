/** The three tabs. Kept out of the component so hot reload keeps working. */

export const TABS = ['Camera', 'Replay', 'Training'] as const

export type Tab = (typeof TABS)[number]
