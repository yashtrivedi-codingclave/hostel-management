import { create } from 'zustand'
import type { Account } from './database'
import { authenticate } from './service'

type AuthState = {
  account: Account | null
  ready: boolean
  restore: () => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => void
}

export const useAuth = create<AuthState>((set) => ({
  account: null,
  ready: false,
  restore: async () => {
    const id = localStorage.getItem('haven-demo-session')
    if (id) {
      const account = await import('./database').then(({ db }) => db.accounts.get(id))
      if (account?.active) set({ account })
      else localStorage.removeItem('haven-demo-session')
    }
    set({ ready: true })
  },
  signIn: async (email, password) => {
    const account = await authenticate(email, password)
    localStorage.setItem('haven-demo-session', account.id)
    set({ account })
  },
  signOut: () => {
    localStorage.removeItem('haven-demo-session')
    set({ account: null })
  },
}))
