import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import {
  dedup,
  flatten,
  join,
  weld,
  resample,
  prune,
  textureCompress,
  meshopt,
} from '@gltf-transform/functions'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'
import sharp from 'sharp'

/**
 * Оптимизация .glb для веба перед сохранением.
 *
 * Что делает:
 *  - чистит дубли/мусор (dedup, prune, flatten, join, weld);
 *  - ужимает текстуры в WebP с ресайзом до MAX_TEXTURE (только вниз);
 *  - сжимает геометрию в EXT_meshopt_compression — ровно тот формат,
 *    который умеет встроенный декодер <model-viewer> (см. ModelViewer.tsx),
 *    без внешних CDN/декодеров.
 *
 * Возвращает оптимизированный буфер. Если он вдруг оказался крупнее
 * исходника (уже пожатая/крошечная модель) — вернётся исходный.
 */

const MAX_TEXTURE = 2048 // px, максимальная сторона текстуры
const TEXTURE_QUALITY = 85 // качество WebP

let ready: Promise<void> | null = null
function ensureReady(): Promise<void> {
  // WASM meshoptimizer инициализируется один раз на процесс
  if (!ready) ready = Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]).then(() => undefined)
  return ready
}

export async function optimizeGlb(input: Buffer): Promise<Buffer> {
  await ensureReady()

  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'meshopt.decoder': MeshoptDecoder,
    'meshopt.encoder': MeshoptEncoder,
  })

  const document = await io.readBinary(new Uint8Array(input))

  await document.transform(
    dedup(),
    flatten(),
    join(),
    weld(),
    resample(),
    prune(),
    textureCompress({
      encoder: sharp,
      targetFormat: 'webp',
      resize: [MAX_TEXTURE, MAX_TEXTURE],
      quality: TEXTURE_QUALITY,
    }),
    // meshopt — последним: кодирует геометрию, дальше её уже не трогаем
    meshopt({ encoder: MeshoptEncoder, level: 'high' }),
  )

  const output = Buffer.from(await io.writeBinary(document))
  return output.length < input.length ? output : input
}
