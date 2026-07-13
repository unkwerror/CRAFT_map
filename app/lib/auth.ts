import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { compare } from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from './db'
import { users } from './schema'

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 },
  jwt: { maxAge: 8 * 60 * 60 },
  trustHost: true,
  secret: process.env.AUTH_SECRET ?? (process.env.NODE_ENV !== 'production' ? 'dev-secret' : undefined),
  pages: { signIn: '/admin/login' },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials)
        if (!parsed.success) return null
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, parsed.data.email.toLowerCase()))
        if (!user) return null
        const ok = await compare(parsed.data.password, user.passwordHash)
        if (!ok) return null
        return { id: user.id, email: user.email, role: user.role }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id
        token.role = (user as { role?: string }).role
      }
      return token
    },
    session({ session, token }) {
      session.user.id = (token.uid as string | undefined) ?? ''
      session.user.role = token.role === 'admin' ? 'admin' : 'editor'
      return session
    },
  },
})
