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

  useEffect(() => {
    let cancelled = false
    import('@google/model-viewer')
      .then(() => !cancelled && setReady(true))
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [])

  if (failed) {
    return (
      <div className="flex h-full w-full items-center justify-center p-6 text-center text-sm text-white/60">
        Не удалось загрузить 3D-вьюер.
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
      auto-rotate
      auto-rotate-delay={0}
      rotation-per-second="20deg"
      shadow-intensity="1"
      exposure="1"
      touch-action="pan-y"
      interaction-prompt="none"
      style={{ width: '100%', height: '100%', backgroundColor: 'transparent' }}
    />
  )
}
