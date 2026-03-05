'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { User } from '@supabase/supabase-js'
import { useAdminStore } from '@/store/adminStore'
import { useAuthStore } from '@/store/authStore'
import { FilamentKey } from '@/utils/pricingEngine'
import styles from '../Admin.module.css'
import { Plus, Trash2, X, Edit2, Save, AlertTriangle, ChevronDown } from 'lucide-react'
import { useToastStore } from '@/store/toastStore'
import Loader from '@/components/Loader'
import CustomSelect from '@/components/CustomSelect'

import { useShallow } from 'zustand/react/shallow'

export default function AdminMaterialsPage() {
    const addToast = useToastStore((state) => state.addToast)
    const router = useRouter()
    const { user: authUser, isAdmin, isLoading: authLoading } = useAuthStore()

    const [loading, setLoading] = useState(true)
    const [isProcessing, setIsProcessing] = useState(false)
    const [localElec, setLocalElec] = useState<string>('')
    const [localMisc, setLocalMisc] = useState<string>('')
    const [localSupp, setLocalSupp] = useState<string>('')

    // Add Material State
    const [brandName, setBrandName] = useState('')
    const [materialType, setMaterialType] = useState('PLA')
    const [newMaterialType, setNewMaterialType] = useState('')
    const [newTypeDensity, setNewTypeDensity] = useState<string | number>(1.24)
    const [newTypeProperties, setNewTypeProperties] = useState({
        strength: 5 as string | number,
        flexibility: 5 as string | number,
        heatRes: 5 as string | number,
        durability: 5 as string | number
    })
    const [editingKey, setEditingKey] = useState<FilamentKey | null>(null)

    // Add Color State
    const [addingColorTo, setAddingColorTo] = useState<FilamentKey | null>(null)
    const [newColorHex, setNewColorHex] = useState('#ffffff')
    const [newColorPrice, setNewColorPrice] = useState<string | number>(0)

    // Confirmation states
    const [deletingMaterialKey, setDeletingMaterialKey] = useState<FilamentKey | null>(null)
    const [deletingType, setDeletingType] = useState<string | null>(null)
    const [deletingSupportType, setDeletingSupportType] = useState<string | null>(null)
    const [newSupportType, setNewSupportType] = useState('')

    const {
        filaments, updateFilament, addFilament, renameFilament, removeFilament,
        updateGlobalSettings, electricityRate, miscellaneousFee, supportMaterialPrice, updateColorPricing,
        addColorWithPricing, updateFilamentColors, updateColorHex,
        materialTypes, addMaterialType, removeMaterialType,
        supportTypes, addSupportType, removeSupportType,
        hasHydrated, fetchSettings
    } = useAdminStore(useShallow((state) => ({
        filaments: state.filaments,
        updateFilament: state.updateFilament,
        addFilament: state.addFilament,
        renameFilament: state.renameFilament,
        removeFilament: state.removeFilament,
        updateGlobalSettings: state.updateGlobalSettings,
        electricityRate: state.electricityRate,
        miscellaneousFee: state.miscellaneousFee,
        supportMaterialPrice: state.supportMaterialPrice,
        updateColorPricing: state.updateColorPricing,
        addColorWithPricing: state.addColorWithPricing,
        updateFilamentColors: state.updateFilamentColors,
        updateColorHex: state.updateColorHex,
        materialTypes: state.materialTypes,
        addMaterialType: state.addMaterialType,
        removeMaterialType: state.removeMaterialType,
        supportTypes: state.supportTypes,
        addSupportType: state.addSupportType,
        removeSupportType: state.removeSupportType,
        hasHydrated: state.hasHydrated,
        fetchSettings: state.fetchSettings
    })))

    useEffect(() => {
        if (!authLoading && !isAdmin) {
            router.push('/')
        } else if (!authLoading && isAdmin) {
            setLoading(false)
            fetchSettings()
        }
    }, [isAdmin, authLoading, router, fetchSettings])

    useEffect(() => {
        if (hasHydrated) {
            setLocalElec(electricityRate.toString())
            setLocalMisc(miscellaneousFee.toString())
            setLocalSupp(supportMaterialPrice.toString())
        }
    }, [hasHydrated, electricityRate, miscellaneousFee, supportMaterialPrice])

    const handleSaveFilament = async () => {
        if (!brandName || !materialType || isProcessing) return
        setIsProcessing(true)

        try {
            if (editingKey) {
                // Update existing
                const cleanBrand = brandName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
                const cleanType = materialType.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
                const newKey = `${cleanBrand}_${cleanType}` as FilamentKey

                if (newKey !== editingKey) {
                    // Key changed, rename it
                    if (filaments[newKey]) {
                        addToast('Material with this name already exists!', 'error')
                        setIsProcessing(false)
                        return
                    }
                    await renameFilament(editingKey, newKey)
                    await updateFilament(newKey, { brand: brandName, type: materialType })
                } else {
                    await updateFilament(editingKey, { brand: brandName, type: materialType })
                }
                setEditingKey(null)
            } else {
                // Auto-generate key: BRAND_TYPE (uppercase, underscores)
                const cleanBrand = brandName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
                const cleanType = materialType.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
                const key = `${cleanBrand}_${cleanType}` as FilamentKey

                // Check if key exists
                if (filaments[key]) {
                    addToast('Material with this generated key already exists!', 'error')
                    setIsProcessing(false)
                    return
                }

                await addFilament({
                    key,
                    pricePerGram: 0,
                    availableColors: [],
                    density: 1.24, // Fallback, fetched from Material Types dynamically
                    properties: { strength: 5, flexibility: 5, heatRes: 5, durability: 5 },
                    colorPricing: {},
                    brand: brandName,
                    type: materialType
                })
            }

            setBrandName('')
            setMaterialType(materialTypes[0]?.name || 'PLA')
            addToast('Material saved successfully!', 'success')
        } catch (err) {
            console.error('Failed to save material:', err)
            addToast('Error saving material. Please try again.', 'error')
        } finally {
            setIsProcessing(false)
        }
    }

    const startEditing = (key: FilamentKey) => {
        setEditingKey(key)
        const filament = filaments[key]
        setBrandName(filament.brand || '')
        setMaterialType(filament.type || 'PLA')
    }

    const cancelEditing = () => {
        setEditingKey(null)
        setBrandName('')
        setMaterialType(materialTypes[0]?.name || 'PLA')
    }

    const startAddColor = (key: FilamentKey) => {
        setAddingColorTo(key)
        setNewColorHex('#ffffff')
        setNewColorPrice(filaments[key].pricePerGram > 0 ? filaments[key].pricePerGram : 0)
    }

    const confirmAddColor = async (targetKey: FilamentKey) => {
        setIsProcessing(true)
        try {
            const priceVal = typeof newColorPrice === 'string' ? parseFloat(newColorPrice) || 0 : newColorPrice
            await addColorWithPricing(targetKey, newColorHex, priceVal)
            setAddingColorTo(null)
            addToast('Color added successfully!', 'success')
        } catch (err) {
            addToast('Failed to add color.', 'error')
        } finally {
            setIsProcessing(false)
        }
    }

    const cancelAddColor = () => {
        setAddingColorTo(null)
    }

    const handleRemoveColor = async (key: FilamentKey, color: string) => {
        const currentColors = filaments[key].availableColors || []
        await updateFilamentColors(key, currentColors.filter(c => c !== color))
    }

    if (loading || !authUser || !hasHydrated) {
        return <Loader text={!hasHydrated ? '🔄 Syncing Admin Data...' : '🔐 Verifying Access...'} />
    }

    return (
        <div className="container" style={{ maxWidth: '100%', padding: 0 }}>
            <h1 className="title-gradient" style={{ marginBottom: '32px' }}>Materials & Pricing</h1>

            <div className={styles.grid}>
                {/* Global Settings */}
                <section className={`${styles.section} glass`} style={{ gridColumn: '1 / -1' }}>
                    <h2>Pricing</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', maxWidth: '800px' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>Electricity Rate (₹/hr)</label>
                            <input
                                type="number"
                                value={localElec}
                                onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                onChange={(e) => setLocalElec(e.target.value)}
                                onBlur={async () => {
                                    const val = parseFloat(localElec) || 0
                                    if (val === electricityRate) return
                                    setIsProcessing(true)
                                    await updateGlobalSettings({ electricityRate: val })
                                    setIsProcessing(false)
                                }}
                                className={styles.numInput}
                                style={{ width: '100%' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>One-time Setup Fee (₹/print)</label>
                            <input
                                type="number"
                                value={localMisc}
                                onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                onChange={(e) => setLocalMisc(e.target.value)}
                                onBlur={async () => {
                                    const val = parseFloat(localMisc) || 0
                                    if (val === miscellaneousFee) return
                                    setIsProcessing(true)
                                    await updateGlobalSettings({ miscellaneousFee: val })
                                    setIsProcessing(false)
                                }}
                                className={styles.numInput}
                                style={{ width: '100%' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>Support Price (₹/g)</label>
                            <input
                                type="number"
                                step="any"
                                value={localSupp}
                                onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                onChange={(e) => setLocalSupp(e.target.value)}
                                onBlur={async () => {
                                    const val = parseFloat(localSupp) || 0
                                    if (val === supportMaterialPrice) return
                                    setIsProcessing(true)
                                    await updateGlobalSettings({ supportMaterialPrice: val })
                                    setIsProcessing(false)
                                }}
                                className={styles.numInput}
                                style={{ width: '100%' }}
                            />
                        </div>
                    </div>
                </section>

                {/* Filament Management */}
                <section className={`${styles.section} glass`} style={{ gridColumn: '1 / -1' }}>
                    <h2>Material Management</h2>

                    <div className={styles.addPrinterForm} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', alignItems: 'end' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <label style={{ fontSize: '0.8rem', opacity: 0.7, fontWeight: 600 }}>Brand</label>
                                <span style={{ fontSize: '0.65rem', opacity: 0.5 }}>Manufacturer</span>
                            </div>
                            <input
                                type="text"
                                placeholder="e.g. Bambu Lab"
                                value={brandName}
                                onChange={(e) => setBrandName(e.target.value)}
                                className={styles.input}
                                style={{ width: '100%', border: editingKey ? '1px solid #39ff14' : '' }}
                            />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <label style={{ fontSize: '0.8rem', opacity: 0.7, fontWeight: 600 }}>Material</label>
                                <span style={{ fontSize: '0.65rem', opacity: 0.5 }}>Polymers</span>
                            </div>
                            <CustomSelect
                                value={materialType}
                                options={(materialTypes || []).map(type => ({ value: type.name, label: type.name }))}
                                onChange={(val) => setMaterialType(val)}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button onClick={handleSaveFilament} className="btn" disabled={!brandName || !materialType} style={{ flex: 1, height: '48px', opacity: (!brandName || !materialType) ? 0.5 : 1 }}>
                                {editingKey ? <Save size={18} /> : <Plus size={18} />} {editingKey ? 'Save Changes' : 'Add Material'}
                            </button>
                            {editingKey && (
                                <button onClick={cancelEditing} className="btn secondary" style={{ height: '48px', background: 'rgba(255,255,255,0.1)' }}>
                                    <X size={18} />
                                </button>
                            )}
                        </div>
                    </div>



                    <div className={styles.tableContainer}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Brand</th>
                                    <th>Type</th>
                                    <th>Density & Properties</th>
                                    <th>Colors & Pricing</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(Object.keys(filaments) as FilamentKey[]).map((key) => (
                                    <tr key={key} style={{ outline: editingKey === key ? '1px solid #39ff14' : '', background: editingKey === key ? 'rgba(57, 255, 20, 0.02)' : '' }}>
                                        <td style={{ verticalAlign: 'top', paddingTop: '20px' }}>
                                            <div style={{ fontWeight: '700', color: 'white' }}>
                                                {filaments[key].brand || '—'}
                                            </div>
                                        </td>
                                        <td style={{ verticalAlign: 'top', paddingTop: '20px' }}>
                                            <div style={{ fontWeight: '800', color: 'white', fontFamily: 'monospace' }}>
                                                {filaments[key].type || key}
                                            </div>
                                        </td>
                                        <td style={{ verticalAlign: 'top', paddingTop: '20px' }}>
                                            <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>
                                                Density: <span style={{ color: '#39ff14' }}>{filaments[key].density || 1.24}</span>
                                            </div>
                                            {filaments[key].properties && (
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginTop: '8px', fontSize: '0.65rem' }}>
                                                    <span title="Strength">S: {filaments[key].properties!.strength}</span>
                                                    <span title="Flexibility">F: {filaments[key].properties!.flexibility}</span>
                                                    <span title="Heat Resistance">H: {filaments[key].properties!.heatRes}</span>
                                                    <span title="Durability">D: {filaments[key].properties!.durability}</span>
                                                </div>
                                            )}
                                        </td>
                                        <td>
                                            <div className={styles.colorGrid}>
                                                {(() => {
                                                    const isEditingRow = editingKey === key
                                                    return (
                                                        <>
                                                            {(filaments[key].availableColors || []).map((color) => (
                                                                <div key={color} style={{
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '10px',
                                                                    background: isEditingRow ? 'rgba(57, 255, 20, 0.05)' : 'rgba(255,255,255,0.05)',
                                                                    padding: '8px 12px',
                                                                    borderRadius: '12px',
                                                                    border: isEditingRow ? '1px solid rgba(57, 255, 20, 0.3)' : '1px solid rgba(255,255,255,0.1)',
                                                                    transition: 'all 0.2s'
                                                                }}>
                                                                    {isEditingRow ? (
                                                                        <input
                                                                            type="color"
                                                                            value={color}
                                                                            onChange={(e) => updateColorHex(key, color, e.target.value)}
                                                                            style={{ width: '28px', height: '28px', padding: 0, border: 'none', background: 'none', cursor: 'pointer', borderRadius: '8px' }}
                                                                            title="Edit Color Hex"
                                                                        />
                                                                    ) : (
                                                                        <div style={{ background: color, width: '28px', height: '28px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', flexShrink: 0 }} />
                                                                    )}

                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                        <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>₹</span>
                                                                        <input
                                                                            type="number"
                                                                            step="any"
                                                                            value={filaments[key].colorPricing?.[color] ?? ''}
                                                                            onChange={(e) => {
                                                                                const val = e.target.value === '' ? 0 : parseFloat(e.target.value)
                                                                                updateColorPricing(key, color, val)
                                                                            }}
                                                                            className={styles.numInput}
                                                                            disabled={!isEditingRow}
                                                                            style={{
                                                                                width: '60px',
                                                                                padding: '4px 8px',
                                                                                fontSize: '0.9rem',
                                                                                border: 'none',
                                                                                background: 'rgba(0,0,0,0.3)',
                                                                                cursor: isEditingRow ? 'text' : 'not-allowed',
                                                                                opacity: isEditingRow ? 1 : 0.6
                                                                            }}
                                                                        />
                                                                        <span style={{ fontSize: '0.7rem', opacity: 0.3 }}>/g</span>
                                                                    </div>

                                                                    <button
                                                                        onClick={() => handleRemoveColor(key, color)}
                                                                        disabled={!isEditingRow}
                                                                        style={{
                                                                            background: 'rgba(255, 0, 85, 0.1)',
                                                                            border: 'none',
                                                                            color: '#ff0055',
                                                                            cursor: isEditingRow ? 'pointer' : 'not-allowed',
                                                                            padding: '6px',
                                                                            borderRadius: '8px',
                                                                            display: 'flex',
                                                                            transition: 'all 0.2s',
                                                                            opacity: isEditingRow ? 1 : 0.3
                                                                        }}
                                                                        onMouseEnter={(e) => { if (isEditingRow) e.currentTarget.style.background = 'rgba(255,0,85,0.2)' }}
                                                                        onMouseLeave={(e) => { if (isEditingRow) e.currentTarget.style.background = 'rgba(255,0,85,0.1)' }}
                                                                        title="Remove Color"
                                                                    >
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                </div>
                                                            ))}

                                                            {addingColorTo === key ? (
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(57, 255, 20, 0.05)', padding: '6px 12px', borderRadius: '12px', border: '1px solid rgba(57, 255, 20, 0.3)' }}>
                                                                    <input
                                                                        type="color"
                                                                        value={newColorHex}
                                                                        onChange={(e) => setNewColorHex(e.target.value)}
                                                                        style={{ width: '28px', height: '28px', padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}
                                                                    />
                                                                    <input
                                                                        type="number"
                                                                        step="any"
                                                                        placeholder="Price/g"
                                                                        value={newColorPrice}
                                                                        onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                                                        onChange={(e) => setNewColorPrice(e.target.value)}
                                                                        className={styles.numInput}
                                                                        style={{ width: '60px', padding: '4px 8px', fontSize: '0.9rem', border: 'none', background: 'rgba(0,0,0,0.3)' }}
                                                                    />
                                                                    <div style={{ display: 'flex', gap: '4px' }}>
                                                                        <button onClick={() => confirmAddColor(key)} style={{ color: '#39ff14', background: 'rgba(57,255,20,0.1)', border: 'none', borderRadius: '6px', cursor: 'pointer', padding: '6px', display: 'flex' }}><Plus size={14} /></button>
                                                                        <button onClick={cancelAddColor} style={{ color: '#ff0055', background: 'rgba(255,0,85,0.1)', border: 'none', borderRadius: '6px', cursor: 'pointer', padding: '6px', display: 'flex' }}><X size={14} /></button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    onClick={() => startAddColor(key)}
                                                                    className={styles.addColorBtn}
                                                                    title="Add Color"
                                                                    disabled={!isEditingRow}
                                                                    style={{
                                                                        opacity: isEditingRow ? 1 : 0.3,
                                                                        cursor: isEditingRow ? 'pointer' : 'not-allowed'
                                                                    }}
                                                                >
                                                                    <Plus size={18} />
                                                                </button>
                                                            )}
                                                        </>
                                                    )
                                                })()}
                                            </div>
                                        </td>
                                        <td style={{ verticalAlign: 'top', paddingTop: '20px', position: 'relative' }}>
                                            <div style={{ display: 'flex', gap: '12px' }}>
                                                <button onClick={() => startEditing(key)} className={styles.editBtn} title="Edit Name/Config">
                                                    <Edit2 size={18} />
                                                </button>
                                                <button onClick={() => setDeletingMaterialKey(key)} className={styles.deleteBtn} title="Delete Full Material">
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>

                                            {deletingMaterialKey === key && (
                                                <div style={{
                                                    position: 'absolute', inset: 0, zIndex: 10,
                                                    background: 'rgba(255,0,85,0.95)', backdropFilter: 'blur(5px)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
                                                    animation: 'fadeIn 0.2s ease', color: 'white'
                                                }}>
                                                    <div style={{ fontWeight: 800, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <AlertTriangle size={18} /> Delete material?
                                                    </div>
                                                    <button onClick={() => setDeletingMaterialKey(null)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                                                    <button onClick={() => { removeFilament(key); setDeletingMaterialKey(null); addToast('Material removed', 'info') }} style={{ background: 'white', border: 'none', color: '#ff0055', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 800 }}>Delete</button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* Material Types Configuration */}
                <section className={`${styles.section} glass`} style={{ gridColumn: '1 / -1' }}>
                    <h2>Configure Material Types</h2>
                    <p style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: '16px' }}>Add or remove material types that appear in the dropdown (e.g. PLA, PLA+, PETG).</p>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
                        {(materialTypes || []).map(type => (
                            <div key={type.name} style={{ position: 'relative' }}>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    background: 'rgba(255,255,255,0.05)',
                                    padding: '6px 12px',
                                    borderRadius: '20px',
                                    border: '1px solid rgba(255,255,255,0.1)'
                                }}>
                                    <span style={{ fontSize: '0.9rem' }}>{type.name}</span>
                                    <button
                                        onClick={() => setDeletingType(type.name)}
                                        style={{ background: 'none', border: 'none', color: '#ff0055', cursor: 'pointer', display: 'flex', padding: '2px' }}
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                                {deletingType === type.name && (
                                    <div style={{
                                        position: 'absolute',
                                        left: '0',
                                        top: '0',
                                        height: '100%',
                                        width: 'max-content',
                                        minWidth: '100%',
                                        zIndex: 20,
                                        background: '#ff0055',
                                        borderRadius: '20px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        animation: 'fadeIn 0.2s ease, scaleIn 0.2s ease',
                                        color: 'white',
                                        padding: '0 12px',
                                        boxShadow: '0 4px 12px rgba(255, 0, 85, 0.4)'
                                    }}>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 800, whiteSpace: 'nowrap' }}>Remove {type.name}?</span>
                                        <button onClick={() => setDeletingType(null)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '2px', display: 'flex' }}><X size={14} /></button>
                                        <button onClick={async () => {
                                            setIsProcessing(true)
                                            await removeMaterialType(type.name)
                                            setDeletingType(null)
                                            setIsProcessing(false)
                                            addToast(`${type.name} removed`, 'info')
                                        }} style={{ background: 'white', border: 'none', color: '#ff0055', borderRadius: '4px', padding: '2px 8px', fontSize: '0.7rem', fontWeight: 900, cursor: 'pointer' }}>Yes</button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '600px', background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px' }}>
                        <div>
                            <label style={{ fontSize: '0.8rem', opacity: 0.8 }}>Material Type Name</label>
                            <input
                                type="text"
                                placeholder="New Material Type (e.g. TPU-CF)"
                                value={newMaterialType}
                                onChange={(e) => setNewMaterialType(e.target.value)}
                                className={styles.input}
                                style={{ width: '100%', marginTop: '8px' }}
                            />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.8rem', opacity: 0.8 }}>Density (g/cm³)</label>
                            <input
                                type="number"
                                step="any"
                                value={newTypeDensity}
                                onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                onChange={(e) => setNewTypeDensity(e.target.value)}
                                className={styles.input}
                                style={{ width: '100%', marginTop: '8px' }}
                            />
                        </div>

                        <div>
                            <h3 style={{ fontSize: '0.8rem', opacity: 0.8, marginBottom: '12px' }}>Physical Properties (1-10)</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                                {(['strength', 'flexibility', 'heatRes', 'durability'] as (keyof typeof newTypeProperties)[]).map((prop) => (
                                    <div key={prop} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <label style={{ fontSize: '0.75rem', opacity: 0.6, textTransform: 'capitalize' }}>
                                            {prop === 'heatRes' ? 'Heat Resistance' : prop}: <span style={{ color: '#39ff14' }}>{newTypeProperties[prop]}</span>
                                        </label>
                                        <input
                                            type="number"
                                            value={newTypeProperties[prop]}
                                            onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                            onChange={(e) => setNewTypeProperties({ ...newTypeProperties, [prop]: e.target.value })}
                                            className={styles.numInput}
                                            style={{ width: '100%', padding: '8px 12px' }}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <button
                            onClick={async () => {
                                if (newMaterialType && !isProcessing) {
                                    setIsProcessing(true)
                                    try {
                                        const materialTypeData = {
                                            name: newMaterialType,
                                            density: typeof newTypeDensity === 'string' ? parseFloat(newTypeDensity) || 0 : newTypeDensity,
                                            properties: {
                                                strength: typeof newTypeProperties.strength === 'string' ? parseInt(newTypeProperties.strength) || 1 : newTypeProperties.strength,
                                                flexibility: typeof newTypeProperties.flexibility === 'string' ? parseInt(newTypeProperties.flexibility) || 1 : newTypeProperties.flexibility,
                                                heatRes: typeof newTypeProperties.heatRes === 'string' ? parseInt(newTypeProperties.heatRes) || 1 : newTypeProperties.heatRes,
                                                durability: typeof newTypeProperties.durability === 'string' ? parseInt(newTypeProperties.durability) || 1 : newTypeProperties.durability
                                            }
                                        }
                                        await addMaterialType(materialTypeData)
                                        setNewMaterialType('')
                                        setNewTypeDensity(1.24)
                                        setNewTypeProperties({ strength: 5, flexibility: 5, heatRes: 5, durability: 5 })
                                        addToast(`${newMaterialType} added`, 'success')
                                    } catch (err: any) {
                                        console.error('Failed to add material type:', err)
                                        addToast(err.message || 'Error adding material type', 'error')
                                    } finally {
                                        setIsProcessing(false)
                                    }
                                }
                            }}
                            className="btn"
                            disabled={!newMaterialType || isProcessing}
                            style={{ alignSelf: 'flex-start' }}
                        >
                            {isProcessing ? 'Adding...' : 'Add Type With Properties'}
                        </button>
                    </div>
                </section>

                {/* Support Types Configuration */}
                <section className={`${styles.section} glass`} style={{ gridColumn: '1 / -1' }}>
                    <h2>Configure Support Types</h2>
                    <p style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: '16px' }}>Add or remove support types (e.g. Standard, Tree, Dissolvable).</p>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
                        {(supportTypes || []).map(type => (
                            <div key={type} style={{ position: 'relative' }}>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    background: 'rgba(255,255,255,0.05)',
                                    padding: '6px 12px',
                                    borderRadius: '20px',
                                    border: '1px solid rgba(255,255,255,0.1)'
                                }}>
                                    <span style={{ fontSize: '0.9rem' }}>{type}</span>
                                    <button
                                        onClick={() => setDeletingSupportType(type)}
                                        style={{ background: 'none', border: 'none', color: '#ff0055', cursor: 'pointer', display: 'flex', padding: '2px' }}
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                                {deletingSupportType === type && (
                                    <div style={{
                                        position: 'absolute',
                                        left: '0',
                                        top: '0',
                                        height: '100%',
                                        width: 'max-content',
                                        minWidth: '100%',
                                        zIndex: 20,
                                        background: '#ff0055',
                                        borderRadius: '20px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        animation: 'fadeIn 0.2s ease, scaleIn 0.2s ease',
                                        color: 'white',
                                        padding: '0 12px',
                                        boxShadow: '0 4px 12px rgba(255, 0, 85, 0.4)'
                                    }}>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 800, whiteSpace: 'nowrap' }}>Remove {type}?</span>
                                        <button onClick={() => setDeletingSupportType(null)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '2px', display: 'flex' }}><X size={14} /></button>
                                        <button onClick={async () => {
                                            setIsProcessing(true)
                                            await removeSupportType(type)
                                            setDeletingSupportType(null)
                                            setIsProcessing(false)
                                            addToast(`${type} removed`, 'info')
                                        }} style={{ background: 'white', border: 'none', color: '#ff0055', borderRadius: '4px', padding: '2px 8px', fontSize: '0.7rem', fontWeight: 900, cursor: 'pointer' }}>Yes</button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'flex', gap: '10px', maxWidth: '400px' }}>
                        <input
                            type="text"
                            placeholder="New Support Type (e.g. Organic)"
                            value={newSupportType}
                            onChange={(e) => setNewSupportType(e.target.value)}
                            className={styles.input}
                            style={{ flex: 1 }}
                        />
                        <button
                            onClick={async () => {
                                if (newSupportType && !isProcessing) {
                                    setIsProcessing(true)
                                    await addSupportType(newSupportType)
                                    setNewSupportType('')
                                    setIsProcessing(false)
                                    addToast(`${newSupportType} added`, 'success')
                                }
                            }}
                            className="btn"
                            disabled={!newSupportType || isProcessing}
                        >
                            {isProcessing ? 'Adding...' : 'Add Type'}
                        </button>
                    </div>
                </section>
            </div>
        </div>
    )
}
