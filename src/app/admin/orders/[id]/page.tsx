'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { formatCurrency } from '@/utils/pricingEngine'
import dynamic from 'next/dynamic'
import { Truck, Package, FileText, Eye, Download, ChevronLeft, ChevronDown, Check, Box, Save, X, RefreshCw, Upload, RotateCcw, AlertTriangle } from 'lucide-react'
import { useToastStore } from '@/store/toastStore'
import { getAdminOrderById, updateOrderAdmin, getSignedModelUrl, adminHandleReturnRequest, getAdminPaymentProofUrl, getAdminReturnEvidenceUrls } from '../../actions'
import BackButton from '@/components/BackButton'
import Loader from '@/components/Loader'

const STLViewer = dynamic(() => import('@/components/STLViewer'), { ssr: false, loading: () => <Loader text="Preparing 3D model..." fullPage={false} /> })

const ADMIN_EMAILS_ENV = process.env.NEXT_PUBLIC_ADMIN_EMAILS || ''
const ADMINS = ADMIN_EMAILS_ENV.split(',').map(e => e.trim().toLowerCase())

const STATUS_OPTIONS = [
    { value: 'ordered', label: 'Ordered', emoji: '🆕' },
    { value: 'pending_confirmation', label: 'Pending Confirmation', emoji: '🔍' },
    { value: 'payment_confirmed', label: 'Order Confirmed', emoji: '💰' },
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
        <div ref={ref} style={{ position: 'relative', userSelect: 'none' }}>
            <button
                onClick={() => setOpen(o => !o)}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '12px', cursor: 'pointer', border: `1px solid ${sc.border}`, background: sc.bg, color: sc.text, fontWeight: 700, fontSize: '0.9rem', width: '100%' }}
            >
                <span>{current.emoji}</span>
                <span style={{ flex: 1, textAlign: 'left' }}>{current.label}</span>
                <ChevronDown size={14} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', opacity: 0.7 }} />
            </button>
            {open && (
                <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, zIndex: 100, background: '#161b22', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '6px', boxShadow: '0 16px 48px rgba(0,0,0,0.5)', animation: 'fadeIn 0.1s ease' }}>
                    {STATUS_OPTIONS.map(opt => {
                        const s = SC[opt.value]
                        const isActive = opt.value === value
                        return (
                            <button key={opt.value}
                                onClick={() => { onChange(opt.value); setOpen(false) }}
                                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: isActive ? s.bg : 'transparent', color: isActive ? s.text : 'rgba(255,255,255,0.7)', fontWeight: isActive ? 700 : 400, fontSize: '0.88rem' }}
                                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                            >
                                <span>{opt.emoji}</span>
                                <span style={{ flex: 1, textAlign: 'left' }}>{opt.label}</span>
                                {isActive && <Check size={14} />}
                            </button>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

export default function OrderDetailPage() {
    const { id } = useParams()
    const router = useRouter()
    const addToast = useToastStore((state) => state.addToast)

    const [user, setUser] = useState<any>(null)
    const [order, setOrder] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [updating, setUpdating] = useState(false)
    const [activeFile, setActiveFile] = useState<any>(null) // For 3D preview
    const [track, setTrack] = useState('')
    const [isEditingTrack, setIsEditingTrack] = useState(false)
    const [paymentProofUrl, setPaymentProofUrl] = useState<string | null>(null)
    const [adminReturnNote, setAdminReturnNote] = useState('')
    const [handlingReturn, setHandlingReturn] = useState(false)
    const [returnEvidenceUrls, setReturnEvidenceUrls] = useState<string[]>([])

    // Viewer settings
    const [showCrossSection, setShowCrossSection] = useState(false)
    const [crossSectionHeight, setCrossSectionHeight] = useState(50)
    const [crossSectionAxis, setCrossSectionAxis] = useState<'x' | 'y' | 'z'>('y')
    const [autoRotate, setAutoRotate] = useState(true)
    const [showWireframe, setShowWireframe] = useState(false)

    useEffect(() => {
        const supabase = createClient()
        const checkUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            const userEmail = user?.email?.toLowerCase() || ''
            if (!user || !ADMINS.includes(userEmail) || user.app_metadata?.provider !== 'email') {
                router.push('/')
                return
            }
            setUser(user)
        }
        checkUser()
    }, [router])

    useEffect(() => {
        if (user && id) { // Only fetch order if user is authenticated and id is available
            fetchOrder()
        }
    }, [user, id]) // Depend on user and id

    const fetchOrder = async () => {
        setLoading(true)
        const { data, error } = await getAdminOrderById(id as string)
        setLoading(false)
        if (error) {
            addToast('Failed to load order', 'error')
            router.push('/admin/orders')
        } else {
            setOrder(data)
            setTrack(data.tracking_number || '')
            setAdminReturnNote(data.admin_return_note || '')
            // Find payment proof if exists
            fetchPaymentProof(data.id, data.user_id)
            // Fetch return evidence URLs securely (overriding whatever is stored in DB to ensure fresh signed URLs)
            fetchReturnEvidence(data.id, data.user_id)

            // Resolve signed URLs for all items
            if (data.order_items && data.order_items.length > 0) {
                const enrichedItems = await Promise.all(data.order_items.map(async (item: any) => {
                    if (item.file_url && !item.file_url.startsWith('http') && !item.file_url.startsWith('blob:')) {
                        const res = await getSignedModelUrl(item.file_url)
                        if (res.data) {
                            return { ...item, original_path: item.file_url, file_url: res.data }
                        }
                    }
                    return item
                }))
                setOrder({ ...data, order_items: enrichedItems })
                setActiveFile(enrichedItems[0])
            } else {
                setOrder(data)
            }
        }
    }

    const fetchPaymentProof = async (orderId: string, orderUserId: string) => {
        try {
            // Use server action (Service Role) to bypass RLS safely
            const res = await getAdminPaymentProofUrl(orderId, orderUserId)
            if (res.data) {
                setPaymentProofUrl(res.data)
            }
        } catch (err) {
            console.error('Unexpected error fetching payment proof:', err)
        }
    }

    const fetchReturnEvidence = async (orderId: string, orderUserId: string) => {
        try {
            const res = await getAdminReturnEvidenceUrls(orderId, orderUserId)
            if (res.data) {
                setReturnEvidenceUrls(res.data)
            }
        } catch (err) {
            console.error('Unexpected error fetching return evidence:', err)
        }
    }

    const updateStatus = async (newStatus: string) => {
        setOrder((prev: any) => ({ ...prev, status: newStatus }))
        const { error } = await updateOrderAdmin(id as string, { status: newStatus })
        if (error) {
            addToast('Status update failed', 'error')
            fetchOrder() // Revert
        } else {
            addToast(`Order marked as ${newStatus}`, 'success')
        }
    }

    const handleReturnAction = async (decision: 'accept' | 'refuse') => {
        setHandlingReturn(true)
        try {
            const res = await adminHandleReturnRequest(id as string, decision, adminReturnNote)
            if (res.error) throw new Error(res.error)

            addToast(`Return request ${decision === 'accept' ? 'accepted' : 'refused'}`, 'success')
            fetchOrder()
        } catch (err: any) {
            addToast(err.message || 'Action failed', 'error')
        } finally {
            setHandlingReturn(false)
        }
    }

    const saveTracking = async () => {
        setUpdating(true)
        const { error } = await updateOrderAdmin(id as string, { tracking_number: track })
        setUpdating(false)
        if (!error) {
            addToast('Tracking ID updated', 'success')
            setIsEditingTrack(false)
            setOrder((prev: any) => ({ ...prev, tracking_number: track }))
        } else {
            addToast('Update failed', 'error')
        }
    }

    const handleDownloadSTL = async (e: React.MouseEvent, url: string, fileName: string) => {
        e.stopPropagation()
        try {
            // Prefix with Order ID for admin convenience (e.g. "ORD123_Part.stl")
            const orderPrefix = (id as string).slice(0, 8).toUpperCase()
            const finalFileName = `${orderPrefix}_${fileName}`

            const response = await fetch(url)
            if (!response.ok) throw new Error('Download failed')

            const blob = await response.blob()
            const blobUrl = URL.createObjectURL(blob)

            const a = document.createElement('a')
            a.href = blobUrl
            a.download = finalFileName
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(blobUrl)

            addToast('Download started', 'success')
        } catch (error) {
            console.error('Download error:', error)
            addToast('Failed to download file', 'error')
        }
    }

    if (loading) return <Loader text="Fetching order details..." />
    if (!order) return <Loader text="Order not found." />

    const addr = typeof order.shipping_address === 'string' ? JSON.parse(order.shipping_address) : order.shipping_address
    const items = order.order_items || []
    const sc = SC[order.status] || SC.processing

    return (
        <div style={{ color: 'white', maxWidth: '1400px', margin: '0 auto', padding: '20px' }}>

            {/* Header Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <BackButton href="/admin/orders" />
                    <h1 className="title-gradient" style={{ margin: 0, fontSize: '1.8rem', lineHeight: '1' }}>Order Details</h1>
                </div>
                <p style={{ margin: '0 0 0 60px', color: 'rgba(255,255,255,0.5)', fontSize: '0.95rem' }}>
                    Manage print specifications, customer fulfillment, and delivery logistics.
                </p>
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
                gap: '24px',
                alignItems: 'start'
            }}>

                {/* Main Visual & Control Cluster */}
                <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '24px' }}>

                    {/* 3D Viewer Section */}
                    <div style={{
                        aspectRatio: '16/10', background: '#0d1117', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)',
                        overflow: 'hidden', position: 'relative', boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
                    }}>
                        {activeFile?.file_url ? (
                            <>
                                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '12px', display: 'flex', gap: '8px', zIndex: 10, background: 'linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)' }}>
                                    <button
                                        onClick={() => setShowCrossSection(!showCrossSection)}
                                        style={{ background: showCrossSection ? 'rgba(57,255,20,0.2)' : 'rgba(255,255,255,0.1)', border: showCrossSection ? '1px solid #39ff14' : '1px solid rgba(255,255,255,0.2)', color: showCrossSection ? '#39ff14' : 'white', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', zIndex: 10 }}
                                    >
                                        Cross Section
                                    </button>
                                    <button
                                        onClick={() => setAutoRotate(!autoRotate)}
                                        style={{ background: autoRotate ? 'rgba(57,255,20,0.2)' : 'rgba(255,255,255,0.1)', border: autoRotate ? '1px solid #39ff14' : '1px solid rgba(255,255,255,0.2)', color: autoRotate ? '#39ff14' : 'white', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', zIndex: 10 }}
                                    >
                                        Rotate
                                    </button>
                                    <button
                                        onClick={() => setShowWireframe(!showWireframe)}
                                        style={{ background: showWireframe ? 'rgba(57,255,20,0.2)' : 'rgba(255,255,255,0.1)', border: showWireframe ? '1px solid #39ff14' : '1px solid rgba(255,255,255,0.2)', color: showWireframe ? '#39ff14' : 'white', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', zIndex: 10 }}
                                    >
                                        Mesh
                                    </button>
                                </div>
                                {showCrossSection && (
                                    <div style={{ position: 'absolute', top: '45px', left: '12px', right: '12px', zIndex: 10, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                            {(['x', 'y', 'z'] as const).map(axis => (
                                                <button
                                                    key={axis}
                                                    onClick={() => setCrossSectionAxis(axis)}
                                                    style={{ flex: 1, background: crossSectionAxis === axis ? 'rgba(57,255,20,0.2)' : 'rgba(255,255,255,0.1)', border: crossSectionAxis === axis ? '1px solid #39ff14' : '1px solid rgba(255,255,255,0.2)', color: crossSectionAxis === axis ? '#39ff14' : 'white', padding: '4px 0', borderRadius: '4px', fontSize: '0.7rem', textTransform: 'uppercase', cursor: 'pointer' }}
                                                >
                                                    {axis}-Axis
                                                </button>
                                            ))}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <input
                                                type="range"
                                                min="0"
                                                max="100"
                                                value={crossSectionHeight}
                                                onChange={(e) => setCrossSectionHeight(parseInt(e.target.value))}
                                                style={{ flex: 1, cursor: 'pointer' }}
                                            />
                                            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{crossSectionHeight}%</span>
                                        </div>
                                    </div>
                                )}
                                <STLViewer
                                    url={activeFile.file_url}
                                    color={activeFile.color || '#39ff14'}
                                    autoRotate={autoRotate}
                                    height={500}
                                    showCrossSection={showCrossSection}
                                    crossSectionHeight={crossSectionHeight}
                                    crossSectionAxis={crossSectionAxis}
                                    wireframe={showWireframe}
                                    urlResolver={getSignedModelUrl}
                                />
                                <div style={{ position: 'absolute', bottom: '20px', left: '20px', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', padding: '10px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', pointerEvents: 'none' }}>
                                    <div style={{ fontSize: '0.7rem', opacity: 0.5, textTransform: 'uppercase', marginBottom: '2px' }}>Viewing File</div>
                                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{activeFile.file_name}</div>
                                </div>
                            </>
                        ) : (
                            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.2)' }}>
                                <Box size={48} />
                            </div>
                        )}
                    </div>

                    {/* Configuration Details Section */}
                    <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)', padding: '32px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <FileText size={24} color="#39ff14" />
                                <h3 style={{ margin: 0, fontSize: '1.4rem' }}>Print Configuration Details</h3>
                            </div>
                            <span style={{ padding: '4px 12px', background: 'rgba(57,255,20,0.1)', color: '#39ff14', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700 }}>
                                {items.length} {items.length === 1 ? 'FILE' : 'FILES'}
                            </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
                            {items.map((item: any, idx: number) => {
                                const isActive = activeFile?.id === item.id

                                const supportType = item.support_type || 'none'
                                const supportMaterial = item.support_material || ''
                                const brimR = typeof item.brim === 'boolean' ? item.brim : false
                                const brandR = item.brand || 'Standard'
                                const infillPatternR = item.infill_pattern || 'Grid'
                                const amsColorsR = item.ams_colors || [item.color]
                                const amsBrandsR = item.ams_brands || []

                                return (
                                    <div
                                        key={idx}
                                        onClick={() => setActiveFile(item)}
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns: 'auto 1fr auto',
                                            gap: '24px',
                                            padding: '24px',
                                            background: isActive ? 'rgba(57,255,20,0.04)' : 'rgba(255,255,255,0.02)',
                                            borderRadius: '20px',
                                            border: isActive ? '1px solid #39ff14' : '1px solid rgba(255,255,255,0.05)',
                                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                            cursor: 'pointer',
                                            position: 'relative',
                                            overflow: 'hidden'
                                        }}
                                    >
                                        {isActive && <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#39ff14' }} />}

                                        {/* Icon/Color */}
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                            <div style={{
                                                width: '56px', height: '56px', borderRadius: '16px',
                                                background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                boxShadow: isActive ? '0 0 20px rgba(57,255,20,0.1)' : 'none'
                                            }}>
                                                <Box size={28} color={isActive ? '#39ff14' : 'rgba(255,255,255,0.3)'} />
                                            </div>
                                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                                {amsColorsR.map((c: string, i: number) => (
                                                    <div key={i} style={{
                                                        width: '20px', height: '20px', borderRadius: '50%',
                                                        background: c, border: '2px solid white',
                                                        boxShadow: '0 2px 5px rgba(0,0,0,0.3)'
                                                    }} title={`Slot ${i + 1}: ${c}`} />
                                                ))}
                                            </div>
                                        </div>

                                        {/* Main Info */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            <div style={{ fontWeight: 800, fontSize: '1.2rem', color: isActive ? '#39ff14' : 'white' }}>{item.file_name}</div>

                                            <div style={{
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                                                gap: '12px'
                                            }}>
                                                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px 14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                    <div style={{ fontSize: '0.65rem', opacity: 0.4, textTransform: 'uppercase', marginBottom: '2px' }}>Material</div>
                                                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{item.material}</div>
                                                </div>
                                                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px 14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                    <div style={{ fontSize: '0.65rem', opacity: 0.4, textTransform: 'uppercase', marginBottom: '2px' }}>Brand(s)</div>
                                                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#39ff14' }}>
                                                        {amsBrandsR.length > 0 ? Array.from(new Set(amsBrandsR)).join(', ') : brandR}
                                                    </div>
                                                </div>
                                                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px 14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                    <div style={{ fontSize: '0.65rem', opacity: 0.4, textTransform: 'uppercase', marginBottom: '2px' }}>Resolution</div>
                                                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{item.layer_height}mm</div>
                                                </div>
                                                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px 14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                    <div style={{ fontSize: '0.65rem', opacity: 0.4, textTransform: 'uppercase', marginBottom: '2px' }}>Infill density</div>
                                                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{item.infill}%</div>
                                                </div>
                                                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px 14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                    <div style={{ fontSize: '0.65rem', opacity: 0.4, textTransform: 'uppercase', marginBottom: '2px' }}>Infill Pattern</div>
                                                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{infillPatternR}</div>
                                                </div>
                                                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px 14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                    <div style={{ fontSize: '0.65rem', opacity: 0.4, textTransform: 'uppercase', marginBottom: '2px' }}>Support Type</div>
                                                    <div style={{ fontWeight: 700, fontSize: '0.9rem', textTransform: 'capitalize' }}>{supportType === 'none' ? 'None' : supportType}</div>
                                                </div>
                                                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px 14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                    <div style={{ fontSize: '0.65rem', opacity: 0.4, textTransform: 'uppercase', marginBottom: '2px' }}>Brim Required</div>
                                                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: brimR ? '#a78bfa' : 'white' }}>
                                                        {brimR ? `Yes` : 'No'}
                                                    </div>
                                                </div>
                                                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px 14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                    <div style={{ fontSize: '0.65rem', opacity: 0.4, textTransform: 'uppercase', marginBottom: '2px' }}>Quantity</div>
                                                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>×{item.quantity || 1}</div>
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', gap: '12px' }}>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontSize: '0.7rem', opacity: 0.4, textTransform: 'uppercase' }}>Item Total</div>
                                                <div style={{ fontWeight: 800, fontSize: '1.4rem', color: '#39ff14' }}>{formatCurrency(item.price * (item.quantity || 1))}</div>
                                            </div>
                                            <button
                                                onClick={(e) => handleDownloadSTL(e, item.file_url, item.file_name)}
                                                style={{
                                                    background: '#39ff14', color: 'black', border: 'none', borderRadius: '10px',
                                                    padding: '8px 16px', fontWeight: 700, fontSize: '0.85rem',
                                                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                                                    transition: 'all 0.2s'
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                                                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                                            >
                                                <Download size={16} /> Download STL
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>

                {/* Right Column Grouping: Summary, Customer, Payments, Returns */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                    {/* Status & Summary */}
                    <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)', padding: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                            <div>
                                <div style={{ fontSize: '0.75rem', opacity: 0.4, textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 800, marginBottom: '4px' }}>ORDER ID</div>
                                <h2 style={{ margin: 0, fontSize: '1.4rem', fontFamily: 'monospace' }}>#{order.id.slice(0, 8).toUpperCase()}</h2>
                                <div style={{ fontSize: '0.85rem', opacity: 0.5, marginTop: '4px' }}>Date: {new Date(order.created_at).toLocaleString()}</div>
                            </div>
                        </div>

                        <div style={{ marginBottom: '24px' }}>
                            <div style={{ fontSize: '0.75rem', opacity: 0.4, textTransform: 'uppercase', fontWeight: 800, marginBottom: '10px' }}>PROGRESS STATUS</div>
                            <StatusDropdown value={order.status} onChange={updateStatus} />
                        </div>

                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '20px' }}>


                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.4rem' }}>
                                <span style={{ fontWeight: 800 }}>Total</span>
                                <span style={{ fontWeight: 800, color: '#39ff14' }}>{formatCurrency(order.total_amount)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Customer & Shipping */}
                    <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)', padding: '24px' }}>
                        <div style={{ marginBottom: '24px' }}>
                            <div style={{ fontSize: '0.75rem', opacity: 0.4, textTransform: 'uppercase', fontWeight: 800, marginBottom: '8px' }}>CUSTOMER</div>
                            <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{order.user_details?.full_name || addr?.full_name || 'Anonymous'}</div>
                            {order.user_details?.phone && <div style={{ fontSize: '0.85rem', color: '#39ff14', fontWeight: 600, marginTop: '4px' }}>📞 {order.user_details?.phone}</div>}
                        </div>

                        <div style={{ marginBottom: '24px' }}>
                            <div style={{ fontSize: '0.75rem', opacity: 0.4, textTransform: 'uppercase', fontWeight: 800, marginBottom: '8px' }}>SHIPPING ADDRESS</div>
                            <div style={{ fontSize: '0.95rem', color: 'rgba(255,255,255,0.8)', lineHeight: '1.6' }}>
                                {addr ? (
                                    <>
                                        {addr.address_line1}<br />
                                        {addr.city}, {addr.state || ''} {addr.zip_code}<br />
                                        {addr.phone && <div style={{ marginTop: '8px', color: '#39ff14', fontWeight: 600 }}>📞 {addr.phone}</div>}
                                    </>
                                ) : 'No address provided'}
                            </div>
                        </div>

                        <div style={{ marginBottom: '24px' }}>
                            <div style={{ fontSize: '0.75rem', opacity: 0.4, textTransform: 'uppercase', fontWeight: 800, marginBottom: '10px' }}>DELIVERY METHOD</div>
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px',
                                background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)'
                            }}>
                                <Truck size={18} color={order.delivery_method === 'pickup' ? '#39ff14' : '#00f0ff'} />
                                <span style={{
                                    fontWeight: 800,
                                    fontSize: '0.9rem',
                                    color: order.delivery_method === 'pickup' ? '#39ff14' : '#00f0ff',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px'
                                }}>
                                    {order.delivery_method === 'porter' ? 'Local Shipping (Porter)' :
                                        order.delivery_method === 'pickup' ? 'Self Pickup' :
                                            'Standard Shipping'}
                                </span>
                            </div>
                        </div>

                        <div>
                            <div style={{ fontSize: '0.75rem', opacity: 0.4, textTransform: 'uppercase', fontWeight: 800, marginBottom: '10px' }}>TRACKING</div>
                            {isEditingTrack ? (
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <input value={track} onChange={e => setTrack(e.target.value)} autoFocus placeholder="Enter tracking ID..."
                                        style={{ flex: 1, padding: '12px', borderRadius: '12px', background: 'black', border: '1px solid #39ff14', color: 'white', outline: 'none' }} />
                                    <button onClick={saveTracking} disabled={updating}
                                        style={{ padding: '0 16px', borderRadius: '12px', background: '#39ff14', border: 'none', color: 'black', fontWeight: 700, cursor: 'pointer' }}>
                                        {updating ? <RefreshCw size={16} className="spin" /> : 'Save'}
                                    </button>
                                </div>
                            ) : (
                                <div
                                    onClick={() => setIsEditingTrack(true)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '12px', padding: '16px',
                                        background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px dashed rgba(255,255,255,0.2)',
                                        color: track ? '#00bfff' : 'rgba(255,255,255,0.3)', cursor: 'pointer'
                                    }}
                                >
                                    <Truck size={18} />
                                    <span style={{ fontWeight: 600 }}>{track || 'Click to add tracking ID...'}</span>
                                </div>
                            )}
                        </div>
                    </div>
                    {/* Payment Proof Section - ALWAYS prominent if either existing or awaiting upload */}
                    <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '24px', border: '1px solid rgba(57,255,20,0.15)', padding: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: paymentProofUrl ? '#39ff14' : '#ffae00' }} />
                            <div style={{ fontSize: '0.75rem', opacity: 0.5, textTransform: 'uppercase', fontWeight: 800 }}>PAYMENT PROOF VERIFICATION</div>
                        </div>

                        {paymentProofUrl ? (
                            <div style={{
                                position: 'relative',
                                borderRadius: '16px',
                                overflow: 'hidden',
                                border: '1px solid rgba(255,255,255,0.1)',
                                height: '280px',
                                background: 'rgba(0,0,0,0.4)'
                            }}>
                                <img
                                    src={paymentProofUrl}
                                    alt="Payment Proof"
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'contain',
                                        display: 'block'
                                    }}
                                />
                                <div style={{
                                    position: 'absolute',
                                    inset: 0,
                                    background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 40%)',
                                    pointerEvents: 'none'
                                }} />
                                <a href={paymentProofUrl} target="_blank" rel="noreferrer" style={{
                                    position: 'absolute', bottom: '16px', right: '16px', padding: '10px 20px',
                                    background: '#39ff14', borderRadius: '12px', color: 'black',
                                    textDecoration: 'none', fontSize: '0.85rem', fontWeight: 800,
                                    boxShadow: '0 4px 15px rgba(57,255,20,0.3)',
                                    transition: 'all 0.2s'
                                }}>
                                    View Full Screen
                                </a>
                            </div>
                        ) : (
                            <div style={{
                                padding: '40px 20px', textAlign: 'center', border: '2px dashed rgba(255,255,255,0.1)',
                                borderRadius: '20px', color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem', background: 'rgba(255,255,255,0.01)'
                            }}>
                                <AlertTriangle size={32} style={{ marginBottom: '12px', opacity: 0.3 }} />
                                <div style={{ fontWeight: 600 }}>{order.status === 'ordered' ? 'Awaiting Customer Upload' : 'No screenshot uploaded yet'}</div>
                                <div style={{ fontSize: '0.75rem', marginTop: '4px', opacity: 0.6 }}>Payment verification is pending screenshot submission.</div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Return Request Management - Now spanning full width at the bottom */}
                {(order.status === 'return_requested' || order.status === 'returned' || order.status === 'return_refused') && (
                    <div style={{
                        gridColumn: '1 / -1',
                        background: 'rgba(255,255,255,0.02)',
                        borderRadius: '24px',
                        border: '1px solid rgba(255,174,0,0.2)',
                        padding: '32px',
                        marginTop: '8px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                            <RotateCcw size={24} color="#ffae00" />
                            <h3 style={{ margin: 0, fontSize: '1.4rem' }}>Return Request Management</h3>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                            {/* Left Side: Reason & Notes */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                <div>
                                    <div style={{ fontSize: '0.75rem', opacity: 0.4, textTransform: 'uppercase', fontWeight: 800, marginBottom: '8px' }}>USER REASON</div>
                                    <div style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', fontSize: '0.95rem', border: '1px solid rgba(255,255,255,0.06)', lineHeight: '1.6' }}>
                                        {order.return_reason || 'No reason provided.'}
                                    </div>
                                </div>

                                <div>
                                    <div style={{ fontSize: '0.75rem', opacity: 0.4, textTransform: 'uppercase', fontWeight: 800, marginBottom: '8px' }}>ADMIN NOTE (Shown to Customer)</div>
                                    <textarea
                                        value={adminReturnNote}
                                        onChange={e => setAdminReturnNote(e.target.value)}
                                        placeholder="Explain your decision..."
                                        style={{ width: '100%', padding: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: 'white', resize: 'none', fontSize: '0.95rem', outline: 'none', transition: 'border-color 0.2s' }}
                                        rows={4}
                                        onFocus={e => e.currentTarget.style.borderColor = '#ffae00'}
                                        onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
                                    />
                                </div>

                                {order.status === 'return_requested' && (
                                    <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                                        <button
                                            onClick={() => handleReturnAction('refuse')}
                                            disabled={handlingReturn}
                                            style={{ flex: 1, padding: '14px', borderRadius: '14px', background: 'rgba(255,0,85,0.1)', border: '1px solid rgba(255,0,85,0.3)', color: '#ff0055', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s' }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,0,85,0.2)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,0,85,0.1)'}
                                        >
                                            Refuse Return
                                        </button>
                                        <button
                                            onClick={() => handleReturnAction('accept')}
                                            disabled={handlingReturn}
                                            style={{ flex: 2, padding: '14px', borderRadius: '14px', background: '#39ff14', border: 'none', color: 'black', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 15px rgba(57,255,20,0.2)' }}
                                            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                                            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                                        >
                                            Accept Return
                                        </button>
                                    </div>
                                )}

                                {order.status !== 'return_requested' && (
                                    <div style={{
                                        padding: '16px', borderRadius: '14px', textAlign: 'center',
                                        background: order.status === 'returned' ? 'rgba(57,255,20,0.1)' : 'rgba(255,0,85,0.1)',
                                        color: order.status === 'returned' ? '#39ff14' : '#ff0055',
                                        fontWeight: 800, fontSize: '1rem', border: `1px solid ${order.status === 'returned' ? '#39ff14' : '#ff0055'}44`,
                                        textTransform: 'uppercase', letterSpacing: '1px'
                                    }}>
                                        Decision: {order.status === 'returned' ? 'RETURN ACCEPTED' : 'RETURN REFUSED'}
                                    </div>
                                )}
                            </div>

                            {/* Right Side: Visual Evidence */}
                            <div>
                                <div style={{ fontSize: '0.75rem', opacity: 0.4, textTransform: 'uppercase', fontWeight: 800, marginBottom: '16px' }}>VISUAL EVIDENCE</div>
                                {returnEvidenceUrls.length > 0 ? (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '16px' }}>
                                        {returnEvidenceUrls.map((url: string, i: number) => (
                                            <a key={i} href={url} target="_blank" rel="noreferrer" style={{
                                                aspectRatio: '1', borderRadius: '16px', overflow: 'hidden',
                                                border: '1px solid rgba(255,255,255,0.1)', background: 'black',
                                                display: 'block', position: 'relative', transition: 'transform 0.2s'
                                            }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                                                <img src={url} alt="Evidence" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, background: 'rgba(0,0,0,0.4)', transition: '0.2s' }} onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0'}>
                                                    <Eye size={24} color="white" />
                                                </div>
                                            </a>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ padding: '40px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px dashed rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.3)' }}>
                                        No visual evidence uploaded.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    )
}
