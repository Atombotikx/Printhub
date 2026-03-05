import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { FilamentKey } from '@/utils/pricingEngine'
import {
    addPrinterAdmin,
    updatePrinterAdmin,
    deletePrinterAdmin,
    addMaterialAdmin,
    updateMaterialAdmin,
    deleteMaterialAdmin,
    addMaterialTypeAdmin,
    deleteMaterialTypeAdmin,
    addSupportTypeAdmin,
    deleteSupportTypeAdmin,
    updateSiteConfig
} from '@/app/admin/actions'

export interface Printer {
    id: string
    name: string
    type: string // e.g., 'FDM', 'SLA'
    status: 'available' | 'busy' | 'maintenance'
}

export interface MaterialTypeConfig {
    name: string
    density: number
    properties: {
        strength: number
        flexibility: number
        heatRes: number
        durability: number
    }
}

export interface Filament {
    key: FilamentKey
    pricePerGram: number // base price
    availableColors: string[]
    density: number // g/cm3
    brand: string
    type: string
    colorPricing?: Record<string, number> // color hex -> price per gram (optional override)
    properties?: {
        strength: number
        flexibility: number
        heatRes: number
        durability: number
    }
}

interface AdminState {
    filaments: Record<FilamentKey, Filament>
    printers: Printer[]
    electricityRate: number // INR per hour
    miscellaneousFee: number // INR per model
    supportMaterialPrice: number // INR per gram
    hasHydrated: boolean
    isFetching: boolean // Internal flag to prevent overlapping fetches
    materialTypes: MaterialTypeConfig[]
    supportTypes: string[]
    setHasHydrated: (val: boolean) => void
    setMaterialTypes: (types: MaterialTypeConfig[]) => void
    addMaterialType: (config: MaterialTypeConfig) => Promise<void>
    removeMaterialType: (type: string) => Promise<void>
    setSupportTypes: (types: string[]) => void
    addSupportType: (type: string) => Promise<void>
    removeSupportType: (type: string) => Promise<void>
    updateGlobalSettings: (settings: { electricityRate?: number, miscellaneousFee?: number, supportMaterialPrice?: number }) => Promise<void>
    updateFilamentPrice: (key: FilamentKey, price: number) => Promise<void>
    updateFilamentColors: (key: FilamentKey, colors: string[]) => Promise<void>
    updateColorPricing: (key: FilamentKey, color: string, price: number) => Promise<void>
    addColorWithPricing: (key: FilamentKey, color: string, price: number) => Promise<void>
    updateColorHex: (key: FilamentKey, oldHex: string, newHex: string) => Promise<void>
    updatePrinterStatus: (id: string, status: Printer['status']) => Promise<void>
    addPrinter: (printer: Printer) => Promise<void>
    updatePrinter: (id: string, updates: Partial<Printer>) => Promise<void>
    removePrinter: (id: string) => Promise<void>
    addFilament: (filament: Filament) => Promise<void>
    updateFilament: (key: FilamentKey, updates: Partial<Filament>) => Promise<void>
    renameFilament: (oldKey: FilamentKey, newKey: FilamentKey) => Promise<void>
    removeFilament: (key: FilamentKey) => Promise<void>
    fetchSettings: () => Promise<void>
}

export const useAdminStore = create<AdminState>()(
    persist(
        (set: any, get: any) => ({
            filaments: {} as Record<FilamentKey, Filament>,
            printers: [] as Printer[],
            electricityRate: 15,
            miscellaneousFee: 50,
            supportMaterialPrice: 1.5,
            hasHydrated: false as boolean,
            isFetching: false as boolean,
            materialTypes: [] as MaterialTypeConfig[],
            supportTypes: [] as string[],
            setHasHydrated: (hasHydrated: boolean) => set({ hasHydrated }),
            setMaterialTypes: (materialTypes: MaterialTypeConfig[]) => set({ materialTypes }),
            addMaterialType: async (config: MaterialTypeConfig) => {
                const { success, error } = await addMaterialTypeAdmin({
                    name: config.name,
                    density: config.density,
                    properties: config.properties
                })
                if (!success) {
                    throw new Error(error || 'Database operation failed')
                }
                set((state: AdminState) => ({ materialTypes: [...state.materialTypes, config] }))
            },
            removeMaterialType: async (type: string) => {
                const { success, error } = await deleteMaterialTypeAdmin(type)
                if (!success) {
                    throw new Error(error || 'Database operation failed')
                }
                set((state: AdminState) => ({ materialTypes: state.materialTypes.filter((t: MaterialTypeConfig) => t.name !== type) }))
            },
            setSupportTypes: (supportTypes: string[]) => set({ supportTypes }),
            addSupportType: async (type: string) => {
                const { addSupportTypeAdmin } = require('@/app/admin/actions')
                const { success, error } = await addSupportTypeAdmin(type)
                if (!success) {
                    console.error('Failed to insert support type:', error)
                    throw new Error(error || 'Database operation failed')
                }
                set((state: AdminState) => ({ supportTypes: [...state.supportTypes, type] }))
            },
            removeSupportType: async (type: string) => {
                const { deleteSupportTypeAdmin } = require('@/app/admin/actions')
                const { success, error } = await deleteSupportTypeAdmin(type)
                if (!success) {
                    console.error('Failed to remove support type:', error)
                    throw new Error(error || 'Database operation failed')
                }
                set((state: AdminState) => ({ supportTypes: state.supportTypes.filter((t: string) => t !== type) }))
            },

            updateGlobalSettings: async (settings: { electricityRate?: number, miscellaneousFee?: number, supportMaterialPrice?: number }) => {
                const promises = []
                if (settings.electricityRate !== undefined) promises.push(updateSiteConfig('electricity_rate', settings.electricityRate.toString()))
                if (settings.miscellaneousFee !== undefined) promises.push(updateSiteConfig('miscellaneous_fee', settings.miscellaneousFee.toString()))
                if (settings.supportMaterialPrice !== undefined) promises.push(updateSiteConfig('support_material_price', settings.supportMaterialPrice.toString()))

                const results = await Promise.all(promises)
                if (results.some(r => !r.success)) {
                    throw new Error('Failed to update global settings')
                }
                set((state: AdminState) => ({ ...state, ...settings }))
            },

            updateFilamentPrice: async (key: FilamentKey, price: number) => {
                const { updateMaterialAdmin } = require('@/app/admin/actions')
                const { success, error } = await updateMaterialAdmin(key, { price_per_gram: price })
                if (!success) {
                    console.error('Failed to update filament price:', error)
                    throw new Error(error || 'Database operation failed')
                }
                set((state: AdminState) => ({
                    filaments: {
                        ...state.filaments,
                        [key]: { ...state.filaments[key], pricePerGram: price }
                    }
                }))
            },
            updateFilamentColors: async (key: FilamentKey, colors: string[]) => {
                const { updateMaterialAdmin } = require('@/app/admin/actions')
                const { success, error } = await updateMaterialAdmin(key, { available_colors: colors })
                if (!success) {
                    console.error('Failed to update filament colors:', error)
                    throw new Error(error || 'Database operation failed')
                }
                set((state: AdminState) => ({
                    filaments: {
                        ...state.filaments,
                        [key]: { ...state.filaments[key], availableColors: colors }
                    }
                }))
            },
            updateColorPricing: async (key: FilamentKey, color: string, price: number) => {
                const current = get().filaments[key]
                if (!current) return
                const updatedPricing = { ...(current.colorPricing || {}), [color]: price }
                const { success, error } = await updateMaterialAdmin(key, { color_pricing: updatedPricing })
                if (!success) {
                    throw new Error(error || 'Database operation failed')
                }
                set((state: AdminState) => ({
                    filaments: {
                        ...state.filaments,
                        [key]: { ...state.filaments[key], colorPricing: updatedPricing }
                    }
                }))
            },
            addColorWithPricing: async (key: FilamentKey, color: string, price: number) => {
                const filament = get().filaments[key]
                if (!filament) return
                const updatedColors = filament.availableColors.includes(color) ? filament.availableColors : [...filament.availableColors, color]
                const updatedPricing = price > 0 ? { ...(filament.colorPricing || {}), [color]: price } : filament.colorPricing
                const { success, error } = await updateMaterialAdmin(key, { available_colors: updatedColors, color_pricing: updatedPricing })
                if (!success) {
                    throw new Error(error || 'Database operation failed')
                }
                set((state: AdminState) => ({
                    filaments: {
                        ...state.filaments,
                        [key]: { ...state.filaments[key], availableColors: updatedColors, colorPricing: updatedPricing }
                    }
                }))
            },
            updateColorHex: async (key: FilamentKey, oldHex: string, newHex: string) => {
                const filament = get().filaments[key]
                if (!filament) return
                const availableColors = filament.availableColors.map((c: string) => c === oldHex ? newHex : c)
                const colorPricing = { ...(filament.colorPricing || {}) }
                if (colorPricing[oldHex] !== undefined) {
                    colorPricing[newHex] = colorPricing[oldHex]
                    delete colorPricing[oldHex]
                }
                const { success, error } = await updateMaterialAdmin(key, { available_colors: availableColors, color_pricing: colorPricing })
                if (!success) {
                    throw new Error(error || 'Database operation failed')
                }
                set((state: AdminState) => ({
                    filaments: {
                        ...state.filaments,
                        [key]: { ...state.filaments[key], availableColors, colorPricing }
                    }
                }))
            },
            updatePrinterStatus: async (id: string, status: Printer['status']) => {
                const { success, error } = await updatePrinterAdmin(id, { status })
                if (!success) {
                    throw new Error(error || 'Database operation failed')
                }
                set((state: AdminState) => ({
                    printers: state.printers.map((p: Printer) => p.id === id ? { ...p, status } : p)
                }))
            },
            addPrinter: async (printer: Printer) => {
                const { success, error } = await addPrinterAdmin(printer)
                if (!success) {
                    throw new Error(error || 'Database operation failed')
                }
                set((state: AdminState) => ({ printers: [...state.printers, printer] }))
            },
            updatePrinter: async (id: string, updates: Partial<Printer>) => {
                const { success, error } = await updatePrinterAdmin(id, updates)
                if (!success) {
                    throw new Error(error || 'Database operation failed')
                }
                set((state: AdminState) => ({
                    printers: state.printers.map((p: Printer) => p.id === id ? { ...p, ...updates } : p)
                }))
            },
            removePrinter: async (id: string) => {
                const { success, error } = await deletePrinterAdmin(id)
                if (!success) {
                    throw new Error(error || 'Database operation failed')
                }
                set((state: AdminState) => ({ printers: state.printers.filter((p: Printer) => p.id !== id) }))
            },
            addFilament: async (filament: Filament) => {
                // `properties` and `density` are stored in the `material_types` table,
                // NOT in the `materials` table. Strip them before inserting.
                const { success, error } = await addMaterialAdmin({
                    key: filament.key,
                    brand: filament.brand,
                    type: filament.type,
                    price_per_gram: filament.pricePerGram,
                    available_colors: filament.availableColors,
                    color_pricing: filament.colorPricing,
                    // ↑ No `properties` or `density` here — they live in material_types
                })
                if (!success) {
                    throw new Error(error || 'Database operation failed')
                }
                set((state: AdminState) => ({ filaments: { ...state.filaments, [filament.key]: filament } }))
            },
            updateFilament: async (key: FilamentKey, updates: Partial<Filament>) => {
                const { createClient } = require('@/utils/supabase/client')
                const supabase = createClient()
                const dbUpdates: any = {}
                if (updates.pricePerGram !== undefined) dbUpdates.price_per_gram = updates.pricePerGram
                if (updates.brand !== undefined) dbUpdates.brand = updates.brand
                if (updates.type !== undefined) dbUpdates.type = updates.type
                // NOTE: `density` and `properties` live in `material_types`, not `materials`.
                // Do not include them here — they are fetched from material_types at runtime.

                if (Object.keys(dbUpdates).length > 0) {
                    const { success, error } = await updateMaterialAdmin(key, dbUpdates)
                    if (!success) {
                        throw new Error(error || 'Database operation failed')
                    }
                }
                set((state: AdminState) => ({
                    filaments: {
                        ...state.filaments,
                        [key]: { ...state.filaments[key], ...updates }
                    }
                }))
            },
            renameFilament: async (oldKey: FilamentKey, newKey: FilamentKey) => {
                const filament = get().filaments[oldKey]
                if (!filament) return
                const { success, error } = await updateMaterialAdmin(oldKey, { key: newKey })
                if (!success) {
                    throw new Error(error || 'Database operation failed')
                }
                set((state: AdminState) => {
                    const filaments = { ...state.filaments }
                    const data = { ...filaments[oldKey], key: newKey }
                    filaments[newKey] = data
                    delete filaments[oldKey]
                    return { filaments }
                })
            },
            removeFilament: async (key: FilamentKey) => {
                const { success, error } = await deleteMaterialAdmin(key)
                if (!success) {
                    throw new Error(error || 'Database operation failed')
                }
                set((state: AdminState) => {
                    const filaments = { ...state.filaments }
                    delete filaments[key]
                    return { filaments }
                })
            },
            fetchSettings: async () => {
                const state = get()
                if (state.isFetching) return // Already fetching - ignore

                set({ isFetching: true })
                try {
                    const { createClient } = await import('@/utils/supabase/client')
                    const supabase = createClient()
                    const [mRes, pRes, mtRes, stRes, cRes] = await Promise.all([
                        supabase.from('materials').select('*'),
                        supabase.from('printers').select('*'),
                        supabase.from('material_types').select('*'),
                        supabase.from('support_types').select('name'),
                        supabase.from('site_config').select('key, value')
                    ])

                    const filamentMap: Record<FilamentKey, Filament> = {}
                    if (mRes.data) {
                        mRes.data.forEach((m: any) => {
                            // Find the corresponding material type to get density and properties
                            const matType = mtRes.data?.find((t: any) => t.name === m.type)
                            filamentMap[m.key as FilamentKey] = {
                                key: m.key as FilamentKey,
                                brand: m.brand,
                                type: m.type,
                                pricePerGram: m.price_per_gram != null ? (Number(m.price_per_gram) || 0) : 0,
                                availableColors: Array.isArray(m.available_colors) ? m.available_colors : [],
                                colorPricing: typeof m.color_pricing === 'object' ? m.color_pricing : {},
                                // No fallbacks - use DB values only
                                density: matType?.density != null ? Number(matType.density) : 0,
                                properties: matType?.properties || null
                            }
                        })
                    }

                    const updates: any = {
                        filaments: filamentMap,
                        printers: (pRes.data || []).map((p: any) => ({
                            id: p.id,
                            name: p.name,
                            type: p.type,
                            status: p.status
                        })),
                        materialTypes: (mtRes.data || []).map((t: any) => ({
                            name: t.name,
                            density: t.density != null ? Number(t.density) : 0,
                            properties: t.properties || null
                        })),
                        supportTypes: (stRes.data || []).map((t: any) => t.name),
                        hasHydrated: true,
                        isFetching: false
                    }

                    if (cRes.data) {
                        cRes.data.forEach((c: any) => {
                            if (c.key === 'electricity_rate') updates.electricityRate = c.value != null ? (Number(c.value) || 0) : 0
                            if (c.key === 'miscellaneous_fee') updates.miscellaneousFee = c.value != null ? (Number(c.value) || 0) : 0
                            if (c.key === 'support_material_price') updates.supportMaterialPrice = c.value != null ? (Number(c.value) || 0) : 0
                        })
                    }
                    set(updates)
                } catch (err) {
                    console.error('CRITICAL: Fetch failed', err)
                    set({ hasHydrated: true, isFetching: false })
                }
            }
        }),
        {
            name: 'admin-storage',
            onRehydrateStorage: () => (state) => {
                state?.setHasHydrated(true)
            },
            partialize: (state: any) => {
                const { materialTypes, supportTypes, filaments, printers, hasHydrated, isFetching, ...rest } = state
                return rest
            }
        }
    )
)
