import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface User {
    id: string
    name: string
    email: string
    image?: string
}

interface AuthState {
    user: User | null
    isAdmin: boolean
    isLoading: boolean
    setUser: (user: User | null, isAdmin: boolean) => void
    logout: () => void
    setLoading: (loading: boolean) => void
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            isAdmin: false,
            isLoading: true,
            setUser: (user, isAdmin) => set({ user, isAdmin, isLoading: false }),
            logout: () => set({ user: null, isAdmin: false, isLoading: false }),
            setLoading: (isLoading) => set({ isLoading }),
        }),
        {
            name: 'auth-storage',
            // Only persist user/admin status
            partialize: (state) => ({ user: state.user, isAdmin: state.isAdmin }),
        }
    )
)
