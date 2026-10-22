/** Les trois onglets. Sorti du composant pour que le rechargement à chaud marche. */

export const TABS = ['Camera', 'Replay', 'Training'] as const

export type Tab = (typeof TABS)[number]
