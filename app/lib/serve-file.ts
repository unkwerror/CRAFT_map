import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { join, normalize } from 'node:path'
import { Readable } from 'node:stream'

const TYPES: Record<string, string> = {
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.pbf': 'application/x-protobuf',
  '.pmtiles': 'application/octet-stream',
  '.json': 'application/json',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
}

function contentType(path: string): string {
  const dot = path.lastIndexOf('.')
  return (dot >= 0 ? TYPES[path.slice(dot).toLowerCase()] : undefined) ?? 'application/octet-stream'
}

/**
 * Отдача файла из baseDir с поддержкой Range-запросов (нужно для PMTiles).
 * Используется только в dev — в проде статику отдаёт nginx.
 */
export async function serveFile(baseDir: string, parts: string[], rangeHeader: string | null) {
  if (parts.some((p) => p.includes('..') || p.includes('\0'))) {
    return new Response('Not found', { status: 404 })
  }
  const filePath = normalize(join(baseDir, ...parts))
  if (!filePath.startsWith(normalize(baseDir))) {
    return new Response('Not found', { status: 404 })
  }

  let size: number
  try {
    const st = await stat(filePath)
    if (!st.isFile()) return new Response('Not found', { status: 404 })
    size = st.size
  } catch {
    return new Response('Not found', { status: 404 })
  }

  const headers: Record<string, string> = {
    'Content-Type': contentType(filePath),
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=60',
  }

  const m = rangeHeader?.match(/^bytes=(\d*)-(\d*)$/)
  if (m && (m[1] || m[2])) {
    const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]))
    const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1
    if (start > end || start >= size) {
      return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
    }
    const stream = Readable.toWeb(createReadStream(filePath, { start, end })) as ReadableStream
    return new Response(stream, {
      status: 206,
      headers: {
        ...headers,
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Content-Length': String(end - start + 1),
      },
    })
  }

  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream
  return new Response(stream, { status: 200, headers: { ...headers, 'Content-Length': String(size) } })
}
