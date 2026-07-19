import { expect, test, type APIRequestContext } from '@playwright/test'

interface ObjectFeatureCollection {
  features: { properties: { id: string; title: string } }[]
}

interface PublicObject {
  id: string
  title: string
  audioText: string | null
}

interface PublicEvent {
  id: string
  title: string
  objectId: string
  objectTitle: string
}

interface PublicRouteSummary { slug: string; title: string }

async function firstObject(request: APIRequestContext) {
  const response = await request.get('/api/objects')
  expect(response.ok()).toBeTruthy()
  const payload = await response.json() as ObjectFeatureCollection
  expect(payload.features.length).toBeGreaterThan(0)
  return payload.features[0]!.properties
}

function objectCard(page: import('@playwright/test').Page, title: string) {
  return page.locator('aside.object-sheet').filter({
    has: page.getByRole('heading', { name: title, exact: true }),
  })
}

test('карта загружается, поиск открывает и закрывает карточку памятника', async ({ page, request }) => {
  const object = await firstObject(request)
  await page.goto('/')

  await expect(page.getByRole('combobox', { name: 'Поиск по карте' })).toBeVisible()
  await expect(page.locator('.maplibregl-canvas')).toBeVisible()

  const search = page.getByRole('combobox', { name: 'Поиск по карте' })
  await search.fill(object.title)
  await page.getByRole('option').filter({ hasText: object.title }).first().click()

  const card = objectCard(page, object.title)
  await expect(card).toBeVisible()
  await card.getByRole('button', { name: 'Закрыть' }).click()
  await expect(card).toBeHidden()
})

test('Back/Forward восстанавливает афишу и памятник, а закрытие оставляет карту', async ({ page, request }) => {
  const response = await request.get('/api/events')
  expect(response.ok()).toBeTruthy()
  const events = await response.json() as PublicEvent[]
  test.skip(events.length === 0, 'В афише пока нет опубликованных мероприятий')
  const event = events[0]!

  await page.goto('/')
  await page.locator('[data-map-mode-events]:visible').click()
  await expect(page.getByRole('heading', { name: 'Мероприятия', exact: true })).toBeVisible()
  const card = page.getByRole('article').filter({ hasText: event.title }).first()
  await card.getByRole('button', { name: 'На карте' }).click()

  const objectSheet = objectCard(page, event.objectTitle)
  await expect(objectSheet).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`[?&]object=${event.objectId}(?:&|$)`))

  await page.goBack()
  await expect(page.getByRole('heading', { name: 'Мероприятия', exact: true })).toBeVisible()
  await expect(page).toHaveURL(/[?&]view=events(?:&|$)/)

  await page.goForward()
  await expect(objectCard(page, event.objectTitle)).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`[?&]object=${event.objectId}(?:&|$)`))

  await objectSheet.getByRole('button', { name: 'Закрыть' }).click()
  await expect(page.locator('[data-map-mode-map]:visible')).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('heading', { name: 'Мероприятия', exact: true })).toBeHidden()
  await expect(page).not.toHaveURL(/[?&](?:view|object)=/)
})

test('афиша доступна с клавиатуры и имеет фильтры периода', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Афиша' }).click()
  await expect(page.getByRole('searchbox', { name: 'Найти мероприятие' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Сегодня' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Выходные' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Этот месяц' })).toBeVisible()
})

test('карта, список и мероприятия доступны через одну навигацию', async ({ page }) => {
  await page.goto('/')
  const navigation = page.locator('.map-mode-nav:visible')

  await expect(navigation).toHaveCount(1)
  await expect(navigation.getByRole('button', { name: 'Карта' })).toBeVisible()
  await expect(navigation.getByRole('button', { name: 'Список' })).toBeVisible()
  await expect(navigation.getByRole('button', { name: 'Афиша' })).toBeVisible()
  await expect(page.locator('[data-places-view-toggle]')).toHaveCount(0)

  await navigation.getByRole('button', { name: 'Список' }).click()
  await expect(page.locator('[data-places-list-panel]')).toBeVisible()
  await expect(navigation.getByRole('button', { name: 'Список' })).toHaveAttribute('aria-current', 'page')

  await navigation.getByRole('button', { name: 'Карта' }).click()
  await expect(page.locator('[data-places-list-panel]')).toBeHidden()
  await expect(navigation.getByRole('button', { name: 'Карта' })).toHaveAttribute('aria-current', 'page')
})

test('ссылка сохраняет открытую карточку и корректно восстанавливается после перезагрузки', async ({ page, request }) => {
  const object = await firstObject(request)
  await page.goto('/')

  const search = page.getByRole('combobox', { name: 'Поиск по карте' })
  await search.fill(object.title)
  await page.getByRole('option').filter({ hasText: object.title }).first().click()

  await expect(page).toHaveURL(new RegExp(`[?&]object=${object.id}(?:&|$)`))
  await page.reload()
  await expect(objectCard(page, object.title)).toBeVisible()
})

test('избранное сохраняется в личном хранилище браузера и доступно в списке', async ({ page }) => {
  await page.goto('/?view=list')
  const panel = page.locator('[data-places-list-panel]')
  await expect(panel).toBeVisible()

  const firstPlace = panel.getByRole('listitem').first()
  const favoriteButton = firstPlace.getByRole('button', { name: /Добавить в избранное:/ })
  await favoriteButton.click()
  await expect(firstPlace.getByRole('button', { name: /Убрать из избранного:/ })).toBeVisible()

  await page.reload()
  await expect(panel).toBeVisible()
  await panel.getByRole('button', { name: /^Избранное 1$/ }).click()
  await expect(panel.getByRole('listitem')).toHaveCount(1)
  await expect(panel.getByRole('button', { name: /Убрать из избранного:/ })).toBeVisible()
})

test('отметка о посещении сохраняется после перезагрузки', async ({ page }) => {
  await page.goto('/?view=list')
  const panel = page.locator('[data-places-list-panel]')
  const firstPlace = panel.getByRole('listitem').first()

  await firstPlace.getByRole('button', { name: /Отметить посещённым:/ }).click()
  await expect(firstPlace.getByRole('button', { name: /Снять отметку о посещении:/ })).toBeVisible()

  await page.reload()
  await expect(panel.getByRole('button', { name: /^Посещено 1$/ })).toBeVisible()
  await panel.getByRole('button', { name: /^Посещено 1$/ }).click()
  await expect(panel.getByRole('listitem')).toHaveCount(1)
})

test('текст аудиогида доступен на прямой странице объекта', async ({ page, request }) => {
  const collectionResponse = await request.get('/api/objects')
  expect(collectionResponse.ok()).toBeTruthy()
  const collection = await collectionResponse.json() as ObjectFeatureCollection

  let objectWithTranscript: PublicObject | null = null
  for (const feature of collection.features) {
    const response = await request.get(`/api/objects/${feature.properties.id}`)
    if (!response.ok()) continue
    const object = await response.json() as PublicObject
    if (object.audioText) {
      objectWithTranscript = object
      break
    }
  }
  test.skip(!objectWithTranscript, 'У опубликованных объектов пока нет текста аудиогида')

  await page.goto(`/object/${objectWithTranscript!.id}`)
  const transcriptButton = page.getByRole('button', { name: 'Читать текст аудиогида' })
  await transcriptButton.click()
  await expect(page.getByText(objectWithTranscript!.audioText!, { exact: true })).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`/object/${objectWithTranscript!.id}$`))
})

test('человек находится поиском и ведёт к связанному месту', async ({ page, request }) => {
  const response = await request.get('/api/v1/people')
  expect(response.ok()).toBeTruthy()
  const people = await response.json() as { slug: string; name: string }[]
  test.skip(people.length === 0, 'Граф памяти выключен или нет опубликованных людей')

  let personName = ''
  let personSlug = ''
  let placeTitle = ''
  for (const candidate of people) {
    const detail = await request.get(`/api/v1/people/${candidate.slug}`)
    if (!detail.ok()) continue
    const payload = await detail.json() as { places: { title: string }[] }
    if (payload.places.length > 0) {
      personName = candidate.name
      personSlug = candidate.slug
      placeTitle = payload.places[0]!.title
      break
    }
  }
  test.skip(!personSlug, 'Нет опубликованного человека со связанным местом')

  await page.goto('/people')
  await page.getByRole('searchbox', { name: 'Поиск по имени' }).fill(personName)
  await page.getByRole('link').filter({ hasText: personName }).first().click()
  await expect(page.getByRole('heading', { name: personName })).toBeVisible()
  await page.getByRole('link', { name: placeTitle }).click()
  await expect(objectCard(page, placeTitle)).toBeVisible()
})

test('хронология и «тогда/сейчас» показываются в карточке места', async ({ page, request }) => {
  const collectionResponse = await request.get('/api/objects')
  expect(collectionResponse.ok()).toBeTruthy()
  const collection = await collectionResponse.json() as ObjectFeatureCollection

  let target: { id: string; title: string } | null = null
  let entryTitle = ''
  let hasPair = false
  for (const feature of collection.features) {
    const response = await request.get(`/api/v1/places/${feature.properties.id}/timeline`)
    if (!response.ok()) continue
    const entries = await response.json() as { title: string; media: { currentFileUrl: string | null }[] }[]
    if (entries.length > 0) {
      target = feature.properties
      entryTitle = entries[0]!.title
      hasPair = entries.some((entry) => entry.media.some((media) => media.currentFileUrl))
      break
    }
  }
  test.skip(!target, 'Хронология выключена или нет опубликованных записей')

  await page.goto(`/?object=${target!.id}`)
  const card = objectCard(page, target!.title)
  await expect(card).toBeVisible()
  await expect(card.getByRole('heading', { name: 'Хронология' })).toBeVisible()
  await expect(card.getByText(entryTitle).first()).toBeVisible()
  if (hasPair) {
    await expect(card.getByRole('slider', { name: /Сравнение архивного/ })).toBeVisible()
    await card.getByRole('button', { name: 'Показать фото отдельно' }).first().click()
    await expect(card.getByRole('img', { name: /^Тогда:/ }).first()).toBeVisible()
    await expect(card.getByRole('img', { name: /^Сейчас:/ }).first()).toBeVisible()
  }
})

test('маршрут проходит без GPS и восстанавливает прогресс', async ({ page, request }) => {
  const response = await request.get('/api/v1/routes')
  test.skip(response.status() === 404, 'Маршруты выключены feature flag')
  expect(response.ok()).toBeTruthy()
  const routes = await response.json() as PublicRouteSummary[]
  test.skip(routes.length === 0, 'Нет опубликованного fixture-маршрута')
  const route = routes[0]!

  await page.goto(`/routes/${route.slug}`)
  await expect(page.getByRole('heading', { name: route.title })).toBeVisible()
  await page.getByRole('button', { name: 'Я у объекта' }).click()
  await expect(page.getByRole('button', { name: 'Точка пройдена' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Точка пройдена' })).toBeVisible()
})
