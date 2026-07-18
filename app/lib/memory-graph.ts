import { z } from 'zod'
import { EDITORIAL_STATUSES } from './editorial-workflow'

export const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120)
const uploadsPathSchema = z.string().regex(/^\/uploads\/[a-zA-Z0-9._-]+$/)
export const personInputSchema = z.object({
  slug: slugSchema, name: z.string().trim().min(1).max(300),
  aliases: z.array(z.string().trim().min(1).max(300)).max(50).default([]),
  birthYear: z.number().int().min(1).max(3000).nullish(), deathYear: z.number().int().min(1).max(3000).nullish(),
  shortBio: z.string().max(2000).nullish(), biography: z.string().max(30000).nullish(),
  portraitUrl: z.string().regex(/^\/uploads\/[a-zA-Z0-9._-]+$/).nullish(),
  verificationStatus: z.enum(['unverified','needs_review','verified']).default('unverified'),
  editorialStatus: z.enum(['draft','review','changes_requested','approved','published','archived']).default('draft'),
}).refine(v=>v.deathYear==null||v.birthYear==null||v.deathYear>=v.birthYear,{path:['deathYear'],message:'Год смерти раньше года рождения'})

export function personMatches(query:string,person:{name:string;aliases:string[]}):boolean{
  const q=query.trim().toLocaleLowerCase('ru-RU');if(!q)return true
  return [person.name,...person.aliases].some(value=>value.toLocaleLowerCase('ru-RU').includes(q))
}

export const timelineInputSchema=z.object({
  objectId:z.string().uuid(),entryType:z.enum(['creation','opening','move','damage','restoration','commemoration','other']),
  dateFrom:z.string().date().nullish(),dateTo:z.string().date().nullish(),approximate:z.boolean().default(false),
  title:z.string().trim().min(1).max(500),description:z.string().max(10000).nullish(),
  editorialStatus:z.enum(['draft','review','changes_requested','approved','published','archived']).default('draft'),
}).refine(v=>!v.dateFrom||!v.dateTo||v.dateTo>=v.dateFrom,{path:['dateTo'],message:'Конец диапазона раньше начала'})

export const historicalEventInputSchema=z.object({
  slug:slugSchema,title:z.string().trim().min(1).max(500),
  dateFrom:z.string().date().nullish(),dateTo:z.string().date().nullish(),approximate:z.boolean().default(false),
  description:z.string().max(10000).nullish(),geography:z.string().trim().max(500).nullish(),
}).refine(v=>!v.dateFrom||!v.dateTo||v.dateTo>=v.dateFrom,{path:['dateTo'],message:'Конец диапазона раньше начала'})

// Источник, права и alt обязательны сразу: без них БД не пропустит публикацию архивного фото.
export const archiveMediaInputSchema=z.object({
  objectId:z.string().uuid(),timelineEntryId:z.string().uuid().nullish(),
  captureFrom:z.string().date().nullish(),captureTo:z.string().date().nullish(),approximate:z.boolean().default(false),
  fileUrl:uploadsPathSchema,currentFileUrl:uploadsPathSchema.nullish(),
  sourceId:z.string().uuid(),rightsStatus:z.string().trim().min(1).max(300),
  originalAuthor:z.string().trim().max(300).nullish(),altText:z.string().trim().min(1).max(1000),
}).refine(v=>!v.captureFrom||!v.captureTo||v.captureTo>=v.captureFrom,{path:['captureTo'],message:'Конец диапазона раньше начала'})

export const memoryAdminInputSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('person'), person: personInputSchema }),
  z.object({ kind: z.literal('timeline'), entry: timelineInputSchema }),
  z.object({ kind: z.literal('event'), event: historicalEventInputSchema }),
  z.object({ kind: z.literal('archiveMedia'), media: archiveMediaInputSchema }),
  z.object({
    kind: z.literal('objectPerson'), objectId: z.string().uuid(), personId: z.string().uuid(),
    relationType: z.string().trim().min(1).max(120), publicNote: z.string().trim().max(2000).nullish(),
  }),
  z.object({
    kind: z.literal('objectEvent'), objectId: z.string().uuid(), eventId: z.string().uuid(),
    relationType: z.string().trim().min(1).max(120),
  }),
  z.object({
    kind: z.literal('personEvent'), personId: z.string().uuid(), eventId: z.string().uuid(),
    relationType: z.string().trim().min(1).max(120),
  }),
])

export const MEMORY_WORKFLOW_ENTITIES=['person','historical_event','timeline_entry','archive_media'] as const
export type MemoryWorkflowEntity=typeof MEMORY_WORKFLOW_ENTITIES[number]
export const memoryWorkflowInputSchema=z.object({
  entity:z.enum(MEMORY_WORKFLOW_ENTITIES),id:z.string().uuid(),
  status:z.enum(EDITORIAL_STATUSES),comment:z.string().trim().max(2000).nullish(),
}).strict()
