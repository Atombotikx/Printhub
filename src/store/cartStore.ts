import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { createClient } from '@/utils/supabase/client'
import { uploadModelToStorage } from '@/utils/uploadModel'
import { getFileFromDB, deleteFileFromDB } from '@/utils/db'

function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID()
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8)
        return v.toString(16)
    })
}

export interface CartItem {
    id: string
    fileName: string
    fileUrl: string
    material: string
    color: string
    quantity: number
    price: number
    volume: number
    weight: number
    dimensions: { x: number; y: number; z: number }
    layerHeight: number
    infill: number
    supportType: string
    supportMaterial?: string
    brim?: boolean
    brand?: string
    infillPattern?: string
    amsColors?: string[]
    amsBrands?: string[]
    file?: File
}

interface CartState {
    items: CartItem[]
    addItem: (item: CartItem) => Promise<void>
    removeItem: (id: string) => Promise<void>
    updateQuantity: (id: string, quantity: number) => Promise<void>
    updateItem: (id: string, updates: Partial<CartItem>) => Promise<void>
    clearCart: () => Promise<void>
    getTotal: () => number
    lastInteraction: number
    syncToSupabase: (userId?: string) => Promise<void>
    loadFromSupabase: (userId?: string) => Promise<void>
    clearCartFromSupabase: () => Promise<void>
    purge: () => void
    updateInteraction: () => void
}

export const useCartStore = create<CartState>()(
    persist(
        (set, get) => ({
            items: [],
            lastInteraction: Date.now(),

            updateInteraction: () => set({ lastInteraction: Date.now() }),

            addItem: async (item) => {
                get().updateInteraction()
                set((state) => ({ items: [...state.items, item] }))
                await get().syncToSupabase()
            },

            removeItem: async (id) => {
                get().updateInteraction()
                const itemToRemove = get().items.find(i => i.id === id)

                // If the item has a storage file, delete it
                if (itemToRemove?.fileUrl && !itemToRemove.fileUrl.startsWith('blob:')) {
                    try {
                        const supabase = createClient()
                        // Ensure we only delete from the prints bucket and user's own models folder
                        // Storage.remove expects an array of paths
                        await supabase.storage.from('prints').remove([itemToRemove.fileUrl])
                    } catch (e) {
                        console.error('Failed to delete storage file on item removal:', e)
                    }
                }

                set((state) => ({ items: state.items.filter((i) => i.id !== id) }))
                await get().syncToSupabase()
            },

            updateQuantity: async (id, quantity) => {
                get().updateInteraction()
                set((state) => ({
                    items: state.items.map((i) => (i.id === id ? { ...i, quantity } : i)),
                }))
                await get().syncToSupabase()
            },

            updateItem: async (id, updates) => {
                get().updateInteraction()
                set((state) => ({
                    items: state.items.map((i) => (i.id === id ? { ...i, ...updates } : i)),
                }))
                await get().syncToSupabase()
            },

            clearCart: async () => {
                get().updateInteraction()
                const itemsToDelete = get().items

                // Clear all storage files for current cart items
                const storagePaths = itemsToDelete
                    .filter(item => item.fileUrl && !item.fileUrl.startsWith('blob:'))
                    .map(item => item.fileUrl)

                if (storagePaths.length > 0) {
                    try {
                        const supabase = createClient()
                        await supabase.storage.from('prints').remove(storagePaths)
                    } catch (e) {
                        console.error('Failed to clear storage files on cart clear:', e)
                    }
                }

                set({ items: [] })
                await get().syncToSupabase()
            },

            getTotal: () => {
                const { items } = get()
                return items.reduce((total, item) => total + item.price, 0)
            },

            syncToSupabase: async (userId?: string) => {
                try {
                    const supabase = createClient()
                    let targetUserId = userId

                    if (!targetUserId) {
                        const { data: { user } } = await supabase.auth.getUser()
                        targetUserId = user?.id
                    }

                    if (!targetUserId) {
                        return // Not logged in, skip sync
                    }

                    let { items } = get()

                    // Ensure all existing items have proper UUIDs, otherwise Supabase insert will fail
                    let hasMigrations = false
                    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

                    const migratedItems = items.map(item => {
                        if (!uuidPattern.test(item.id)) {
                            hasMigrations = true
                            return { ...item, id: generateUUID() }
                        }
                        return item
                    })

                    if (hasMigrations) {
                        set({ items: migratedItems })
                        items = migratedItems
                    }

                    let hasUploads = false
                    const updatedItems = await Promise.all(items.map(async (item) => {
                        if (item.fileUrl.startsWith('blob:')) {
                            const fileToUpload = item.file || await getFileFromDB(item.id);

                            if (fileToUpload) {
                                try {
                                    const res = await uploadModelToStorage(fileToUpload)
                                    if (res !== 'unauthenticated') {
                                        hasUploads = true
                                        // Once uploaded to secure storage, we can remove the local IndexedDB copy
                                        await deleteFileFromDB(item.id);
                                        return { ...item, fileUrl: res, file: undefined }
                                    }
                                } catch (e) {
                                    // Ignore upload sync failures
                                }
                            }
                        }
                        return item
                    }))

                    if (hasUploads) {
                        set({ items: updatedItems })
                        items = updatedItems
                    }

                    // Delete all existing cart items for this user
                    const { error: deleteError } = await supabase
                        .from('cart_items')
                        .delete()
                        .eq('user_id', targetUserId)

                    if (deleteError) {
                        throw deleteError
                    }

                    // Insert current cart items
                    if (items.length > 0) {
                        const cartItemsToInsert = items.map(item => ({
                            id: item.id, // CRITICAL: maintain same ID as in the app!
                            user_id: targetUserId,
                            file_name: item.fileName,
                            file_url: item.fileUrl,
                            material: item.material,
                            color: item.color,
                            quantity: item.quantity,
                            price: item.price,
                            volume: item.volume,
                            weight: item.weight,
                            dimensions: item.dimensions,
                            layer_height: item.layerHeight,
                            infill: item.infill,
                            support_type: item.supportType,
                            support_material: item.supportMaterial || null,
                            brim: item.brim || false,
                            brand: item.brand || null,
                            infill_pattern: item.infillPattern || 'grid',
                            ams_colors: item.amsColors || [],
                            ams_brands: item.amsBrands || []
                        }))

                        const { error: insertError } = await supabase
                            .from('cart_items')
                            .insert(cartItemsToInsert)

                        if (insertError) throw insertError
                    }
                } catch (error: any) {
                    // Sync failed silently
                }



            },

            loadFromSupabase: async (userId?: string) => {
                try {
                    const supabase = createClient()
                    let targetUserId = userId

                    if (!targetUserId) {
                        const { data: { user } } = await supabase.auth.getUser()
                        targetUserId = user?.id
                    }

                    if (!targetUserId) return

                    const { data: cartItems, error } = await supabase
                        .from('cart_items')
                        .select('*')
                        .eq('user_id', targetUserId)

                    if (error) throw error

                    const localItems = get().items

                    if (cartItems && cartItems.length > 0) {
                        const dbItems: CartItem[] = cartItems.map((item: any) => ({
                            id: item.id,
                            fileName: item.file_name,
                            fileUrl: item.file_url,
                            material: item.material,
                            color: item.color,
                            quantity: item.quantity,
                            price: parseFloat(item.price),
                            volume: parseFloat(item.volume),
                            weight: parseFloat(item.weight),
                            dimensions: item.dimensions,
                            layerHeight: parseFloat(item.layer_height) || 0.2,
                            infill: item.infill || 20,
                            supportType: item.support_type || 'none',
                            supportMaterial: item.support_material || undefined,
                            brim: typeof item.brim === 'boolean' ? item.brim : false,
                            brand: item.brand || '',
                            infillPattern: item.infill_pattern || 'grid',
                            amsColors: item.ams_colors || [],
                            amsBrands: item.ams_brands || [],
                        }))

                        const mergedItems = [...dbItems]
                        let hasNewLocal = false

                        for (const local of localItems) {
                            const isDuplicate = dbItems.some(db =>
                                (db.fileUrl === local.fileUrl && db.price === local.price) ||
                                db.id === local.id
                            )
                            if (!isDuplicate) {
                                mergedItems.push(local)
                                hasNewLocal = true
                            }
                        }


                        if (hasNewLocal) {
                            set({ items: mergedItems })
                            await get().syncToSupabase(targetUserId)
                        } else {
                            set({ items: dbItems })
                        }
                    } else if (localItems.length > 0) {
                        // DB is empty, but local has anonymous items -> sync up to newly logged in account!
                        await get().syncToSupabase(targetUserId)
                    } else {
                        set({ items: [] })
                    }
                } catch (error) {
                    // Fallback
                }
            },

            clearCartFromSupabase: async () => {
                try {
                    const supabase = createClient()
                    const { data: { user } } = await supabase.auth.getUser()

                    if (!user) return

                    // Delete all cart items for this user
                    await supabase
                        .from('cart_items')
                        .delete()
                        .eq('user_id', user.id)
                } catch (error) {
                    // Fail silently
                }
            },

            purge: () => {
                set({ items: [], lastInteraction: Date.now() });
                // The middleware will handle clearing the storage automatically 
                // because items is now empty. To be safe, we can also manually remove:
                localStorage.removeItem('cart-storage');
                sessionStorage.removeItem('cart-storage');
            },
        }),
        {
            name: 'cart-storage',
            onRehydrateStorage: () => (state) => {
                if (state) {
                    const GUEST_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes
                    const now = Date.now();

                    // Check if current data belongs to a guest (no auth user in other store)
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
            // Universal localStorage ensures survival across OAuth redirects.
            // Cleanup of guest data is handled by purge() on logout.
        }
    )
)
