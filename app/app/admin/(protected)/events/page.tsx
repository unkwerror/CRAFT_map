import EventsManager from '@/components/admin/EventsManager'

export const dynamic = 'force-dynamic'

export default function EventsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Мероприятия</h1>
      <EventsManager />
    </div>
  )
}
