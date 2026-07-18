import { describe, expect, it } from 'vitest'
import { canTransitionEditorialStatus } from './editorial-workflow'

describe('editorial workflow', () => {
  it('allows the reviewed publication path', () => {
    expect(canTransitionEditorialStatus('draft', 'review')).toBe(true)
    expect(canTransitionEditorialStatus('review', 'approved')).toBe(true)
    expect(canTransitionEditorialStatus('approved', 'published')).toBe(true)
  })
  it('does not allow publishing a draft directly', () => {
    expect(canTransitionEditorialStatus('draft', 'published')).toBe(false)
  })
})
