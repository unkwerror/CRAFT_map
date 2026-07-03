import { NextRequest } from 'next/server'
import { serveFile } from '@/lib/serve-file'
import { TILES_DIR } from '@/lib/paths'

export const dynamic = 'force-dynamic'

// В проде /tiles/ отдаёт nginx; этот роут работает в dev (PMTiles требует Range)
export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  return serveFile(TILES_DIR, path, req.headers.get('range'))
}

export async function HEAD(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return GET(req, ctx)
}
