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

/** Загрузка 3D-модели памятника: только .glb (glTF 2.0 binary) */
export async function POST(req: NextRequest) {
  const guard = await requireRole('editor')
  if (guard.error) return guard.error

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

  // Автооптимизация под веб (meshopt-геометрия + WebP-текстуры). При любой
  // ошибке оптимизатора сохраняем исходный файл — загрузка не должна падать.
  let out: Buffer = buf
  try {
    out = await optimizeGlb(buf)
  } catch {
    out = buf
  }

  const id = randomUUID()
  await mkdir(UPLOADS_DIR, { recursive: true })
  await writeFile(join(UPLOADS_DIR, `${id}.glb`), out)

  return NextResponse.json({ url: `/uploads/${id}.glb` })
}
