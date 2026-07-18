export const EDITORIAL_STATUSES = ['draft', 'review', 'changes_requested', 'approved', 'published', 'archived'] as const
export type EditorialStatus = typeof EDITORIAL_STATUSES[number]

const TRANSITIONS: Record<EditorialStatus, readonly EditorialStatus[]> = {
  draft: ['review', 'archived'],
  review: ['changes_requested', 'approved'],
  changes_requested: ['review', 'archived'],
  approved: ['published', 'changes_requested'],
  published: ['archived', 'changes_requested'],
  archived: ['draft'],
}

export function canTransitionEditorialStatus(from: EditorialStatus, to: EditorialStatus): boolean {
  return from === to || TRANSITIONS[from].includes(to)
}
