'use client'

import { useEffect, useState } from 'react'

interface Props {
  src: string
  alt?: string
}

/**
 * 3D-вьюер модели памятника (glTF/GLB). Библиотека @google/model-viewer
 * подгружается лениво только на клиенте (регистрирует веб-компонент <model-viewer>).
 * Формат моделей — .glb с meshopt-сжатием (декодер встроен, без внешних запросов).
 */
export default function ModelViewer({ src, alt }: Props) {
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [requestKey, setRequestKey] = useState(0)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    let cancelled = false
    setReady(false)
    setFailed(false)
    import('@google/model-viewer')
      .then(({ ModelViewerElement }) => {
        // В установленном @google/model-viewer MeshoptDecoder встроен в bundle,
        // но активируется только после загрузки meshoptDecoderLocation. Локальный
        // bootstrap проходит production CSP и не требует внешнего CDN.
        ModelViewerElement.meshoptDecoderLocation = '/model-viewer-meshopt-bootstrap.js'
        if (!cancelled) setReady(true)
      })
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [requestKey])

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  if (failed) {
    return (
      <div className="flex h-full w-full items-center justify-center p-6 text-center text-sm text-white/60">
        <div>
          <p>Не удалось загрузить 3D-вьюер.</p>
          <button type="button" onClick={() => setRequestKey((value) => value + 1)} className="btn-ghost mt-3 min-h-10 rounded-xl px-4 text-sm text-white/80">
            Повторить
          </button>
        </div>
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm text-white/50">
        Загрузка 3D…
      </div>
    )
  }

  return (
    <model-viewer
      src={src}
      alt={alt ?? '3D-модель памятника'}
      camera-controls
      auto-rotate={!reducedMotion}
      auto-rotate-delay={0}
      rotation-per-second="20deg"
      shadow-intensity="1"
      exposure="1"
      touch-action="pan-y"
      interaction-prompt="none"
      onError={() => setFailed(true)}
      style={{ width: '100%', height: '100%', backgroundColor: 'transparent' }}
    />
  )
}
