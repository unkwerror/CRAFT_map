import { NextRequest } from 'next/server'
import { join } from 'node:path'
import { serveFile } from '@/lib/serve-file'
import { TILES_DIR } from '@/lib/paths'

export const dynamic = 'force-dynamic'

// В проде /glyphs/ отдаёт nginx; этот роут работает в dev
export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  return serveFile(join(TILES_DIR, 'glyphs'), path, req.headers.get('range'))
}
