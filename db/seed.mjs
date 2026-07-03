// Сид: 4 категории (Указ № 809) и первичный администратор из ADMIN_EMAIL/ADMIN_PASSWORD.
import postgres from 'postgres'
import bcrypt from 'bcryptjs'

const url = process.env.DATABASE_URL ?? 'postgres://craft:craft@localhost:5433/craft_map'
const sql = postgres(url, { max: 1, onnotice: () => {} })

// Цвета — ориентировочные, заменить на значения из брендбука КРАФТ
const categories = [
  { id: 'patriotism', title: 'Патриотизм', color: '#E14B4B' },
  { id: 'memory', title: 'Историческая память', color: '#F0A93B' },
  { id: 'dignity', title: 'Достоинство', color: '#3BAFA8' },
  { id: 'continuity', title: 'Преемственность поколений', color: '#8B7CC9' },
]

try {
  for (const c of categories) {
    await sql`
      insert into categories (id, title, color) values (${c.id}, ${c.title}, ${c.color})
      on conflict (id) do update set title = excluded.title, color = excluded.color`
  }
  console.log('categories: ok')

  const email = process.env.ADMIN_EMAIL?.toLowerCase()
  const password = process.env.ADMIN_PASSWORD
  if (email && password) {
    const hash = bcrypt.hashSync(password, 12)
    // пароль существующего пользователя не перезаписываем
    const inserted = await sql`
      insert into users (email, password_hash, role) values (${email}, ${hash}, 'admin')
      on conflict (email) do nothing
      returning id`
    console.log(inserted.length ? `admin created: ${email}` : `admin exists: ${email}`)
  } else {
    console.log('ADMIN_EMAIL/ADMIN_PASSWORD not set — admin seed skipped')
  }
} finally {
  await sql.end()
}
