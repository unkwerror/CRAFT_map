import { NextRequest } from 'next/server'
import { serveFile } from '@/lib/serve-file'
import { UPLOADS_DIR } from '@/lib/paths'

export const dynamic = 'force-dynamic'

// В проде /uploads/ отдаёт nginx; этот роут работает в dev
export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  return serveFile(UPLOADS_DIR, path, req.headers.get('range'))
}
