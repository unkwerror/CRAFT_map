import { describe, expect, it } from 'vitest'
import { parseFeatureFlag } from './feature-flags'

describe('parseFeatureFlag', () => {
  it.each(['true', 'TRUE', '1', ' true '])('enables %s', (value) => {
    expect(parseFeatureFlag(value)).toBe(true)
  })
  it.each([undefined, '', 'false', '0', 'yes'])('keeps %s disabled', (value) => {
    expect(parseFeatureFlag(value)).toBe(false)
  })
})
