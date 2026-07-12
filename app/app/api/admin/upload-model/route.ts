import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/guard'
import { UPLOADS_DIR } from '@/lib/paths'
import { optimizeGlb } from '@/lib/optimize-glb'

export const dynamic = 'force-dynamic'

const MAX_SIZE = 20 * 1024 * 1024 // 20 МБ; на веб рекомендуется ≤3 МБ (Draco/meshopt)
// glTF-binary начинается с магии "glTF" (0x676c5446)
const GLTF_MAGIC = 0x46546c67
const GLTF_JSON_CHUNK = 0x4e4f534a
const EXTERNAL_DECODER_EXTENSIONS = new Set([
  'KHR_draco_mesh_compression',
  'KHR_texture_basisu',
])

function externalDecoderExtensions(buffer: Buffer): string[] {
  let offset = 12
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32LE(offset)
    const type = buffer.readUInt32LE(offset + 4)
    const start = offset + 8
    const end = start + length
    if (end > buffer.length) return []
    if (type === GLTF_JSON_CHUNK) {
      try {
        const json = JSON.parse(buffer.subarray(start, end).toString('utf8').replace(/\u0000+$/u, '')) as {
          extensionsUsed?: unknown
        }
        return Array.isArray(json.extensionsUsed)
          ? json.extensionsUsed.filter(
              (extension): extension is string =>
                typeof extension === 'string' && EXTERNAL_DECODER_EXTENSIONS.has(extension)
            )
          : []
      } catch {
        return []
      }
    }
    offset = end
  }
  return []
}

/** Загрузка 3D-модели памятника: только .glb (glTF 2.0 binary) */
export async function POST(req: NextRequest) {
  const guard = await requireRole('editor')
  if (guard.error) return guard.error

  const contentLength = Number(req.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > MAX_SIZE + 1024 * 1024) {
    return NextResponse.json({ error: 'Файл больше 20 МБ' }, { status: 413 })
  }

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Файл не передан' }, { status: 400 })
  }
  if (!file.name.toLowerCase().endsWith('.glb')) {
    return NextResponse.json({ error: 'Нужен файл .glb (glTF 2.0 binary)' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Файл больше 20 МБ' }, { status: 400 })
  }

  const buf = Buffer.from(await file.arrayBuffer())
  if (buf.length < 12 || buf.readUInt32LE(0) !== GLTF_MAGIC) {
    return NextResponse.json({ error: 'Файл не является корректным .glb' }, { status: 400 })
  }

  // Автооптимизация под веб (meshopt-геометрия + WebP-текстуры). Для обычного
  // GLB при сбое можно безопасно сохранить оригинал. Draco/KTX2 без успешной
  // конвертации не принимаем: иначе админка покажет успех, а публичный CSP
  // заблокирует внешние декодеры model-viewer.
  let out: Buffer = buf
  try {
    out = await optimizeGlb(buf)
  } catch {
    out = buf
  }

  const unsupportedExtensions = externalDecoderExtensions(out)
  if (unsupportedExtensions.length > 0) {
    return NextResponse.json(
      {
        error: `Не удалось подготовить модель для сайта (${unsupportedExtensions.join(', ')}). Экспортируйте GLB без Draco/KTX2 — сервер применит совместимое сжатие автоматически.`,
      },
      { status: 422 }
    )
  }

  const id = randomUUID()
  await mkdir(UPLOADS_DIR, { recursive: true })
  await writeFile(join(UPLOADS_DIR, `${id}.glb`), out)

  return NextResponse.json({ url: `/uploads/${id}.glb` })
}
