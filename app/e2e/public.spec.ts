import { expect, test, type APIRequestContext } from '@playwright/test'

interface ObjectFeatureCollection {
  features: { properties: { id: string; title: string } }[]
}

interface PublicEvent {
  id: string
  title: string
  objectId: string
  objectTitle: string
}

async function firstObject(request: APIRequestContext) {
  const response = await request.get('/api/objects')
  expect(response.ok()).toBeTruthy()
  const payload = await response.json() as ObjectFeatureCollection
  expect(payload.features.length).toBeGreaterThan(0)
  return payload.features[0]!.properties
}

test('карта загружается, поиск открывает и закрывает карточку памятника', async ({ page, request }) => {
  const object = await firstObject(request)
  await page.goto('/')

  await expect(page.getByRole('combobox', { name: 'Поиск по карте' })).toBeVisible()
  await expect(page.locator('.maplibregl-canvas')).toBeVisible()

  const search = page.getByRole('combobox', { name: 'Поиск по карте' })
  await search.fill(object.title)
  await page.getByRole('option').filter({ hasText: object.title }).first().click()

  const card = page.getByRole('dialog', { name: object.title })
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

  const objectCard = page.getByRole('dialog', { name: event.objectTitle })
  await expect(objectCard).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`[?&]object=${event.objectId}(?:&|$)`))

  await page.goBack()
  await expect(page.getByRole('heading', { name: 'Мероприятия', exact: true })).toBeVisible()
  await expect(page).toHaveURL(/[?&]view=events(?:&|$)/)

  await page.goForward()
  await expect(page.getByRole('dialog', { name: event.objectTitle })).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`[?&]object=${event.objectId}(?:&|$)`))

  await objectCard.getByRole('button', { name: 'Закрыть' }).click()
  await expect(page.locator('[data-map-mode-map]:visible')).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('heading', { name: 'Мероприятия', exact: true })).toBeHidden()
  await expect(page).not.toHaveURL(/[?&](?:view|object)=/)
})

test('афиша доступна с клавиатуры и имеет фильтры периода', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Мероприятия' }).click()
  await expect(page.getByRole('searchbox', { name: 'Найти мероприятие' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Сегодня' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Выходные' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Этот месяц' })).toBeVisible()
})

test('ссылка сохраняет открытую карточку и корректно восстанавливается после перезагрузки', async ({ page, request }) => {
  const object = await firstObject(request)
  await page.goto('/')

  const search = page.getByRole('combobox', { name: 'Поиск по карте' })
  await search.fill(object.title)
  await page.getByRole('option').filter({ hasText: object.title }).first().click()

  await expect(page).toHaveURL(new RegExp(`[?&]object=${object.id}(?:&|$)`))
  await page.reload()
  await expect(page.getByRole('dialog', { name: object.title })).toBeVisible()
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
