'use client'
import { useState, useEffect, useRef, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { User } from '@supabase/supabase-js'
import { formatCurrency } from '@/utils/pricingEngine'
import dynamic from 'next/dynamic'
import styles from '../Admin.module.css'
import { Truck, Package, Archive, Save, X, RefreshCw, FileText, Eye, Download, ChevronDown, Check, Box, Search, Mail, Calendar, Trash2, AlertTriangle } from 'lucide-react'
import { useToastStore } from '@/store/toastStore'
import { getAdminOrders, updateOrderAdmin, getSignedModelUrl, getAdminDownloadUrl } from '../actions'
import BackButton from '@/components/BackButton'
import Loader from '@/components/Loader'

// Load STLViewer dynamically (no SSR — it uses WebGL)
const STLViewer = dynamic(() => import('@/components/STLViewer'), { ssr: false, loading: () => <Loader text="Preparing 3D model..." fullPage={false} /> })

const ADMIN_EMAILS_ENV = process.env.NEXT_PUBLIC_ADMIN_EMAILS || ''
const ADMINS = ADMIN_EMAILS_ENV.split(',').map(e => e.trim().toLowerCase())

const STATUS_OPTIONS = [
    { value: 'ordered', label: 'Ordered', emoji: '🆕' },
    { value: 'pending_confirmation', label: 'Pending Confirmation', emoji: '🔍' },
    { value: 'payment_confirmed', label: 'Payment Confirmed', emoji: '💰' },
    { value: 'processing', label: 'Processing', emoji: '🕐' },
    { value: 'printing', label: 'Printing', emoji: '🖨️' },
    { value: 'completed', label: 'Completed', emoji: '✅' },
    { value: 'shipped', label: 'Shipped', emoji: '📦' },
    { value: 'delivered', label: 'Delivered', emoji: '🏠' },
    { value: 'return_requested', label: 'Return Requested', emoji: '🔄' },
    { value: 'returned', label: 'Returned', emoji: '↩️' },
    { value: 'return_refused', label: 'Return Refused', emoji: '🚫' },
    { value: 'refunded', label: 'Refunded', emoji: '💸' },
    { value: 'cancelled', label: 'Cancelled', emoji: '❌' },
]

const HISTORY_STATUSES = ['shipped', 'delivered', 'cancelled', 'returned', 'return_refused', 'refunded']

const SC: Record<string, { bg: string; border: string; text: string }> = {
    ordered: { bg: 'rgba(0,112,243,0.12)', border: 'rgba(0,112,243,0.35)', text: '#0070f3' },
    pending_confirmation: { bg: 'rgba(255,174,0,0.12)', border: 'rgba(255,174,0,0.35)', text: '#ffae00' },
    payment_confirmed: { bg: 'rgba(57,255,20,0.12)', border: 'rgba(57,255,20,0.35)', text: '#39ff14' },
    processing: { bg: 'rgba(255,174,0,0.12)', border: 'rgba(255,174,0,0.35)', text: '#ffae00' },
    printing: { bg: 'rgba(57,255,20,0.12)', border: 'rgba(57,255,20,0.35)', text: '#39ff14' },
    completed: { bg: 'rgba(0,255,136,0.12)', border: 'rgba(0,255,136,0.35)', text: '#00ff88' },
    shipped: { bg: 'rgba(0,191,255,0.12)', border: 'rgba(0,191,255,0.35)', text: '#00bfff' },
    delivered: { bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.35)', text: '#a78bfa' },
    return_requested: { bg: 'rgba(255,174,0,0.12)', border: 'rgba(255,174,0,0.35)', text: '#ffae00' },
    returned: { bg: 'rgba(57,255,20,0.12)', border: 'rgba(57,255,20,0.35)', text: '#39ff14' },
    return_refused: { bg: 'rgba(255,0,85,0.12)', border: 'rgba(255,0,85,0.35)', text: '#ff0055' },
    refunded: { bg: 'rgba(255,174,0,0.12)', border: 'rgba(255,174,0,0.35)', text: '#ffae00' },
    cancelled: { bg: 'rgba(255,0,85,0.12)', border: 'rgba(255,0,85,0.35)', text: '#ff0055' },
}

function parseAddress(raw: any) {
    try { return typeof raw === 'string' ? JSON.parse(raw) : raw } catch { return null }
}

// ──── Inline STL Viewer Modal ────
interface STLModalProps {
    fileUrl: string
    fileName: string
    fileColor?: string
    onClose: () => void
}
function STLModal({ fileUrl, fileName, fileColor, onClose }: STLModalProps) {
    // Close on Escape
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [onClose])

    const handleDownload = async (e: React.MouseEvent) => {
        e.preventDefault()
        try {
            // Use dedicated download action — generates a signed URL with
            // Content-Disposition: attachment; filename="..."
            // This forces the browser to download with the correct filename and extension.
            // No blob/fetch needed — the server header does the work.
            const res = await getAdminDownloadUrl(fileUrl, fileName)
            if (!res.data) throw new Error(res.error || 'Could not get download URL')

            // Navigate to the signed URL; Content-Disposition forces a download
            window.location.href = res.data
        } catch (error) {
            console.error('Download error:', error)
            alert('Failed to download file')
        }
    }

    return (
        <div
            onClick={e => { if (e.target === e.currentTarget) onClose() }}
            style={{
                position: 'fixed', inset: 0, zIndex: 1000,
                background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '24px',
            }}
        >
            <div style={{
                width: '100%', maxWidth: '900px', background: '#0d1117',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px',
                overflow: 'hidden', display: 'flex', flexDirection: 'column',
                maxHeight: '90vh',
                animation: 'slideUp 0.2s ease',
            }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <Box size={18} color="#39ff14" />
                    <span style={{ fontWeight: 700, color: 'white', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName}</span>
                    <button onClick={handleDownload}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '8px', background: 'rgba(57,255,20,0.1)', border: '1px solid rgba(57,255,20,0.25)', color: '#39ff14', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>
                        <Download size={13} /> Download STL
                    </button>
                    <button onClick={onClose}
                        style={{ padding: '7px', borderRadius: '8px', background: 'rgba(255,255,255,0.08)', border: 'none', color: 'white', cursor: 'pointer', display: 'flex' }}>
                        <X size={18} />
                    </button>
                </div>
                {/* Viewer */}
                <div style={{ height: '560px', width: '100%' }}>
                    <STLViewer
                        url={fileUrl}
                        height={560}
                        color={fileColor || '#39ff14'}
                        autoRotate={true}
                        showLoader={true}
                        urlResolver={getSignedModelUrl}
                    />
                </div>
            </div>
        </div>
    )
}

// ──── Custom Status Dropdown ────
function StatusDropdown({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)
    const current = STATUS_OPTIONS.find(s => s.value === value) || STATUS_OPTIONS[0]
    const sc = SC[value] || SC.processing

    useEffect(() => {
        function onOut(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
        document.addEventListener('mousedown', onOut)
        return () => document.removeEventListener('mousedown', onOut)
    }, [])

    return (
        <div ref={ref} style={{ position: 'relative', userSelect: 'none', flexShrink: 0 }}>
            <button
                onClick={() => setOpen(o => !o)}
                style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '7px 12px', borderRadius: '10px', cursor: 'pointer', border: `1px solid ${sc.border}`, background: sc.bg, color: sc.text, fontWeight: 700, fontSize: '0.83rem', whiteSpace: 'nowrap' }}
            >
                <span>{current.emoji}</span>
                <span>{current.label}</span>
                <ChevronDown size={12} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', opacity: 0.7 }} />
            </button>
            {open && (
                <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 300, background: '#0d1117', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px', padding: '6px', minWidth: '170px', boxShadow: '0 16px 48px rgba(0,0,0,0.7)', animation: 'fadeIn 0.12s ease' }}>
                    {STATUS_OPTIONS.map(opt => {
                        const s = SC[opt.value]
                        const isActive = opt.value === value
                        return (
                            <button key={opt.value}
                                onClick={() => { onChange(opt.value); setOpen(false) }}
                                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: isActive ? s.bg : 'transparent', color: isActive ? s.text : 'rgba(255,255,255,0.75)', fontWeight: isActive ? 700 : 400, fontSize: '0.85rem', textAlign: 'left' }}
                                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                            >
                                <span>{opt.emoji}</span>
                                <span style={{ flex: 1 }}>{opt.label}</span>
                                {isActive && <Check size={13} />}
                            </button>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

// ──── Multi Status Dropdown ────
function MultiStatusFilter({ value, onChange, options }: { value: string[]; onChange: (v: string[]) => void; options: typeof STATUS_OPTIONS }) {
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        function onOut(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
        document.addEventListener('mousedown', onOut)
        return () => document.removeEventListener('mousedown', onOut)
    }, [])

    const handleToggle = (optValue: string) => {
        if (value.includes(optValue)) {
            onChange(value.filter(v => v !== optValue))
        } else {
            onChange([...value, optValue])
        }
    }

    return (
        <div ref={ref} style={{ position: 'relative', userSelect: 'none', flexShrink: 0 }}>
            <button
                onClick={() => setOpen(o => !o)}
                style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 14px', borderRadius: '10px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'white', fontWeight: 600, fontSize: '0.85rem', whiteSpace: 'nowrap' }}
            >
                <span>Filter Status {value.length > 0 ? `(${value.length})` : ''}</span>
                <ChevronDown size={14} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', opacity: 0.7 }} />
            </button>
            {open && (
                <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 300, background: '#0d1117', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px', padding: '8px', minWidth: '200px', boxShadow: '0 16px 48px rgba(0,0,0,0.7)', animation: 'fadeIn 0.12s ease', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {options.map(opt => {
                        const s = SC[opt.value] || SC.processing
                        const isActive = value.includes(opt.value)
                        return (
                            <button key={opt.value}
                                onClick={() => handleToggle(opt.value)}
                                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: isActive ? s.bg : 'transparent', color: isActive ? s.text : 'rgba(255,255,255,0.75)', fontWeight: isActive ? 700 : 400, fontSize: '0.85rem', textAlign: 'left' }}
                                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                            >
                                <div style={{ width: '16px', height: '16px', borderRadius: '4px', border: `1px solid ${isActive ? s.border : 'rgba(255,255,255,0.2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: isActive ? s.bg : 'transparent' }}>
                                    {isActive && <Check size={12} />}
                                </div>
                                <span>{opt.emoji}</span>
                                <span style={{ flex: 1 }}>{opt.label}</span>
                            </button>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

// ──── Date Range Dropdown ────
function DateRangeFilter({ startDate, endDate, onStartChange, onEndChange }: { startDate: string, endDate: string, onStartChange: (v: string) => void, onEndChange: (v: string) => void }) {
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        function onOut(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
        document.addEventListener('mousedown', onOut)
        return () => document.removeEventListener('mousedown', onOut)
    }, [])

    const hasFilter = startDate || endDate

    return (
        <div ref={ref} style={{ position: 'relative', userSelect: 'none', flexShrink: 0 }}>
            <button
                onClick={() => setOpen(o => !o)}
                style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 14px', borderRadius: '10px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'white', fontWeight: 600, fontSize: '0.85rem', whiteSpace: 'nowrap' }}
            >
                <Calendar size={14} style={{ opacity: 0.7 }} />
                <span>{hasFilter ? 'Date Filtered' : 'Filter Date'}</span>
                <ChevronDown size={14} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', opacity: 0.7 }} />
            </button>
            {open && (
                <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 300, background: '#0d1117', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px', padding: '16px', minWidth: '220px', boxShadow: '0 16px 48px rgba(0,0,0,0.7)', animation: 'fadeIn 0.12s ease', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '0.75rem', opacity: 0.6, fontWeight: 700, textTransform: 'uppercase' }}>From</label>
                        <input type="date" value={startDate} onChange={e => onStartChange(e.target.value)} style={{ padding: '8px 10px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none', fontFamily: 'inherit', colorScheme: 'dark' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '0.75rem', opacity: 0.6, fontWeight: 700, textTransform: 'uppercase' }}>To</label>
                        <input type="date" value={endDate} onChange={e => onEndChange(e.target.value)} style={{ padding: '8px 10px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none', fontFamily: 'inherit', colorScheme: 'dark' }} />
                    </div>
                    {hasFilter && (
                        <button
                            onClick={() => { onStartChange(''); onEndChange(''); setOpen(false); }}
                            style={{ padding: '8px', borderRadius: '8px', background: 'rgba(255,0,85,0.1)', color: '#ff0055', border: '1px solid rgba(255,0,85,0.2)', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 700, marginTop: '4px' }}
                        >
                            Clear Date Filter
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}

// ──── Main Page ────
export default function AdminOrdersPage() {
    const router = useRouter()
    const addToast = useToastStore((state) => state.addToast)
    const [user, setUser] = useState<User | null>(null)
    const [orders, setOrders] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [fetching, setFetching] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [activeSearch, setActiveSearch] = useState('')
    const [historySearch, setHistorySearch] = useState('')
    const [activeStatusFilters, setActiveStatusFilters] = useState<string[]>([])
    const [historyStatusFilters, setHistoryStatusFilters] = useState<string[]>([])
    const [activeStartDate, setActiveStartDate] = useState('')
    const [activeEndDate, setActiveEndDate] = useState('')
    const [historyStartDate, setHistoryStartDate] = useState('')
    const [historyEndDate, setHistoryEndDate] = useState('')


    useEffect(() => {
        const supabase = createClient()
        const checkUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            setUser(prev => prev?.id === user?.id ? prev : user)
            setLoading(false)
            if (!user || !ADMINS.includes(user.email?.toLowerCase() || '')) router.push('/')
        }
        checkUser()
    }, [router])

    useEffect(() => {
        if (ADMINS.includes(user?.email?.toLowerCase() || '')) {
            const supabase = createClient()
            fetchOrders()
            const ch = supabase.channel('admin-orders-rt')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
                .subscribe()
            return () => { supabase.removeChannel(ch) }
        }
    }, [user])

    const fetchOrders = async () => {
        setFetching(true)
        setError(null)
        const { data, error } = await getAdminOrders() as any
        setFetching(false)
        if (error) { setError(error); addToast('Failed to load orders', 'error') }
        else if (data) setOrders(data)
    }



    if (loading || !user) return <Loader text="Verifying permissions..." />
    if (fetching && orders.length === 0) return <Loader text="Loading orders..." />

    const filterOrders = (list: any[], query: string, statuses: string[], startDate: string, endDate: string) => {
        let filtered = list;
        if (statuses.length > 0) {
            filtered = filtered.filter(o => statuses.includes(o.status));
        }

        if (startDate || endDate) {
            filtered = filtered.filter(o => {
                const orderDate = new Date(o.created_at)
                orderDate.setHours(0, 0, 0, 0)

                if (startDate) {
                    const start = new Date(startDate)
                    start.setHours(0, 0, 0, 0)
                    if (orderDate < start) return false
                }

                if (endDate) {
                    const end = new Date(endDate)
                    end.setHours(0, 0, 0, 0)
                    if (orderDate > end) return false
                }

                return true
            })
        }

        if (!query) return filtered;
        const q = query.toLowerCase()
        return filtered.filter(o => {
            const addr = parseAddress(o.shipping_address)
            const details = o.user_details as any
            const customerName = details?.full_name?.toLowerCase() || addr?.full_name?.toLowerCase() || ''
            const orderId = o.id.toLowerCase()
            return customerName.includes(q) || orderId.includes(q)
        })
    }

    const activeOrders = filterOrders(orders.filter(o => !HISTORY_STATUSES.includes(o.status)), activeSearch, activeStatusFilters, activeStartDate, activeEndDate)
    const historyOrders = filterOrders(orders.filter(o => HISTORY_STATUSES.includes(o.status)), historySearch, historyStatusFilters, historyStartDate, historyEndDate)

    return (
        <div className="container" style={{ maxWidth: '100%', padding: 0 }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
                <h1 className="title-gradient" style={{ margin: 0 }}>Order Management</h1>
                <button onClick={fetchOrders} disabled={fetching}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'white', cursor: 'pointer', fontSize: '0.9rem' }}
                >
                    <RefreshCw size={15} style={{ animation: fetching ? 'spin 0.8s linear infinite' : 'none' }} />
                    {fetching ? 'Refreshing…' : 'Refresh'}
                </button>
            </div>

            {error && (
                <div style={{ padding: '16px', background: 'rgba(255,0,85,0.1)', border: '1px solid #ff0055', borderRadius: '12px', marginBottom: '24px', color: '#ff0055' }}>
                    <strong>Error:</strong> {error}
                    <button onClick={fetchOrders} style={{ marginLeft: '12px', background: '#ff0055', color: 'white', border: 'none', padding: '4px 12px', borderRadius: '6px', cursor: 'pointer' }}>Retry</button>
                </div>
            )}

            {/* ──── ACTIVE QUEUE ──── */}
            <section className={styles.section} style={{ marginBottom: '40px', position: 'relative', zIndex: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <Package color="#39ff14" size={24} />
                            <h2 style={{ margin: 0, fontSize: '1.4rem' }}>Active Queue</h2>
                        </div>
                        <span style={{ padding: '4px 14px', borderRadius: '20px', background: 'rgba(57,255,20,0.1)', border: '1px solid rgba(57,255,20,0.2)', color: '#39ff14', fontSize: '0.85rem', fontWeight: 700 }}>
                            {activeOrders.length} order{activeOrders.length !== 1 ? 's' : ''}
                        </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, justifyContent: 'flex-end', minWidth: '300px' }}>
                        <div style={{ position: 'relative', flex: 1, maxWidth: '300px' }}>
                            <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                            <input
                                type="text"
                                placeholder="Search ID or Customer..."
                                value={activeSearch}
                                onChange={(e) => setActiveSearch(e.target.value)}
                                style={{ width: '100%', padding: '9px 12px 9px 36px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: '0.85rem' }}
                            />
                        </div>

                        <DateRangeFilter
                            startDate={activeStartDate}
                            endDate={activeEndDate}
                            onStartChange={setActiveStartDate}
                            onEndChange={setActiveEndDate}
                        />

                        <MultiStatusFilter
                            value={activeStatusFilters}
                            onChange={setActiveStatusFilters}
                            options={STATUS_OPTIONS.filter(o => !HISTORY_STATUSES.includes(o.value))}
                        />
                    </div>
                </div>

                {activeOrders.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px 20px', opacity: 0.4 }}>
                        <Package size={48} style={{ marginBottom: '16px' }} />
                        <p style={{ margin: 0 }}>Queue is clear — no active orders</p>
                    </div>
                ) : (
                    <div style={{
                        display: 'flex', flexDirection: 'column', gap: '12px',
                    }}>
                        {activeOrders.map(order => {
                            const addr = parseAddress(order.shipping_address)
                            const items: any[] = order.order_items || []
                            const sc = SC[order.status] || SC.processing

                            return (
                                <div
                                    key={order.id}
                                    onClick={() => router.push(`/admin/orders/${order.id}`)}
                                    style={{
                                        cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '16px 20px', gap: '16px',
                                        background: 'rgba(255,255,255,0.02)', border: `1px solid ${sc.border}`, borderRadius: '18px',
                                        transition: 'all 0.2s', position: 'relative', overflow: 'hidden'
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.transform = 'none' }}
                                >
                                    <div style={{ width: '42px', height: '42px', borderRadius: '14px', flexShrink: 0, background: `linear-gradient(135deg,${sc.text}33,${sc.text}11)`, border: `1px solid ${sc.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', fontWeight: 800, color: sc.text }}>
                                        {currentStatusEmoji(order.status)}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, fontSize: '1rem', color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {order.user_details?.full_name || addr?.full_name || 'Unknown Customer'}
                                        </div>
                                        <div style={{ fontSize: '0.78rem', opacity: 0.45, marginTop: '2px' }}>
                                            <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>#{order.id.slice(0, 8).toUpperCase()}</span> · {items.length} file{items.length !== 1 ? 's' : ''} · {new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                        <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'white' }}>{formatCurrency(order.total_amount)}</div>
                                        <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: sc.text }}>{order.status}</span>
                                    </div>
                                    <div style={{ opacity: 0.2 }}>
                                        <ChevronDown size={18} style={{ transform: 'rotate(-90deg)' }} />
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </section>

            {/* ──── ORDER HISTORY ──── */}
            <section className={styles.section} style={{ position: 'relative', zIndex: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <Archive color="rgba(255,255,255,0.5)" size={24} />
                            <h2 style={{ margin: 0, color: 'rgba(255,255,255,0.7)', fontSize: '1.4rem' }}>Order History</h2>
                        </div>
                        <span style={{ padding: '4px 14px', borderRadius: '20px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', fontWeight: 700 }}>
                            {historyOrders.length} order{historyOrders.length !== 1 ? 's' : ''}
                        </span>
                    </div>



                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, justifyContent: 'flex-end', minWidth: '300px' }}>
                        <div style={{ position: 'relative', flex: 1, maxWidth: '300px' }}>
                            <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} />
                            <input
                                type="text"
                                placeholder="Search ID or Customer..."
                                value={historySearch}
                                onChange={(e) => setHistorySearch(e.target.value)}
                                style={{ width: '100%', padding: '9px 12px 9px 36px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem' }}
                            />
                        </div>

                        <DateRangeFilter
                            startDate={historyStartDate}
                            endDate={historyEndDate}
                            onStartChange={setHistoryStartDate}
                            onEndChange={setHistoryEndDate}
                        />

                        <MultiStatusFilter
                            value={historyStatusFilters}
                            onChange={setHistoryStatusFilters}
                            options={STATUS_OPTIONS.filter(o => HISTORY_STATUSES.includes(o.value))}
                        />
                    </div>
                </div>
                <div className={styles.tableContainer}>
                    <table className={styles.table} style={{ opacity: 0.85 }}>
                        <thead>
                            <tr>
                                <th>Order ID</th><th>Date</th><th>Customer</th><th>Files</th><th>Total</th><th>Status</th><th>Tracking</th>
                            </tr>
                        </thead>
                        <tbody>
                            {historyOrders.length === 0 ? (
                                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '32px', opacity: 0.4 }}>No completed orders yet</td></tr>
                            ) : historyOrders.map(order => {
                                const addr = parseAddress(order.shipping_address)
                                const items: any[] = order.order_items || []
                                const sc = SC[order.status] || SC.delivered
                                return (
                                    <Fragment key={order.id}>
                                        <tr onClick={() => router.push(`/admin/orders/${order.id}`)} style={{ cursor: 'pointer' }}>
                                            <td style={{ fontFamily: 'monospace', fontSize: '0.84rem' }} title={order.id}>#{order.id.slice(0, 8).toUpperCase()}</td>
                                            <td style={{ opacity: 0.65, whiteSpace: 'nowrap' }}>{new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}</td>
                                            <td style={{ fontWeight: 600 }}>{order.user_details?.full_name || addr?.full_name || '—'}</td>
                                            <td>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                    {items.map((item: any, i: number) => <span key={i} style={{ fontSize: '0.81rem', opacity: 0.78 }}>×{item.quantity} {item.file_name}</span>)}
                                                    {items.length === 0 && <span style={{ opacity: 0.38 }}>—</span>}
                                                </div>
                                            </td>
                                            <td style={{ fontWeight: 700 }}>{formatCurrency(order.total_amount)}</td>
                                            <td>
                                                <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '0.77rem', fontWeight: 700, background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`, whiteSpace: 'nowrap' }}>
                                                    {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                                                </span>
                                            </td>
                                            <td style={{ opacity: 0.55, fontSize: '0.84rem' }}>{order.tracking_number || '—'}</td>
                                        </tr>

                                    </Fragment>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </section >

            <style>{`
                @keyframes spin    { to { transform: rotate(360deg); } }
                @keyframes fadeIn  { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:translateY(0); } }
            `}</style>
        </div >
    )
}

function currentStatusEmoji(status: string) {
    return STATUS_OPTIONS.find(s => s.value === status)?.emoji || '🕐'
}
