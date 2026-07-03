import { join } from 'node:path'

/** Папка загрузок: /data/uploads в Docker, ../data/uploads в dev */
export const UPLOADS_DIR = process.env.UPLOADS_DIR ?? join(process.cwd(), '..', 'data', 'uploads')

/** Папка тайлов/глифов (dev-раздача; в проде это делает nginx) */
export const TILES_DIR = process.env.TILES_DIR ?? join(process.cwd(), '..', 'tiles', 'data')
