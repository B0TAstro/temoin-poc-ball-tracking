/** "Coming soon" notice, so a tab does not look broken. */

type Props = {
  milestone: string
  children: React.ReactNode
}

export function ComingSoon({ milestone, children }: Props) {
  return (
    <div className="rounded-md border border-dashed border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm text-amber-200/80">
      <span className="font-semibold">À venir — {milestone}.</span> {children}
    </div>
  )
}
