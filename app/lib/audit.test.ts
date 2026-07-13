import { describe, expect, it } from 'vitest'
import type { Session } from 'next-auth'
import { prepareAuditEntry, sanitizeAuditMetadata } from './audit'

const session = {
  user: {
    id: '123e4567-e89b-42d3-a456-426614174000',
    role: 'editor',
    email: 'editor@example.test',
  },
  expires: '2099-01-01T00:00:00.000Z',
} as Session

describe('audit helpers', () => {
  it('derives the actor from the guarded session and keeps minimal metadata', () => {
    expect(prepareAuditEntry(session, {
      action: 'update',
      entity: 'event',
      entityId: '9f71c0fe-b60c-49f2-884f-a7d3f94ae4c2',
      metadata: { status: 'scheduled', published: true },
    })).toEqual({
      actorUserId: session.user.id,
      actorRole: 'editor',
      action: 'update',
      entity: 'event',
      entityId: '9f71c0fe-b60c-49f2-884f-a7d3f94ae4c2',
      metadata: { status: 'scheduled', published: true },
    })
  })

  it('drops secrets, free text, nested values and unknown keys', () => {
    expect(sanitizeAuditMetadata({
      role: 'admin',
      password: 'never-log-this',
      token: 'never-log-this',
      email: 'private@example.test',
      message: 'Пользовательский текст',
      nested: { authorization: 'secret' },
    })).toEqual({ role: 'admin' })
  })

  it('rejects non-UUID actor or entity ids', () => {
    expect(() => prepareAuditEntry(session, {
      action: 'delete',
      entity: 'object',
      entityId: 'not-an-id',
    })).toThrow('must be UUIDs')
  })
})
