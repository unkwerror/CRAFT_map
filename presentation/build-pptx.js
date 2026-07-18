/**
 * CRAFT_map — investor / grant pitch deck
 * Minimal dark UI · map palette · high-res PNG 1920×1080 · no tech jargon
 */
const PptxGenJS = require('pptxgenjs');
const path = require('path');
const fs = require('fs');

const ROOT = __dirname;
const HI = path.join(ROOT, 'screenshots', 'hi');
const OUT = path.join(ROOT, 'CRAFT_map_Презентация_грант_16.07.2026.pptx');

const C = {
  bg: '0D1F30',
  surface: '102A43',
  surface2: '16324E',
  ink: 'E9F1F9',
  muted: '8FA3B5',
  subtle: '5C7388',
  accent: 'F0A93B',
  hairline: '243E58',
  green: '3BAFA8',
  red: 'E14B4B',
  purple: '8B7CC9',
};

const TOTAL = 19;
const SITE_URL = 'https://память.site';
// High-contrast QR (print-safe): navy on light — reliably scans
const QR_PATH = path.join(ROOT, 'QR_pamyat_site_print.png');

function img(name) {
  const p = path.join(HI, name);
  if (!fs.existsSync(p)) throw new Error('Missing: ' + name);
  return p;
}

const pres = new PptxGenJS();
pres.defineLayout({ name: 'LAYOUT_16x9', width: 10, height: 5.625 });
pres.layout = 'LAYOUT_16x9';
pres.author = 'CRAFT';
pres.title = 'CRAFT_map — питч: карта памяти Тюмени';
pres.subject = 'Что получает город, люди и партнёры проекта';

function bg(s) {
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 10, h: 5.625,
    fill: { color: C.bg }, line: { color: C.bg },
  });
}

function accentBar(s) {
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.08, h: 5.625,
    fill: { color: C.accent }, line: { color: C.accent },
  });
}

function label(s, text, y = 0.38) {
  s.addText(text, {
    x: 0.55, y, w: 9, h: 0.26,
    fontSize: 11, fontFace: 'Calibri', color: C.accent, bold: true,
    charSpacing: 2.5, margin: 0,
  });
}

function num(s, n) {
  s.addText(String(n), {
    x: 9.2, y: 5.22, w: 0.5, h: 0.26,
    fontSize: 11, fontFace: 'Calibri', color: C.subtle, align: 'right', margin: 0,
  });
}

function fullShot(s, name) {
  s.addImage({
    path: img(name),
    x: 0, y: 0, w: 10, h: 5.625,
    sizing: { type: 'cover', w: 10, h: 5.625 },
  });
}

function caption(s, title, sub) {
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 4.72, w: 10, h: 0.905,
    fill: { color: C.bg }, line: { color: C.bg },
  });
  s.addText(title, {
    x: 0.45, y: 4.82, w: 8.2, h: 0.34,
    fontSize: 16, fontFace: 'Calibri', color: C.ink, bold: true, margin: 0,
  });
  if (sub) {
    s.addText(sub, {
      x: 0.45, y: 5.16, w: 8.2, h: 0.28,
      fontSize: 12, fontFace: 'Calibri', color: C.muted, margin: 0,
    });
  }
}

function card(s, x, y, w, h, opts = {}) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x, y, w, h,
    fill: { color: opts.fill || C.surface },
    line: { color: opts.line || C.hairline, width: 1 },
    rectRadius: 0.1,
  });
}

function phone(s, name, x, y, h) {
  const w = h * (390 / 844);
  const pad = 0.055;
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x, y, w, h,
    fill: { color: '0A1624' },
    line: { color: C.hairline, width: 1.2 },
    rectRadius: 0.16,
  });
  s.addImage({
    path: img(name),
    x: x + pad, y: y + pad, w: w - pad * 2, h: h - pad * 2,
    sizing: { type: 'contain', w: w - pad * 2, h: h - pad * 2 },
  });
  return w;
}

// ═══════════════════════════════════════════════════════
// 1. TITLE
// ═══════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  bg(s); accentBar(s);
  s.addText('CRAFT_MAP', {
    x: 0.7, y: 1.35, w: 8.5, h: 0.28,
    fontSize: 12, fontFace: 'Calibri', color: C.accent, bold: true, charSpacing: 4, margin: 0,
  });
  s.addText('Карта, которая возвращает\nгороду его память', {
    x: 0.7, y: 1.8, w: 8.5, h: 1.25,
    fontSize: 32, fontFace: 'Calibri', color: C.ink, bold: true, margin: 0,
  });
  s.addText('Интерактивный сервис памятных мест Тюмени.\nУже работает. Масштабируется на другие города.', {
    x: 0.7, y: 3.25, w: 8, h: 0.65,
    fontSize: 15, fontFace: 'Calibri', color: C.muted, margin: 0,
  });
  s.addText('Питч для партнёров и грантовой поддержки  ·  2026', {
    x: 0.7, y: 5.0, w: 8, h: 0.28,
    fontSize: 12, fontFace: 'Calibri', color: C.subtle, margin: 0,
  });
  num(s, 1);
}

// ═══════════════════════════════════════════════════════
// 2. THE PROBLEM
// ═══════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  bg(s);
  label(s, 'ПРОБЛЕМА');
  s.addText('Памятники есть.\nСвязи с людьми — почти нет.', {
    x: 0.55, y: 0.75, w: 9, h: 1.0,
    fontSize: 28, fontFace: 'Calibri', color: C.ink, bold: true, margin: 0,
  });

  const probs = [
    { t: 'Информация разрознена', d: 'Данные в архивах, соцсетях и «у знающих». Найти историю места с телефона — сложно.' },
    { t: 'Молодёжь не вовлечена', d: 'Классические форматы «экскурсия + табличка» не держат внимание 20–35 лет.' },
    { t: 'Разрушение незаметно', d: 'Объекты ветшают, пока нет простого способа привлечь внимание и средства.' },
    { t: 'Нет единого окна', d: 'Туристу, учителю и НКО нужны разные вещи — и нигде они не собраны вместе.' },
  ];
  probs.forEach((p, i) => {
    const x = 0.55 + (i % 2) * 4.6;
    const y = 2.0 + Math.floor(i / 2) * 1.45;
    card(s, x, y, 4.4, 1.3);
    s.addText(p.t, {
      x: x + 0.28, y: y + 0.22, w: 3.9, h: 0.32,
      fontSize: 15, fontFace: 'Calibri', color: C.ink, bold: true, margin: 0,
    });
    s.addText(p.d, {
      x: x + 0.28, y: y + 0.58, w: 3.9, h: 0.55,
      fontSize: 12, fontFace: 'Calibri', color: C.muted, margin: 0,
    });
  });
  num(s, 2);
}

// ═══════════════════════════════════════════════════════
// 3. SOLUTION / WHAT YOU GET
// ═══════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  bg(s);
  label(s, 'РЕШЕНИЕ');
  s.addText('Одна карта — весь город\nв кармане', {
    x: 0.55, y: 0.75, w: 9, h: 0.95,
    fontSize: 28, fontFace: 'Calibri', color: C.ink, bold: true, margin: 0,
  });
  s.addText('Открываете сайт — и сразу видите памятные места, можете найти ближайшие,\nпослушать историю, построить маршрут и узнать, что происходит сегодня.', {
    x: 0.55, y: 1.85, w: 9, h: 0.65,
    fontSize: 15, fontFace: 'Calibri', color: C.muted, margin: 0,
  });

  const gets = [
    { n: '01', t: 'Понять город', d: '92+ точки с живыми историями' },
    { n: '02', t: 'Прийти на место', d: 'Маршрут и «рядом со мной»' },
    { n: '03', t: 'Услышать', d: 'Аудиогид + текст на экране' },
    { n: '04', t: 'Участвовать', d: 'События, поддержка, обратная связь' },
  ];
  gets.forEach((g, i) => {
    const x = 0.55 + i * 2.3;
    card(s, x, 2.8, 2.15, 2.0);
    s.addText(g.n, {
      x: x + 0.18, y: 3.0, w: 1.8, h: 0.28,
      fontSize: 12, fontFace: 'Calibri', color: C.accent, bold: true, margin: 0,
    });
    s.addText(g.t, {
      x: x + 0.18, y: 3.4, w: 1.8, h: 0.4,
      fontSize: 15, fontFace: 'Calibri', color: C.ink, bold: true, margin: 0,
    });
    s.addText(g.d, {
      x: x + 0.18, y: 3.9, w: 1.8, h: 0.55,
      fontSize: 12, fontFace: 'Calibri', color: C.muted, margin: 0,
    });
  });
  num(s, 3);
}

// ═══════════════════════════════════════════════════════
// 4. PRODUCT SHOT — MAP (full overview only)
// ═══════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  bg(s);
  fullShot(s, '01-map.png');
  caption(s, 'Весь город на одном экране', 'Цветные точки — разные смыслы: патриотизм, память, достоинство, преемственность');
  num(s, 4);
}

// ═══════════════════════════════════════════════════════
// 5. SEARCH — name + district (two distinct screenshots)
// ═══════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  bg(s);
  label(s, 'ПОИСК');
  s.addText('Нашёл за секунды', {
    x: 0.55, y: 0.72, w: 9, h: 0.38,
    fontSize: 24, fontFace: 'Calibri', color: C.ink, bold: true, margin: 0,
  });

  // Two equal 16:9 panels
  const pw = 4.55;
  const ph = pw * (9 / 16);
  const y = 1.35;

  // Left: by name
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 0.38, y: y - 0.02, w: pw + 0.04, h: ph + 0.04,
    fill: { color: C.surface }, line: { color: C.hairline }, rectRadius: 0.08,
  });
  s.addImage({
    path: img('02-search.png'),
    x: 0.4, y, w: pw, h: ph,
    sizing: { type: 'cover', w: pw, h: ph },
  });
  s.addText('По названию', {
    x: 0.4, y: y + ph + 0.14, w: pw, h: 0.28,
    fontSize: 14, fontFace: 'Calibri', color: C.accent, bold: true, margin: 0, align: 'center',
  });
  s.addText('«Вечный огонь» — сразу нужное место', {
    x: 0.4, y: y + ph + 0.42, w: pw, h: 0.28,
    fontSize: 12, fontFace: 'Calibri', color: C.muted, margin: 0, align: 'center',
  });

  // Right: by district
  const x2 = 5.05;
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: x2 - 0.02, y: y - 0.02, w: pw + 0.04, h: ph + 0.04,
    fill: { color: C.surface }, line: { color: C.hairline }, rectRadius: 0.08,
  });
  s.addImage({
    path: img('02b-search-district.png'),
    x: x2, y, w: pw, h: ph,
    sizing: { type: 'cover', w: pw, h: ph },
  });
  s.addText('По району', {
    x: x2, y: y + ph + 0.14, w: pw, h: 0.28,
    fontSize: 14, fontFace: 'Calibri', color: C.accent, bold: true, margin: 0, align: 'center',
  });
  s.addText('«Калининский» — округ и все места внутри', {
    x: x2, y: y + ph + 0.42, w: pw, h: 0.28,
    fontSize: 12, fontFace: 'Calibri', color: C.muted, margin: 0, align: 'center',
  });

  num(s, 5);
}

// ═══════════════════════════════════════════════════════
// 6. OBJECT CARD VALUE
// ═══════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  bg(s);
  fullShot(s, '03-card.png');
  caption(s, 'Не точка — история', 'Фото, рассказ, аудиогид, «избранное», маршрут до места');
  num(s, 6);
}

// ═══════════════════════════════════════════════════════
// 7. WHAT YOU HEAR / LEARN
// ═══════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  bg(s);
  label(s, 'ЧТО ПОЛУЧАЕТ ЧЕЛОВЕК');
  s.addText('Знание, которое остаётся', {
    x: 0.55, y: 0.75, w: 9, h: 0.45,
    fontSize: 26, fontFace: 'Calibri', color: C.ink, bold: true, margin: 0,
  });

  // left image
  const iw = 4.6;
  const ih = iw * (9 / 16);
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 0.53, y: 1.4, w: iw + 0.04, h: ih + 0.04,
    fill: { color: C.surface }, line: { color: C.hairline }, rectRadius: 0.08,
  });
  s.addImage({
    path: img('04-seo.png'),
    x: 0.55, y: 1.42, w: iw, h: ih,
    sizing: { type: 'cover', w: iw, h: ih },
  });

  const points = [
    { t: 'Можно слушать', d: 'Аудиогид у памятника — как личный экскурсовод' },
    { t: 'Можно читать', d: 'Тот же рассказ текстом: удобно и доступно' },
    { t: 'Можно сохранить', d: 'Отметить «хочу сюда» или «уже был»' },
    { t: 'Можно поделиться', d: 'Ссылка на место — в мессенджер или соцсеть' },
  ];
  points.forEach((p, i) => {
    const y = 1.42 + i * 0.85;
    s.addText(p.t, {
      x: 5.5, y, w: 4, h: 0.3,
      fontSize: 15, fontFace: 'Calibri', color: C.ink, bold: true, margin: 0,
    });
    s.addText(p.d, {
      x: 5.5, y: y + 0.3, w: 4, h: 0.35,
      fontSize: 13, fontFace: 'Calibri', color: C.muted, margin: 0,
    });
  });
  num(s, 7);
}

// ═══════════════════════════════════════════════════════
// 8. NEARBY + LIST
// ═══════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  bg(s);
  fullShot(s, '13-list.png');
  caption(s, '«Рядом со мной»', 'Телефон показывает ближайшие памятники — идеально для прогулки и урока на улице');
  num(s, 8);
}

// ═══════════════════════════════════════════════════════
// 9. EVENTS
// ═══════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  bg(s);
  fullShot(s, '14-events.png');
  caption(s, 'Город живой, не музейный', 'Афиша у памятников: 9 Мая, акции памяти, городские события — с датой и регистрацией');
  num(s, 9);
}

// ═══════════════════════════════════════════════════════
// 10. MOBILE
// ═══════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  bg(s);
  label(s, 'ВСЕГДА ПОД РУКОЙ');
  s.addText('С телефона — как задумано', {
    x: 0.55, y: 0.72, w: 9, h: 0.4,
    fontSize: 24, fontFace: 'Calibri', color: C.ink, bold: true, margin: 0,
  });

  const phones = [
    { f: '06-map-m.png', l: 'Карта' },
    { f: '07-list-m.png', l: 'Список' },
    { f: '09-card-m.png', l: 'История места' },
  ];
  const h = 3.75;
  const aspect = 390 / 844;
  const w = h * aspect;
  const gap = 0.4;
  const total = phones.length * w + (phones.length - 1) * gap;
  let x0 = (10 - total) / 2;
  phones.forEach((ph, i) => {
    const x = x0 + i * (w + gap);
    phone(s, ph.f, x, 1.3, h);
    s.addText(ph.l, {
      x, y: 5.15, w, h: 0.25,
      fontSize: 12, fontFace: 'Calibri', color: C.muted, align: 'center', margin: 0,
    });
  });
  num(s, 10);
}

// ═══════════════════════════════════════════════════════
// 11. AUDIENCES — who benefits
// ═══════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  bg(s);
  label(s, 'ДЛЯ КОГО');
  s.addText('Четыре аудитории — одна платформа', {
    x: 0.55, y: 0.75, w: 9, h: 0.45,
    fontSize: 24, fontFace: 'Calibri', color: C.ink, bold: true, margin: 0,
  });

  const aud = [
    { t: 'Житель', d: 'Узнать район, сохранить «свои» места, привести детей', c: C.accent },
    { t: 'Турист', d: 'Быстрый маршрут по смыслу города, а не по случайным точкам', c: C.green },
    { t: 'Молодёжь', d: 'Короткий формат, телефон, аудио, отметки, события', c: C.red },
    { t: 'НКО и город', d: 'Афиша, просвещение, сбор внимания к реставрации', c: C.purple },
  ];
  aud.forEach((a, i) => {
    const x = 0.55 + i * 2.3;
    card(s, x, 1.55, 2.15, 3.2);
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: 1.55, w: 2.15, h: 0.08,
      fill: { color: a.c }, line: { color: a.c },
    });
    s.addText(a.t, {
      x: x + 0.18, y: 1.95, w: 1.8, h: 0.45,
      fontSize: 16, fontFace: 'Calibri', color: C.ink, bold: true, margin: 0,
    });
    s.addText(a.d, {
      x: x + 0.18, y: 2.55, w: 1.8, h: 1.8,
      fontSize: 13, fontFace: 'Calibri', color: C.muted, margin: 0,
    });
  });
  num(s, 11);
}

// ═══════════════════════════════════════════════════════
// 12. INVESTOR / GRANT VALUE — what YOU get
// ═══════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  bg(s);
  label(s, 'ЧТО ПОЛУЧАЕТЕ ВЫ');
  s.addText('Не идея на бумаге —\nработающий актив', {
    x: 0.55, y: 0.75, w: 9, h: 0.95,
    fontSize: 26, fontFace: 'Calibri', color: C.ink, bold: true, margin: 0,
  });

  const vals = [
    { t: 'Готовый продукт', d: 'Сайт уже в сети. Можно показать, потрогать, привести пользователя сегодня.' },
    { t: 'Социальный эффект', d: 'Просвещение, патриотическое воспитание, туризм, забота о наследии — измеримые сценарии.' },
    { t: 'Контроль контента', d: 'Редакция ведёт карту сама: без зависимости от «чужих» платформ и их правил.' },
    { t: 'Масштаб', d: 'Модель Тюмени переносится на другие города — один подход, много территорий.' },
    { t: 'Доверие', d: 'Прозрачная история: что на карте, какие события, куда можно поддержать объект.' },
    { t: 'Медийность', d: 'Красивый экран для отчётов, презентаций, партнёров и СМИ.' },
  ];
  vals.forEach((v, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 0.55 + col * 3.1;
    const y = 1.95 + row * 1.55;
    card(s, x, y, 2.95, 1.4);
    s.addText(v.t, {
      x: x + 0.2, y: y + 0.22, w: 2.55, h: 0.32,
      fontSize: 14, fontFace: 'Calibri', color: C.accent, bold: true, margin: 0,
    });
    s.addText(v.d, {
      x: x + 0.2, y: y + 0.6, w: 2.55, h: 0.65,
      fontSize: 12, fontFace: 'Calibri', color: C.muted, margin: 0,
    });
  });
  num(s, 12);
}

// ═══════════════════════════════════════════════════════
// 13. TRACTION NUMBERS
// ═══════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  bg(s);
  label(s, 'СЕЙЧАС');
  s.addText('Цифры, которые уже есть', {
    x: 0.55, y: 0.75, w: 9, h: 0.45,
    fontSize: 24, fontFace: 'Calibri', color: C.ink, bold: true, margin: 0,
  });

  const stats = [
    { n: '92+', l: 'памятных места\nна карте' },
    { n: '4', l: 'смысловые линии\n(ценностные категории)' },
    { n: '1', l: 'живой сайт\nв продакшене' },
    { n: '∞', l: 'прогулок, уроков\nи маршрутов впереди' },
  ];
  stats.forEach((st, i) => {
    const x = 0.55 + i * 2.3;
    card(s, x, 1.6, 2.15, 2.5);
    s.addText(st.n, {
      x: x + 0.15, y: 2.0, w: 1.85, h: 0.7,
      fontSize: 36, fontFace: 'Calibri', color: C.accent, bold: true, align: 'center', margin: 0,
    });
    s.addText(st.l, {
      x: x + 0.2, y: 2.9, w: 1.75, h: 0.85,
      fontSize: 13, fontFace: 'Calibri', color: C.muted, align: 'center', margin: 0,
    });
  });
  s.addText('Контент наполняется редакцией. Платформа готова принимать истории, события и поддержку.', {
    x: 0.55, y: 4.5, w: 9, h: 0.45,
    fontSize: 13, fontFace: 'Calibri', color: C.subtle, margin: 0,
  });
  num(s, 13);
}

// ═══════════════════════════════════════════════════════
// 14. STORIES / showcase objects
// ═══════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  bg(s);
  label(s, 'ЛИЦА КАРТЫ');
  s.addText('Каждая точка — человеческая история', {
    x: 0.55, y: 0.72, w: 9, h: 0.4,
    fontSize: 22, fontFace: 'Calibri', color: C.ink, bold: true, margin: 0,
  });

  const faces = [
    { f: '04-seo.png', t: 'Вечный огонь', d: 'Память о войне — в центре города' },
    { f: '05-afgan.png', t: 'Воинам-афганцам', d: 'Современная история, живые смыслы' },
    { f: '11-ermak.png', t: 'Ермак', d: 'Основание и характер края' },
  ];
  faces.forEach((f, i) => {
    const x = 0.55 + i * 3.1;
    const w = 2.95;
    const h = w * (9 / 16);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: x - 0.02, y: 1.35, w: w + 0.04, h: h + 0.04,
      fill: { color: C.surface }, line: { color: C.hairline }, rectRadius: 0.08,
    });
    s.addImage({
      path: img(f.f),
      x, y: 1.37, w, h,
      sizing: { type: 'cover', w, h },
    });
    s.addText(f.t, {
      x, y: 1.45 + h, w, h: 0.35,
      fontSize: 14, fontFace: 'Calibri', color: C.ink, bold: true, margin: 0,
    });
    s.addText(f.d, {
      x, y: 1.8 + h, w, h: 0.4,
      fontSize: 12, fontFace: 'Calibri', color: C.muted, margin: 0,
    });
  });
  num(s, 14);
}

// ═══════════════════════════════════════════════════════
// 15. HOW IT WORKS FOR OPERATOR (simple)
// ═══════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  bg(s);
  label(s, 'КАК ЭТО ВЕДЁТСЯ');
  s.addText('Простая редакция — сильный результат', {
    x: 0.55, y: 0.72, w: 9, h: 0.4,
    fontSize: 22, fontFace: 'Calibri', color: C.ink, bold: true, margin: 0,
  });

  const iw = 5.0;
  const ih = iw * (9 / 16);
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 0.53, y: 1.35, w: iw + 0.04, h: ih + 0.04,
    fill: { color: C.surface }, line: { color: C.hairline }, rectRadius: 0.08,
  });
  s.addImage({
    path: img('12-admin.png'),
    x: 0.55, y: 1.37, w: iw, h: ih,
    sizing: { type: 'cover', w: iw, h: ih },
  });

  const steps = [
    { n: '1', t: 'Добавили место', d: 'Название, адрес, фото, рассказ' },
    { n: '2', t: 'Опубликовали', d: 'Сразу видно на карте города' },
    { n: '3', t: 'Привязали событие', d: 'Акция, дата, ссылка на запись' },
    { n: '4', t: 'Город пользуется', d: 'Поиск, маршруты, прогулки' },
  ];
  steps.forEach((st, i) => {
    const y = 1.4 + i * 0.85;
    s.addText(st.n, {
      x: 5.9, y, w: 0.4, h: 0.35,
      fontSize: 18, fontFace: 'Calibri', color: C.accent, bold: true, margin: 0,
    });
    s.addText(st.t, {
      x: 6.4, y, w: 3.1, h: 0.3,
      fontSize: 14, fontFace: 'Calibri', color: C.ink, bold: true, margin: 0,
    });
    s.addText(st.d, {
      x: 6.4, y: y + 0.3, w: 3.1, h: 0.3,
      fontSize: 12, fontFace: 'Calibri', color: C.muted, margin: 0,
    });
  });
  num(s, 15);
}

// ═══════════════════════════════════════════════════════
// 16. ROADMAP (human language)
// ═══════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  bg(s);
  label(s, 'КУДА РАСТЁМ');
  s.addText('От карты — к привычке города', {
    x: 0.55, y: 0.75, w: 9, h: 0.45,
    fontSize: 24, fontFace: 'Calibri', color: C.ink, bold: true, margin: 0,
  });

  const phases = [
    {
      t: 'Сейчас',
      items: ['Карта и истории', 'Поиск и маршруты', 'События', 'Редакция контента'],
    },
    {
      t: 'Ближайшее',
      items: ['QR у памятников', '2–3 «эталонных» места', 'Поддержка реставрации', 'Школьные маршруты'],
    },
    {
      t: 'Дальше',
      items: ['Квесты и викторины', 'Призы и вовлечение', 'Инициативы жителей', 'Другие города'],
    },
  ];
  phases.forEach((ph, i) => {
    const x = 0.55 + i * 3.1;
    card(s, x, 1.5, 2.95, 3.35);
    s.addText(ph.t, {
      x: x + 0.25, y: 1.75, w: 2.45, h: 0.4,
      fontSize: 16, fontFace: 'Calibri', color: i === 0 ? C.accent : C.ink, bold: true, margin: 0,
    });
    ph.items.forEach((it, j) => {
      s.addText('·  ' + it, {
        x: x + 0.25, y: 2.4 + j * 0.5, w: 2.45, h: 0.4,
        fontSize: 14, fontFace: 'Calibri', color: C.muted, margin: 0,
      });
    });
  });
  num(s, 16);
}

// ═══════════════════════════════════════════════════════
// 17. WHY SUPPORT / DIFFERENTIATION
// ═══════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  bg(s);
  label(s, 'ПОЧЕМУ ЭТО ВАЖНО');
  s.addText('Отличие, которое чувствуется', {
    x: 0.55, y: 0.75, w: 9, h: 0.45,
    fontSize: 24, fontFace: 'Calibri', color: C.ink, bold: true, margin: 0,
  });

  const diffs = [
    { t: 'Не «ещё одни карты»', d: 'Только память и смыслы города — без рекламного шума магазинов и кафе.' },
    { t: 'Не архив PDF', d: 'Интерактив: пошёл, нашёл, послушал, пришёл, отметил.' },
    { t: 'Не разовый проект', d: 'Платформа, которую можно наполнять годами и тиражировать.' },
    { t: 'Не чужой сервис', d: 'Данные и правила — у команды и города, а не у зарубежной платформы.' },
  ];
  diffs.forEach((d, i) => {
    const y = 1.45 + i * 0.9;
    s.addShape(pres.shapes.OVAL, {
      x: 0.6, y: y + 0.1, w: 0.22, h: 0.22,
      fill: { color: C.accent }, line: { color: C.accent },
    });
    s.addText(d.t, {
      x: 1.1, y, w: 8.2, h: 0.35,
      fontSize: 16, fontFace: 'Calibri', color: C.ink, bold: true, margin: 0,
    });
    s.addText(d.d, {
      x: 1.1, y: y + 0.35, w: 8.2, h: 0.35,
      fontSize: 14, fontFace: 'Calibri', color: C.muted, margin: 0,
    });
  });
  num(s, 17);
}

// ═══════════════════════════════════════════════════════
// 18. QR CODE — open the map
// ═══════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  bg(s);
  label(s, 'ОТКРОЙТЕ КАРТУ');
  s.addText('Наведите камеру телефона', {
    x: 0.55, y: 0.75, w: 5.2, h: 0.45,
    fontSize: 24, fontFace: 'Calibri', color: C.ink, bold: true, margin: 0,
  });
  s.addText('QR ведёт сразу на карту памятных мест Тюмени.\nМожно распечатать на стенде, в буклете или у объекта.', {
    x: 0.55, y: 1.35, w: 5.0, h: 0.7,
    fontSize: 14, fontFace: 'Calibri', color: C.muted, margin: 0,
  });

  card(s, 0.55, 2.3, 5.0, 2.35);
  s.addText('Адрес', {
    x: 0.85, y: 2.55, w: 4.4, h: 0.3,
    fontSize: 12, fontFace: 'Calibri', color: C.accent, bold: true, margin: 0,
  });
  s.addText(SITE_URL, {
    x: 0.85, y: 2.95, w: 4.4, h: 0.45,
    fontSize: 22, fontFace: 'Calibri', color: C.ink, bold: true, margin: 0,
  });
  s.addText('Работает с телефона и компьютера.\nБез установки приложения.', {
    x: 0.85, y: 3.55, w: 4.4, h: 0.7,
    fontSize: 13, fontFace: 'Calibri', color: C.muted, margin: 0,
  });

  // QR panel
  const qSize = 3.4;
  const qx = 6.2;
  const qy = 1.15;
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: qx - 0.15, y: qy - 0.15, w: qSize + 0.3, h: qSize + 0.55,
    fill: { color: C.surface },
    line: { color: C.hairline, width: 1 },
    rectRadius: 0.12,
  });
  s.addImage({
    path: QR_PATH,
    x: qx, y: qy, w: qSize, h: qSize,
    sizing: { type: 'contain', w: qSize, h: qSize },
  });
  s.addText('память.site', {
    x: qx, y: qy + qSize + 0.05, w: qSize, h: 0.28,
    fontSize: 13, fontFace: 'Calibri', color: C.muted, align: 'center', margin: 0,
  });
  num(s, 18);
}

// ═══════════════════════════════════════════════════════
// 19. ASK / CLOSE
// ═══════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  bg(s); accentBar(s);
  s.addText('С вами карта становится\nгородской привычкой', {
    x: 0.7, y: 1.05, w: 6.2, h: 1.1,
    fontSize: 28, fontFace: 'Calibri', color: C.ink, bold: true, margin: 0,
  });
  s.addText('Поддержка нужна, чтобы наполнить истории, выйти в поле с QR,\nзапустить вовлечение молодёжи и подготовить тираж на другие города.', {
    x: 0.7, y: 2.35, w: 6.0, h: 0.75,
    fontSize: 14, fontFace: 'Calibri', color: C.muted, margin: 0,
  });

  card(s, 0.7, 3.35, 5.8, 1.25);
  s.addText('Откройте карту', {
    x: 0.95, y: 3.55, w: 5.3, h: 0.3,
    fontSize: 13, fontFace: 'Calibri', color: C.accent, bold: true, margin: 0,
  });
  s.addText(SITE_URL, {
    x: 0.95, y: 3.95, w: 5.3, h: 0.4,
    fontSize: 20, fontFace: 'Calibri', color: C.ink, bold: true, margin: 0,
  });

  // mini QR
  const mq = 1.7;
  s.addImage({
    path: QR_PATH,
    x: 7.5, y: 1.5, w: mq, h: mq,
    sizing: { type: 'contain', w: mq, h: mq },
  });
  s.addText('Сканируйте', {
    x: 7.35, y: 3.3, w: 2.0, h: 0.3,
    fontSize: 12, fontFace: 'Calibri', color: C.muted, align: 'center', margin: 0,
  });

  s.addText('CRAFT  ·  Тюмень  ·  2026', {
    x: 0.7, y: 5.05, w: 8, h: 0.28,
    fontSize: 12, fontFace: 'Calibri', color: C.subtle, margin: 0,
  });
  num(s, 19);
}

pres
  .writeFile({ fileName: OUT })
  .then(() => {
    const mb = (fs.statSync(OUT).size / (1024 * 1024)).toFixed(1);
    console.log('Wrote', OUT, mb + 'MB', TOTAL, 'slides');
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
