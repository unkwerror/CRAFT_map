'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import MiniMap from './MiniMap'
import PhotoUpload from './PhotoUpload'
import ModelUpload from './ModelUpload'
import VideoUpload from './VideoUpload'
import AudioUpload from './AudioUpload'
import SectionsEditor from './SectionsEditor'
import type { CategoryDto, DescriptionSection, ObjectFull, Photo, Video } from '@/lib/types'

interface Props {
  categories: CategoryDto[]
  initial?: ObjectFull
}

const MEDIA_UPLOAD_MESSAGE = 'Дождитесь загрузки медиа'
type DistrictStatus = 'idle' | 'loading' | 'ready' | 'error'

export default function ObjectForm({ categories, initial }: Props) {
  const router = useRouter()
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? categories[0]?.id ?? '')
  const [address, setAddress] = useState(initial?.address ?? '')
  const [lng, setLng] = useState<number | null>(initial?.lng ?? null)
  const [lat, setLat] = useState<number | null>(initial?.lat ?? null)
  const [districtName, setDistrictName] = useState<string | null>(initial?.districtName ?? null)
  const [districtStatus, setDistrictStatus] = useState<DistrictStatus>(
    initial?.districtName ? 'ready' : 'idle'
  )
  const [photos, setPhotos] = useState<Photo[]>(initial?.photos ?? [])
  const [videos, setVideos] = useState<Video[]>(initial?.videos ?? [])
  const [audioUrl, setAudioUrl] = useState<string | null>(initial?.audioUrl ?? null)
  const [audioText, setAudioText] = useState(initial?.audioText ?? '')
  const [rating, setRating] = useState<number | null>(initial?.rating ?? null)
  const [sections, setSections] = useState<DescriptionSection[]>(initial?.sections ?? [])
  const [modelUrl, setModelUrl] = useState<string | null>(initial?.modelUrl ?? null)
  const [published, setPublished] = useState(initial?.published ?? true)
  const [sortWeight, setSortWeight] = useState(initial?.sortWeight ?? 0)
  const [alternativeNames, setAlternativeNames] = useState(initial?.alternativeNames?.join(', ') ?? '')
  const [objectType, setObjectType] = useState(initial?.objectType ?? '')
  const [creationPeriod, setCreationPeriod] = useState(initial?.creationPeriod ?? '')
  const [protectionStatus, setProtectionStatus] = useState(initial?.protectionStatus ?? '')
  const [materials, setMaterials] = useState(initial?.materials?.join(', ') ?? '')
  const [accessInfo, setAccessInfo] = useState(initial?.accessInfo ?? '')
  const [mediaRightsStatus, setMediaRightsStatus] = useState(initial?.mediaRightsStatus ?? '')
  const [verificationStatus, setVerificationStatus] = useState(initial?.verificationStatus ?? 'unverified')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [videoUploading, setVideoUploading] = useState(false)
  const [audioUploading, setAudioUploading] = useState(false)
  const [modelUploading, setModelUploading] = useState(false)
  const mediaUploading = photoUploading || videoUploading || audioUploading || modelUploading

  useEffect(() => {
    if (
      lng === null ||
      lat === null ||
      !Number.isFinite(lng) ||
      !Number.isFinite(lat) ||
      lng < -180 ||
      lng > 180 ||
      lat < -90 ||
      lat > 90
    ) {
      setDistrictName(null)
      setDistrictStatus('idle')
      return
    }

    const controller = new AbortController()
    setDistrictName(null)
    setDistrictStatus('loading')
    const timeout = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ lng: String(lng), lat: String(lat) })
        const res = await fetch(`/api/districts/at?${params}`, { signal: controller.signal })
        if (!res.ok) throw new Error('district lookup failed')
        const data = (await res.json()) as { district: { id: number; name: string } | null }
        setDistrictName(data.district?.name ?? null)
        setDistrictStatus('ready')
      } catch (lookupError) {
        if (lookupError instanceof Error && lookupError.name === 'AbortError') return
        setDistrictName(null)
        setDistrictStatus('error')
      }
    }, 200)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [lng, lat])

  useEffect(() => {
    if (!dirty || busy) return
    const warnUnsaved = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warnUnsaved)
    return () => window.removeEventListener('beforeunload', warnUnsaved)
  }, [dirty, busy])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (mediaUploading) return
    if (lng === null || lat === null) {
      setError('Поставьте точку на карте')
      return
    }
    const filledSections = sections.filter((s) => s.title.trim() && s.text.trim())
    if (filledSections.length < sections.length) {
      setError('Заполните заголовок и текст у всех секций (или удалите пустые)')
      return
    }
    setBusy(true)
    setError('')

    const payload = {
      title,
      description: description || null,
      categoryId,
      address: address || null,
      lng,
      lat,
      photos,
      videos,
      audioUrl,
      audioText: audioText || null,
      rating,
      sections: filledSections,
      modelUrl,
      published,
      sortWeight,
      alternativeNames: alternativeNames.split(',').map((v) => v.trim()).filter(Boolean),
      objectType: objectType || null,
      creationPeriod: creationPeriod || null,
      protectionStatus: protectionStatus || null,
      materials: materials.split(',').map((v) => v.trim()).filter(Boolean),
      accessInfo: accessInfo || null,
      mediaRightsStatus: mediaRightsStatus || null,
      verificationStatus,
    }
    try {
      const res = await fetch(
        initial ? `/api/admin/objects/${initial.id}` : '/api/admin/objects',
        {
          method: initial ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        setError(body?.error ?? 'Не удалось сохранить')
        return
      }
      setDirty(false)
      router.push('/admin')
      router.refresh()
    } catch {
      setError('Нет соединения с сервером — проверьте сеть и попробуйте ещё раз')
    } finally {
      setBusy(false)
    }
  }

  const inputCls =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500'

  return (
    <form onSubmit={submit} onInput={() => setDirty(true)} className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Название *</span>
          <input required maxLength={300} value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">Категория *</span>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputCls}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">Адрес</span>
          <input maxLength={500} value={address} onChange={(e) => setAddress(e.target.value)} className={inputCls} />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">Описание</span>
          <textarea
            rows={7}
            maxLength={10000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputCls}
          />
        </label>

        <fieldset className="space-y-3 rounded-xl border border-slate-200 p-4">
          <legend className="px-1 text-sm font-semibold">Паспорт места</legend>
          <label className="block">
            <span className="mb-1 block text-sm">Альтернативные названия через запятую</span>
            <input value={alternativeNames} onChange={(e) => setAlternativeNames(e.target.value)} maxLength={3000} className={inputCls} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label><span className="mb-1 block text-sm">Тип объекта</span><input value={objectType} onChange={(e) => setObjectType(e.target.value)} maxLength={200} className={inputCls} /></label>
            <label><span className="mb-1 block text-sm">Период создания</span><input value={creationPeriod} onChange={(e) => setCreationPeriod(e.target.value)} maxLength={200} className={inputCls} /></label>
          </div>
          <label className="block"><span className="mb-1 block text-sm">Материалы через запятую</span><input value={materials} onChange={(e) => setMaterials(e.target.value)} maxLength={3000} className={inputCls} /></label>
          <label className="block"><span className="mb-1 block text-sm">Охранный статус</span><input value={protectionStatus} onChange={(e) => setProtectionStatus(e.target.value)} maxLength={500} className={inputCls} /></label>
          <label className="block"><span className="mb-1 block text-sm">Режим доступа</span><textarea value={accessInfo} onChange={(e) => setAccessInfo(e.target.value)} maxLength={2000} rows={2} className={inputCls} /></label>
          <label className="block"><span className="mb-1 block text-sm">Права на медиа</span><input value={mediaRightsStatus} onChange={(e) => setMediaRightsStatus(e.target.value)} maxLength={200} className={inputCls} /></label>
          <label className="block">
            <span className="mb-1 block text-sm">Статус достоверности</span>
            <select value={verificationStatus} onChange={(e) => setVerificationStatus(e.target.value as typeof verificationStatus)} className={inputCls}>
              <option value="unverified">Не проверено</option>
              <option value="needs_review">Требует проверки</option>
              <option value="verified">Проверено</option>
            </select>
          </label>
        </fieldset>

        <div>
          <span className="mb-1 block text-sm font-medium">Секции описания</span>
          <span className="mb-2 block text-xs text-slate-500">
            Дополнительные разделы карточки: «Архитектура», «История» и т.п.
          </span>
          <SectionsEditor sections={sections} onChange={(next) => { setSections(next); setDirty(true) }} />
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">Рейтинг (0–5)</span>
          <input
            type="number"
            min={0}
            max={5}
            step={0.1}
            value={rating ?? ''}
            onChange={(e) => setRating(e.target.value === '' ? null : Number(e.target.value))}
            placeholder="Не показывать"
            className={inputCls}
          />
          <span className="mt-1 block text-xs text-slate-500">
            Временно вручную — источник рейтинга обсуждается с заказчиком
          </span>
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
            className="h-4 w-4"
          />
          Опубликован (виден на карте)
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">Приоритет на карте</span>
          <input
            type="number"
            min={-1000}
            max={1000}
            step={1}
            value={sortWeight}
            onChange={(e) => setSortWeight(Number(e.target.value))}
            className={inputCls}
          />
          <span className="mt-1 block text-xs text-slate-500">
            Объекты с большим значением показываются раньше
          </span>
        </label>

        <div>
          <span className="mb-1 block text-sm font-medium">Фотографии</span>
          <PhotoUpload photos={photos} onChange={(next) => { setPhotos(next); setDirty(true) }} onUploadingChange={setPhotoUploading} />
        </div>

        <div>
          <span className="mb-1 block text-sm font-medium">Видео</span>
          <VideoUpload videos={videos} onChange={(next) => { setVideos(next); setDirty(true) }} onUploadingChange={setVideoUploading} />
        </div>

        <div>
          <span className="mb-1 block text-sm font-medium">Аудиогид</span>
          <textarea
            rows={4}
            maxLength={20000}
            value={audioText}
            onChange={(e) => setAudioText(e.target.value)}
            placeholder="Текстовая версия аудиогида (доступность: аудио + текст)"
            className={`${inputCls} mb-2`}
          />
          <AudioUpload
            audioUrl={audioUrl}
            audioText={audioText}
            onChange={(next) => { setAudioUrl(next); setDirty(true) }}
            onUploadingChange={setAudioUploading}
          />
        </div>

        <div>
          <span className="mb-1 block text-sm font-medium">3D-модель (.glb)</span>
          <ModelUpload modelUrl={modelUrl} onChange={(next) => { setModelUrl(next); setDirty(true) }} onUploadingChange={setModelUploading} />
        </div>
      </div>

      <div className="space-y-3">
        <span className="block text-sm font-medium">Координата — кликните по карте *</span>
        <MiniMap
          lng={lng}
          lat={lat}
          onChange={(newLng, newLat) => {
            setLng(newLng)
            setLat(newLat)
            setDirty(true)
          }}
        />
        <div className="flex gap-3">
          <label className="flex-1">
            <span className="mb-1 block text-xs text-slate-500">Долгота</span>
            <input
              type="number"
              step="0.000001"
              value={lng ?? ''}
              onChange={(e) => setLng(e.target.value === '' ? null : Number(e.target.value))}
              className={inputCls}
            />
          </label>
          <label className="flex-1">
            <span className="mb-1 block text-xs text-slate-500">Широта</span>
            <input
              type="number"
              step="0.000001"
              value={lat ?? ''}
              onChange={(e) => setLat(e.target.value === '' ? null : Number(e.target.value))}
              className={inputCls}
            />
          </label>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm" role="status">
          <span className="font-medium">Округ: </span>
          {districtStatus === 'loading' && <span className="text-slate-500">определяем…</span>}
          {districtStatus === 'ready' && districtName && <span>{districtName}</span>}
          {districtStatus === 'ready' && !districtName && (
            <span className="text-amber-700">точка вне границ округов</span>
          )}
          {districtStatus === 'idle' && <span className="text-slate-500">выберите координату</span>}
          {districtStatus === 'error' && (
            <span className="text-red-600">не удалось определить</span>
          )}
          <span className="mt-0.5 block text-xs text-slate-500">
            Определяется автоматически по выбранной точке
          </span>
        </div>

        {mediaUploading && (
          <p className="text-sm font-medium text-amber-700" role="status">
            {MEDIA_UPLOAD_MESSAGE} — сохранение станет доступно автоматически.
          </p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex flex-col gap-3 pt-2 sm:flex-row">
          <button
            type="submit"
            disabled={busy || mediaUploading}
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {busy
              ? 'Сохраняем…'
              : mediaUploading
                ? 'Загрузка медиа…'
                : initial
                  ? 'Сохранить изменения'
                  : 'Создать объект'}
          </button>
          <button
            type="button"
            onClick={() => {
              if (dirty && !window.confirm('Есть несохранённые изменения. Уйти без сохранения?')) return
              router.push('/admin')
            }}
            className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm hover:bg-slate-100"
          >
            Отмена
          </button>
        </div>
      </div>
    </form>
  )
}
