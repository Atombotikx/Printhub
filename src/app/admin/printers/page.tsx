'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { User } from '@supabase/supabase-js'
import { useAdminStore, Printer } from '@/store/adminStore'
import { useAuthStore } from '@/store/authStore'
import styles from '../Admin.module.css'
import { Plus, Trash2, Edit2, Save, X, AlertTriangle } from 'lucide-react'
import { useToastStore } from '@/store/toastStore'
import Loader from '@/components/Loader'

import { useShallow } from 'zustand/react/shallow'

export default function AdminPrintersPage() {
    const addToast = useToastStore((state) => state.addToast)
    const router = useRouter()
    const [loading, setLoading] = useState(true)

    const { printers, updatePrinterStatus, addPrinter, updatePrinter, removePrinter, fetchSettings } = useAdminStore(useShallow((state) => ({
        printers: state.printers,
        updatePrinterStatus: state.updatePrinterStatus,
        addPrinter: state.addPrinter,
        updatePrinter: state.updatePrinter,
        removePrinter: state.removePrinter,
        fetchSettings: state.fetchSettings
    })))
    const { user: authUser, isAdmin, isLoading: authLoading } = useAuthStore()
    const [newPrinterName, setNewPrinterName] = useState('')
    const [newPrinterType, setNewPrinterType] = useState('FDM')
    const [editingId, setEditingId] = useState<string | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [isProcessing, setIsProcessing] = useState(false)

    useEffect(() => {
        if (!authLoading && !isAdmin) {
            router.push('/')
        } else if (!authLoading && isAdmin) {
            setLoading(false)
            fetchSettings()
        }
    }, [isAdmin, authLoading, router, fetchSettings])

    const handleSavePrinter = async () => {
        if (!newPrinterName || isProcessing) return
        setIsProcessing(true)

        try {
            if (editingId) {
                await updatePrinter(editingId, {
                    name: newPrinterName,
                    type: newPrinterType
                })
                setEditingId(null)
                addToast('Printer updated', 'success')
            } else {
                await addPrinter({
                    id: crypto.randomUUID(),
                    name: newPrinterName,
                    type: newPrinterType,
                    status: 'available'
                })
                addToast('Printer added', 'success')
            }
            setNewPrinterName('')
        } catch (err) {
            addToast('Operation failed', 'error')
        } finally {
            setIsProcessing(false)
        }
    }

    const startEditing = (printer: Printer) => {
        setEditingId(printer.id)
        setNewPrinterName(printer.name)
        setNewPrinterType(printer.type)
    }

    const cancelEditing = () => {
        setEditingId(null)
        setNewPrinterName('')
        setNewPrinterType('FDM')
    }

    if (loading || !authUser) return <Loader text="Verifying access..." />

    return (
        <div className="container" style={{ maxWidth: '100%', padding: 0 }}>
            <h1 className="title-gradient" style={{ marginBottom: '32px' }}>Printer Farm</h1>

            <section className={`${styles.section} glass`}>
                <div className={styles.addPrinterForm}>
                    <input
                        type="text"
                        placeholder="Printer Name (e.g. Prusa MK4 #4)"
                        value={newPrinterName}
                        onChange={(e) => setNewPrinterName(e.target.value)}
                        className={styles.input}
                    />
                    <input
                        type="text"
                        placeholder="Model (e.g. MK4, X1C)"
                        value={newPrinterType}
                        onChange={(e) => setNewPrinterType(e.target.value)}
                        className={styles.input}
                        style={{ width: '150px' }}
                    />
                    <button onClick={handleSavePrinter} className="btn">
                        {editingId ? <Save size={18} /> : <Plus size={18} />}
                    </button>
                    {editingId && (
                        <button onClick={cancelEditing} className="btn secondary" style={{ background: 'rgba(255,255,255,0.1)' }}>
                            <X size={18} />
                        </button>
                    )}
                </div>

                <div className={styles.tableContainer}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Printer</th>
                                <th>Model</th>
                                <th>Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {printers.map((printer) => (
                                <tr key={printer.id}>
                                    <td>{printer.name}</td>
                                    <td>{printer.type}</td>
                                    <td>
                                        <select
                                            disabled={isProcessing}
                                            value={printer.status}
                                            onChange={async (e) => {
                                                setIsProcessing(true)
                                                try {
                                                    await updatePrinterStatus(printer.id, e.target.value as Printer['status'])
                                                } finally {
                                                    setIsProcessing(false)
                                                }
                                            }}
                                            className={`${styles.statusSelect} ${styles[printer.status]}`}
                                        >
                                            <option value="available">Available</option>
                                            <option value="busy">Busy</option>
                                            <option value="maintenance">Maintenance</option>
                                        </select>
                                    </td>
                                    <td style={{ position: 'relative' }}>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button onClick={() => startEditing(printer)} className={styles.editBtn}>
                                                <Edit2 size={16} />
                                            </button>
                                            <button onClick={() => setDeletingId(printer.id)} className={styles.deleteBtn}>
                                                <Trash2 size={16} />
                                            </button>
                                        </div>

                                        {deletingId === printer.id && (
                                            <div style={{
                                                position: 'absolute', inset: 0, zIndex: 10,
                                                background: 'rgba(255,0,85,0.95)', backdropFilter: 'blur(5px)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                                animation: 'fadeIn 0.2s ease', color: 'white', borderRadius: '8px'
                                            }}>
                                                <AlertTriangle size={14} />
                                                <button onClick={() => setDeletingId(null)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '0.7rem' }}>Cancel</button>
                                                <button onClick={async () => {
                                                    setIsProcessing(true)
                                                    try {
                                                        await removePrinter(printer.id)
                                                        setDeletingId(null)
                                                        addToast('Printer removed', 'info')
                                                    } finally {
                                                        setIsProcessing(false)
                                                    }
                                                }} style={{ background: 'white', border: 'none', color: '#ff0055', borderRadius: '4px', padding: '2px 6px', fontSize: '0.7rem', fontWeight: 900, cursor: 'pointer' }}>Delete</button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    )
}
