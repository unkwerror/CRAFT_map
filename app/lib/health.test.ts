import { describe, expect, it } from 'vitest'
import { summarizeHealth } from './health'

describe('summarizeHealth', () => {
  it('reports healthy required and optional dependencies', () => {
    expect(summarizeHealth({ database: true, schema: true, uploads: true, tiles: true })).toEqual({
      status: 'ok',
      httpStatus: 200,
    })
  })

  it('keeps optional static storage failures degraded but ready', () => {
    expect(summarizeHealth({ database: true, schema: true, uploads: false, tiles: true })).toEqual({
      status: 'degraded',
      httpStatus: 200,
    })
  })

  it('returns unavailable when the database or schema is not ready', () => {
    expect(summarizeHealth({ database: true, schema: false, uploads: true, tiles: true })).toEqual({
      status: 'unavailable',
      httpStatus: 503,
    })
  })
})
