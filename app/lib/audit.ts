import type { Session } from 'next-auth'
import type postgres from 'postgres'

export type AuditAction =
  | 'create'
  | 'update'
  | 'publish'
  | 'unpublish'
  | 'delete'
  | 'resolve'
  | 'reject'
  | 'reopen'

export type AuditEntity = 'object' | 'event' | 'user' | 'report'

type AuditScalar = string | number | boolean | null
type AuditMetadata = Record<string, AuditScalar>

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ALLOWED_METADATA_KEYS = new Set([
  'objectId',
  'previousStatus',
  'published',
  'role',
  'status',
])

export interface AuditEntry {
  action: AuditAction
  entity: AuditEntity
  entityId: string
  metadata?: unknown
}

export interface PreparedAuditEntry {
  actorUserId: string
  actorRole: 'admin' | 'editor'
  action: AuditAction
  entity: AuditEntity
  entityId: string
  metadata: AuditMetadata
}

// Оставляет только короткие заранее разрешённые скаляры — payload и секреты не журналируются.
export function sanitizeAuditMetadata(value: unknown): AuditMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  const result: AuditMetadata = {}
  for (const [key, candidate] of Object.entries(value)) {
    if (!ALLOWED_METADATA_KEYS.has(key)) continue
    if (
      typeof candidate !== 'string' &&
      typeof candidate !== 'number' &&
      typeof candidate !== 'boolean' &&
      candidate !== null
    ) {
      continue
    }
    if (typeof candidate === 'number' && !Number.isFinite(candidate)) continue
    result[key] = typeof candidate === 'string' ? candidate.slice(0, 100) : candidate
  }
  return result
}

export function prepareAuditEntry(session: Session, entry: AuditEntry): PreparedAuditEntry {
  if (!UUID_PATTERN.test(session.user.id) || !UUID_PATTERN.test(entry.entityId)) {
    throw new Error('Audit actor and entity ids must be UUIDs')
  }
  return {
    actorUserId: session.user.id,
    actorRole: session.user.role,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId,
    metadata: sanitizeAuditMetadata(entry.metadata),
  }
}

// Вызывается внутри той же транзакции, что и административное изменение.
export async function appendAdminAudit(
  sql: postgres.TransactionSql,
  session: Session,
  entry: AuditEntry
): Promise<void> {
  const audit = prepareAuditEntry(session, entry)
  await sql`
    insert into admin_audit_log (
      actor_user_id, actor_role, action, entity_type, entity_id, metadata
    )
    values (
      ${audit.actorUserId}, ${audit.actorRole}, ${audit.action}, ${audit.entity},
      ${audit.entityId}, ${JSON.stringify(audit.metadata)}::jsonb
    )`
}
