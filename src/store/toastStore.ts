import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
    id: string
    message: string
    type: ToastType
    duration?: number
}

interface ToastState {
    toasts: Toast[]
    addToast: (message: string, type: ToastType, duration?: number) => string
    removeToast: (id: string) => void
}

export const useToastStore = create<ToastState>((set) => ({
    toasts: [],
    addToast: (message, type, duration = 3000) => {
        const id = Math.random().toString(36).substring(7)
        set((state) => ({
            toasts: [...state.toasts, { id, message, type, duration }]
        }))

        // Auto-remove after duration
        if (duration > 0) {
            setTimeout(() => {
                set((state) => ({
                    toasts: state.toasts.filter((t) => t.id !== id)
                }))
            }, duration)
        }
        return id
    },
    removeToast: (id) => set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id)
    }))
}))
