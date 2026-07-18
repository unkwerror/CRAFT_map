import{describe,expect,it}from'vitest';import{archiveMediaInputSchema,historicalEventInputSchema,memoryAdminInputSchema,memoryWorkflowInputSchema,personInputSchema,personMatches,timelineInputSchema}from'./memory-graph'
const uuidA='1b4e28ba-2fa1-4f62-8e02-4d0d8c6edaaa',uuidB='2b4e28ba-2fa1-4f62-8e02-4d0d8c6edaaa'
describe('memory graph',()=>{it('finds a person by alias',()=>expect(personMatches('иван петров',{name:'И. И. Петров',aliases:['Иван Петров']})).toBe(true));it('keeps same-name people separate',()=>expect(personMatches('Петров',{name:'Петров Алексей',aliases:[]})).toBe(true));it('rejects reversed timeline range',()=>expect(timelineInputSchema.safeParse({objectId:uuidA,entryType:'other',title:'Событие',dateFrom:'2000-01-02',dateTo:'2000-01-01'}).success).toBe(false));it('validates life years',()=>expect(personInputSchema.safeParse({slug:'ivan-petrov',name:'Иван',birthYear:2000,deathYear:1900}).success).toBe(false));it('validates typed object-person links',()=>expect(memoryAdminInputSchema.safeParse({kind:'objectPerson',objectId:uuidA,personId:uuidB,relationType:'Автор'}).success).toBe(true))
it('rejects reversed historical event range',()=>expect(historicalEventInputSchema.safeParse({slug:'osnovanie',title:'Основание города',dateFrom:'1900-01-02',dateTo:'1900-01-01'}).success).toBe(false))
it('requires uploads path, source, rights and alt for archive media',()=>{
 expect(archiveMediaInputSchema.safeParse({objectId:uuidA,fileUrl:'https://evil.test/a.jpg',sourceId:uuidB,rightsStatus:'музей',altText:'Вид'}).success).toBe(false)
 expect(archiveMediaInputSchema.safeParse({objectId:uuidA,fileUrl:'/uploads/old.webp',sourceId:uuidB,rightsStatus:'',altText:''}).success).toBe(false)
 expect(archiveMediaInputSchema.safeParse({objectId:uuidA,fileUrl:'/uploads/old.webp',currentFileUrl:'/uploads/new.webp',sourceId:uuidB,rightsStatus:'из фондов музея',altText:'Вид на мемориал'}).success).toBe(true)})
it('accepts only whitelisted workflow entities',()=>{
 expect(memoryWorkflowInputSchema.safeParse({entity:'person',id:uuidA,status:'review'}).success).toBe(true)
 expect(memoryWorkflowInputSchema.safeParse({entity:'object',id:uuidA,status:'review'}).success).toBe(false)})
it('accepts typed event links',()=>expect(memoryAdminInputSchema.safeParse({kind:'objectEvent',objectId:uuidA,eventId:uuidB,relationType:'посвящён событию'}).success).toBe(true))})
