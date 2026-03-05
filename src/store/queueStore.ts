import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface QueueItem {
    id: string
    file: File
    fileName: string
    fileUrl: string
    size: number
    uploadProgress: number
    status: 'uploading' | 'pending' | 'configured'
    configuredId?: string // Link to cart item if configured
}

interface QueueState {
    items: QueueItem[]
    addToQueue: (item: QueueItem) => void
    removeFromQueue: (id: string) => void
    updateQueueItem: (id: string, updates: Partial<QueueItem>) => void
    clearQueue: () => void
    getPendingCount: () => number
    purge: () => void
    lastInteraction: number
    updateInteraction: () => void
}

export const useQueueStore = create<QueueState>()(
    persist(
        (set, get) => ({
            items: [],
            lastInteraction: Date.now(),
            updateInteraction: () => set({ lastInteraction: Date.now() }),

            addToQueue: (item) => {
                get().updateInteraction()
                set((state) => ({ items: [...state.items, item] }))
            },
            removeFromQueue: (id) => {
                get().updateInteraction()
                set((state) => ({ items: state.items.filter((i) => i.id !== id) }))
            },
            updateQueueItem: (id, updates) => {
                get().updateInteraction()
                set((state) => ({
                    items: state.items.map((i) => (i.id === id ? { ...i, ...updates } : i)),
                }))
            },
            clearQueue: () => set({ items: [] }),
            getPendingCount: () => {
                const { items } = get()
                return items.filter(i => i.status === 'pending').length
            },
            purge: () => {
                set({ items: [], lastInteraction: Date.now() });
                localStorage.removeItem('queue-storage');
                sessionStorage.removeItem('queue-storage');
            }
        }),
        {
            name: 'queue-storage',
            storage: createJSONStorage(() => sessionStorage),
            onRehydrateStorage: () => (state) => {
                if (state) {
                    const GUEST_EXPIRY_MS = 30 * 60 * 1000;
                    const now = Date.now();
                    const authData = localStorage.getItem('auth-storage');
                    const user = authData ? JSON.parse(authData).state?.user : null;

                    if (!user && state.items.length > 0) {
                        const timeSinceInteraction = now - state.lastInteraction;
                        if (timeSinceInteraction > GUEST_EXPIRY_MS) {
                            state.purge();
                        }
                    }
                }
            },
            // File objects and Blob URLs don't survive refresh well in localStorage/sessionStorage
            partialize: (state) => ({
                items: state.items.map(({ file, ...rest }) => ({ ...rest }))
            }) as any,
        }
    )
)
