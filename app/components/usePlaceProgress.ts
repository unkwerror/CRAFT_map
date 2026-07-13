'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  PLACE_PROGRESS_EVENT,
  PLACE_PROGRESS_STORAGE_KEY,
  emptyPlaceProgress,
  normalizePlaceProgress,
  parsePlaceProgress,
  readPlaceProgress,
  togglePlaceProgress,
  writePlaceProgress,
} from '@/lib/place-progress'
import type { PlaceProgressCollection, PlaceProgressState } from '@/lib/place-progress'

export default function usePlaceProgress() {
  const [state, setState] = useState<PlaceProgressState>(emptyPlaceProgress)
  const stateRef = useRef(state)

  useEffect(() => {
    const sync = (next: PlaceProgressState) => {
      stateRef.current = next
      setState(next)
    }

    try {
      sync(readPlaceProgress(window.localStorage))
    } catch {
      // В приватном режиме состояние продолжает работать в памяти текущей вкладки.
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key !== PLACE_PROGRESS_STORAGE_KEY) return
      sync(parsePlaceProgress(event.newValue))
    }
    const onCustom = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail
      sync(normalizePlaceProgress(detail))
    }

    window.addEventListener('storage', onStorage)
    window.addEventListener(PLACE_PROGRESS_EVENT, onCustom)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(PLACE_PROGRESS_EVENT, onCustom)
    }
  }, [])

  const toggle = useCallback((collection: PlaceProgressCollection, objectId: string) => {
    let current = stateRef.current
    try {
      current = readPlaceProgress(window.localStorage)
    } catch {
      // Используем актуальное состояние в памяти, если localStorage недоступен.
    }
    const next = togglePlaceProgress(current, collection, objectId)
    stateRef.current = next
    setState(next)
    try {
      writePlaceProgress(window.localStorage, next)
    } catch {
      // Действие остаётся доступным до закрытия вкладки.
    }
    window.dispatchEvent(new CustomEvent(PLACE_PROGRESS_EVENT, { detail: next }))
  }, [])

  const favoriteIds = useMemo(() => new Set(state.favorites), [state.favorites])
  const visitedIds = useMemo(() => new Set(state.visited), [state.visited])
  const toggleFavorite = useCallback((id: string) => toggle('favorites', id), [toggle])
  const toggleVisited = useCallback((id: string) => toggle('visited', id), [toggle])

  return {
    favoriteIds,
    visitedIds,
    toggleFavorite,
    toggleVisited,
  }
}
