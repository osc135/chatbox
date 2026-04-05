import { createStore, useStore } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

export interface TutorUser {
  id: string
  name: string
  email: string
  role: 'teacher' | 'student'
  grade?: string | null   // students only
  school?: string | null  // teachers only
}

interface TutorAuthState {
  token: string | null
  user: TutorUser | null
}

interface TutorAuthActions {
  setAuth: (token: string, user: TutorUser) => void
  clearAuth: () => void
}

export const tutorAuthStore = createStore<TutorAuthState & TutorAuthActions>()(
  persist(
    immer((set) => ({
      token: null,
      user: null,

      setAuth: (token, user) => {
        set((state) => {
          state.token = token
          state.user = user
        })
      },

      clearAuth: () => {
        set((state) => {
          state.token = null
          state.user = null
        })
      },
    })),
    {
      name: 'tutormeai-auth',
      version: 0,
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
)

export function useTutorAuth<U>(selector: Parameters<typeof useStore<typeof tutorAuthStore, U>>[1]) {
  return useStore(tutorAuthStore, selector)
}

export const useTutorUser = () => useTutorAuth((s) => s.user)
export const useTutorToken = () => useTutorAuth((s) => s.token)
export const useIsLoggedIn = () => useTutorAuth((s) => !!s.token)
