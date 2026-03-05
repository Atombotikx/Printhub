'use client'
export const dynamic = 'force-dynamic'
import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import styles from './Tracking.module.css'
import { Search, Package, CheckCircle, Clock, Truck, Printer, AlertTriangle, CreditCard, XCircle, RotateCcw, Image as ImageIcon, Upload } from 'lucide-react'
import BackButton from '@/components/BackButton'
import { createClient } from '@/utils/supabase/client'
import { cancelUserOrder, submitReturnRequest } from '@/app/admin/actions'
import { useToastStore } from '@/store/toastStore'
import Loader from '@/components/Loader'

const STATUS_FLOW = [
    { key: 'received', label: 'Order Received', icon: Package },
    { key: 'ordered', label: 'Payment Pending', icon: CreditCard },
    { key: 'pending_confirmation', label: 'Pending Confirmation', icon: Search },
    { key: 'payment_confirmed', label: 'Processing', icon: Clock },
    { key: 'printing', label: 'Printing', icon: Printer },
    { key: 'completed', label: 'Completed', icon: Package },
    { key: 'shipped', label: 'Shipped', icon: Truck },
    { key: 'delivered', label: 'Delivered', icon: CheckCircle },
    { key: 'return_requested', label: 'Return Requested', icon: RotateCcw },
    { key: 'returned', label: 'Returned', icon: RotateCcw },
    { key: 'refunded', label: 'Refunded', icon: CreditCard },
]

interface TrackerOrder {
    id: string
    status: string
    tracking_number?: string
    created_at: string | number | Date
    return_reason?: string
    return_evidence_urls?: string[]
    admin_return_note?: string
}

function TrackingContent() {
    const searchParams = useSearchParams()
    const urlOrderId = searchParams.get('id')
    const router = useRouter()

    const [order, setOrder] = useState<TrackerOrder | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [userId, setUserId] = useState<string | null>(null)
    const [cancelling, setCancelling] = useState(false)
    const [showCancelConfirm, setShowCancelConfirm] = useState(false)
    const [showReturnModal, setShowReturnModal] = useState(false)
    const [returnReason, setReturnReason] = useState('')
    const [returnEvidence, setReturnEvidence] = useState<File[]>([])
    const [submittingReturn, setSubmittingReturn] = useState(false)
    const addToast = useToastStore((s) => s.addToast)

    useEffect(() => {
        const supabase = createClient()
        let channel: ReturnType<typeof supabase.channel> | null = null

        const getData = async () => {
            if (!urlOrderId) return
            setLoading(true)

            try {
                // Auth check
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) {
                    router.push('/login?callbackUrl=/tracking?id=' + urlOrderId)
                    return
                }
                setUserId(user.id)

                // Initial fetch
                const fetchOrder = async () => {
                    const { data, error: fetchError } = await supabase
                        .from('orders')
                        .select('*')
                        .eq('id', urlOrderId)
                        .single()

                    if (fetchError) throw fetchError
                    setOrder(data)
                    setLoading(false)
                }

                await fetchOrder()

                // Real-time listener
                channel = supabase.channel(`tracking-${urlOrderId}`)
                    .on('postgres_changes',
                        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${urlOrderId}` },
                        () => fetchOrder()
                    )
                    .subscribe()

            } catch (err: unknown) {
                console.error('Tracking page error:', err)
                setError(err instanceof Error ? err.message : 'Failed to load tracking data')
                setLoading(false)
            }
        }

        getData()

        return () => {
            if (channel) supabase.removeChannel(channel)
        }
    }, [urlOrderId, router])

    const handleCancel = async () => {
        if (!order) return
        setCancelling(true)
        try {
            const res = await cancelUserOrder(order.id)
            if (res.error) throw new Error(res.error)
            setOrder({ ...order, status: 'cancelled' })
            addToast('Order cancelled successfully', 'success')
            setShowCancelConfirm(false)
        } catch (err: unknown) {
            addToast(err instanceof Error ? err.message : 'Failed to cancel order', 'error')
        } finally {
            setCancelling(false)
        }
    }

    const handleReturn = async () => {
        if (!order || !returnReason.trim()) return
        setSubmittingReturn(true)
        try {
            const supabase = createClient()
            let uploadedUrls: string[] = []

            // 1. Upload evidence if any
            if (returnEvidence.length > 0) {
                const uploads = returnEvidence.map(async (file) => {
                    // returns/{userId}/{orderId}/{originalFilename}
                    // orderId subfolder keeps all evidence for one return grouped together.
                    const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
                    const filePath = `returns/${userId}/${order.id}/${cleanName}`

                    const { error: uploadError } = await supabase.storage
                        .from('prints')
                        .upload(filePath, file)

                    if (uploadError) throw uploadError

                    return filePath
                })

                uploadedUrls = await Promise.all(uploads)
            }

            const res = await submitReturnRequest(order.id, returnReason, uploadedUrls)
            if (res.error) throw new Error(res.error)

            setOrder({ ...order, status: 'return_requested', return_reason: returnReason, return_evidence_urls: uploadedUrls })
            addToast('Return request submitted successfully', 'success')
            setShowReturnModal(false)
        } catch (err: unknown) {
            console.error('Return error:', err)
            addToast(err instanceof Error ? err.message : 'Failed to submit return request', 'error')
        } finally {
            setSubmittingReturn(false)
        }
    }

    if (loading) return <Loader text="Fetching status..." />

    if (!urlOrderId) {
        return (
            <div className={styles.container}>
                <div className={styles.content} style={{ textAlign: 'center', padding: '100px 20px' }}>
                    <AlertTriangle size={48} style={{ color: '#ffae00', marginBottom: '20px' }} />
                    <h2>No Order Selected</h2>
                    <p style={{ opacity: 0.6, marginBottom: '32px' }}>Please select an order from your history to track.</p>
                    <button onClick={() => router.push('/orders')} className="btn">View My Orders</button>
                </div>
            </div>
        )
    }

    // Calculate current step index based on status
    let currentStepIdx = -1
    if (order) {
        if (order.status === 'ordered') currentStepIdx = 1
        else if (order.status === 'pending_confirmation') currentStepIdx = 2
        else if (order.status === 'payment_confirmed' || order.status === 'processing') currentStepIdx = 3
        else if (order.status === 'printing') currentStepIdx = 4
        else if (order.status === 'completed') currentStepIdx = 5
        else if (order.status === 'shipped') currentStepIdx = 6
        else if (order.status === 'delivered') currentStepIdx = 7
        else if (order.status === 'return_requested') currentStepIdx = 8
        else if (order.status === 'return_refused') currentStepIdx = 8 // Stop at return step but highlight error
        else if (order.status === 'returned') currentStepIdx = 9
        else if (order.status === 'refunded') currentStepIdx = 10
        else currentStepIdx = 0 // Initial Received state
    }

    const cancellableStatuses = ['ordered', 'pending_confirmation', 'payment_confirmed']
    const canCancel = order && cancellableStatuses.includes(order.status)

    return (
        <div className={styles.container}>
            <div className={styles.content}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <BackButton fallback="/orders" />
                        <h1 className="title-gradient" style={{ margin: 0, fontSize: '1.6rem', fontFamily: 'monospace' }}>
                            #{order ? order.id.slice(0, 8).toUpperCase() : '...'}
                        </h1>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {order && order.status !== 'cancelled' && (
                            <button
                                onClick={() => setShowCancelConfirm(true)}
                                disabled={!canCancel || cancelling}
                                style={{
                                    padding: '10px 20px',
                                    borderRadius: '12px',
                                    border: '1px solid rgba(255,0,85,0.2)',
                                    background: canCancel ? 'rgba(255,0,85,0.05)' : 'rgba(255,255,255,0.02)',
                                    color: canCancel ? '#ff0055' : 'rgba(255,255,255,0.3)',
                                    cursor: canCancel ? 'pointer' : 'not-allowed',
                                    fontWeight: 700,
                                    fontSize: '0.9rem',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {cancelling ? 'Cancelling...' : canCancel ? 'Cancel Order' : 'Non-Cancellable'}
                            </button>
                        )}

                        {order && order.status === 'delivered' && (
                            <button
                                onClick={() => setShowReturnModal(true)}
                                className="btn btn-outline"
                                style={{
                                    padding: '10px 20px',
                                    borderRadius: '12px',
                                    border: '1px solid #ffae00',
                                    color: '#ffae00',
                                    background: 'transparent',
                                    fontWeight: 700,
                                    fontSize: '0.9rem'
                                }}
                            >
                                <RotateCcw size={16} style={{ marginRight: '8px' }} /> Return/Refund
                            </button>
                        )}
                    </div>
                </div>

                {/* Inline cancel confirmation */}
                {showCancelConfirm && (
                    <div style={{
                        background: 'rgba(255,0,85,0.04)',
                        border: '1px solid rgba(255,0,85,0.2)',
                        borderRadius: '16px',
                        padding: '20px 24px',
                        marginBottom: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px'
                    }}>
                        <XCircle size={28} color="#ff0055" style={{ flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                            <strong style={{ color: '#ff0055' }}>Cancel this order?</strong>
                            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', opacity: 0.55 }}>This action cannot be undone. Your order will be permanently cancelled.</p>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
                            <button
                                onClick={() => setShowCancelConfirm(false)}
                                style={{ padding: '8px 18px', borderRadius: '10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: '0.88rem' }}
                            >Keep Order</button>
                            <button
                                onClick={handleCancel}
                                disabled={cancelling}
                                style={{ padding: '8px 18px', borderRadius: '10px', background: '#ff0055', border: 'none', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: '0.88rem', opacity: cancelling ? 0.6 : 1 }}
                            >{cancelling ? 'Cancelling...' : 'Yes, Cancel'}</button>
                        </div>
                    </div>
                )}

                {error ? (
                    <div className={styles.statusCard} style={{ textAlign: 'center', padding: '60px 20px' }}>
                        <AlertTriangle size={48} color="#ff4d4d" style={{ marginBottom: '16px' }} />
                        <h3 style={{ color: '#ff4d4d' }}>Error Locating Order</h3>
                        <p style={{ opacity: 0.6 }}>{error}</p>
                    </div>
                ) : order && (
                    <div className={styles.statusCard}>
                        {/* Summary */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '20px', marginBottom: '32px' }}>
                            <div>
                                <div style={{ fontSize: '0.7rem', opacity: 0.5, textTransform: 'uppercase', marginBottom: '4px' }}>Tracking Number</div>
                                <div style={{ fontWeight: 800, fontFamily: 'monospace', color: order.tracking_number ? '#39ff14' : 'rgba(255,255,255,0.4)' }}>{order.tracking_number || '--'}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '0.7rem', opacity: 0.5, textTransform: 'uppercase', marginBottom: '4px' }}>Placed On</div>
                                <div style={{ opacity: 0.8 }}>{new Date(order.created_at).toLocaleDateString()}</div>
                            </div>
                        </div>

                        {/* Tracking ID injected from Admin */}
                        {order.tracking_number && (
                            <div style={{
                                background: 'linear-gradient(90deg, rgba(57, 255, 20, 0.05) 0%, rgba(0, 191, 255, 0.05) 100%)',
                                border: '1px solid rgba(57, 255, 20, 0.2)',
                                padding: '20px',
                                borderRadius: '16px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '40px'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(57, 255, 20, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Truck size={24} color="#39ff14" />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: '#39ff14', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>Courier Tracking ID</div>
                                        <div style={{ fontWeight: 900, fontSize: '1.2rem', color: 'white', fontFamily: 'monospace', marginTop: '2px' }}>{order.tracking_number}</div>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '0.7rem', opacity: 0.4 }}>Status</div>
                                    <div style={{ color: '#39ff14', fontWeight: 800 }}>SHIPPED</div>
                                </div>
                            </div>
                        )}

                        {order.status === 'cancelled' ? (
                            <div style={{ textAlign: 'center', padding: '60px 0', border: '1px solid rgba(255,0,85,0.2)', borderRadius: '24px', background: 'rgba(255,0,85,0.02)' }}>
                                <AlertTriangle size={64} color="#ff0055" style={{ marginBottom: '20px' }} />
                                <h3 style={{ color: '#ff0055', fontSize: '1.8rem', marginBottom: '10px' }}>Order Cancelled</h3>
                                <p style={{ opacity: 0.6, maxWidth: '340px', margin: '0 auto' }}>This order has been terminated and will not be processed further by the print farm.</p>
                                <button onClick={() => router.push('/upload')} className="btn" style={{ marginTop: '32px' }}>Start New Print</button>
                            </div>
                        ) : (
                            /* Vertical Milestone Timeline */
                            <div className={styles.timeline}>
                                {STATUS_FLOW.filter(step => {
                                    const isReturnStep = ['return_requested', 'returned', 'refunded'].includes(step.key);
                                    if (!isReturnStep) return true;

                                    // Only show return steps if the order is already in a return-related state
                                    const hasReturnInitiated = ['return_requested', 'returned', 'refunded', 'return_refused'].includes(order.status);
                                    return hasReturnInitiated;
                                }).map((step) => {
                                    const stepIdxInFullFlow = STATUS_FLOW.findIndex(s => s.key === step.key)

                                    // A step is completed if the order has passed it in the full flow, 
                                    // or if the order is delivered (completing all non-return steps)
                                    // Special cases for return status completions:
                                    const isCompleted = stepIdxInFullFlow < currentStepIdx
                                        || (order.status === 'delivered' && stepIdxInFullFlow <= 7)
                                        || (order.status === 'returned' && step.key === 'return_requested')
                                        || (order.status === 'refunded' && (step.key === 'return_requested' || step.key === 'returned'))

                                    // Current step is the one that exactly matches the status, unless it's return_refused which stays at return_requested
                                    const isActuallyCurrent = (order.status === step.key) || (order.status === 'return_refused' && step.key === 'return_requested')

                                    // Only mark as current if NOT completed (to avoid double highlight)
                                    const isCurrent = isActuallyCurrent && !isCompleted

                                    let description = isCompleted ? 'Step Completed' : isCurrent ? 'Current Phase' : 'Upcoming Milestone'

                                    // Custom descriptions for payment flow
                                    // Custom descriptions for payment flow
                                    if (step.key === 'received') {
                                        description = 'Order successfully placed'
                                    } else if (step.key === 'ordered') {
                                        description = isCompleted ? 'Payment proof submitted' : isCurrent ? 'Awaiting your payment' : description
                                    } else if (step.key === 'pending_confirmation') {
                                        description = isCompleted ? 'Order verified' : isCurrent ? 'Admin is verifying your proof' : description
                                    } else if (step.key === 'payment_confirmed') {
                                        description = isCompleted ? 'Order confirmed' : isCurrent ? 'Preparing for print' : description
                                    } else if (step.key === 'printing') {
                                        description = isCompleted ? 'Printing finished' : isCurrent ? 'Printing your items' : description
                                    }

                                    return (
                                        <div key={step.key} className={`${styles.timelineItem} ${isCompleted ? styles.completed : ''} ${isCurrent ? styles.current : ''}`}>
                                            <div className={styles.timelineIcon}>
                                                {isCompleted ? <CheckCircle size={16} /> : <step.icon size={16} />}
                                            </div>
                                            <div className={styles.timelineContent}>
                                                <h3>{step.label}</h3>
                                                <p>{description}</p>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}

                        {order && (order.status === 'return_requested' || order.status === 'returned' || order.status === 'return_refused') && (
                            <div style={{
                                marginTop: '32px',
                                padding: '24px',
                                background: order.status === 'return_refused' ? 'rgba(255, 0, 85, 0.05)' :
                                    order.status === 'returned' ? 'rgba(57, 255, 20, 0.05)' :
                                        'rgba(255, 174, 0, 0.05)',
                                border: `1px solid ${order.status === 'return_refused' ? 'rgba(255, 0, 85, 0.2)' :
                                    order.status === 'returned' ? 'rgba(57, 255, 20, 0.2)' :
                                        'rgba(255, 174, 0, 0.2)'}`,
                                borderRadius: '16px',
                                textAlign: 'center'
                            }}>
                                <RotateCcw size={32} color={order.status === 'return_refused' ? '#ff0055' : order.status === 'returned' ? '#39ff14' : '#ffae00'} style={{ marginBottom: '16px' }} />
                                <h3 style={{ color: order.status === 'return_refused' ? '#ff0055' : order.status === 'returned' ? '#39ff14' : '#ffae00', marginBottom: '8px' }}>
                                    {order.status === 'return_requested' ? 'Return Request Pending' :
                                        order.status === 'returned' ? 'Return Request Accepted' :
                                            'Return Request Refused'}
                                </h3>
                                <p style={{ fontSize: '0.9rem', opacity: 0.6 }}>
                                    {order.status === 'return_requested' ? 'Our team is reviewing your return request.' :
                                        order.status === 'returned' ? 'Your return request has been approved. Our team will contact you for next steps.' :
                                            'Your return request has been declined.'}
                                </p>

                                {order.admin_return_note && (
                                    <div style={{
                                        marginTop: '16px',
                                        padding: '12px',
                                        background: 'rgba(255,255,255,0.02)',
                                        borderRadius: '8px',
                                        fontSize: '0.85rem',
                                        border: '1px solid rgba(255,255,255,0.05)'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', justifyContent: 'center' }}>
                                            <AlertTriangle size={14} color="#ffae00" />
                                            <strong style={{ opacity: 0.8 }}>Admin Message:</strong>
                                        </div>
                                        <p style={{ margin: 0, opacity: 0.9, fontStyle: 'italic' }}>&quot;{order.admin_return_note}&quot;</p>
                                    </div>
                                )}
                            </div>
                        )}

                        <div style={{ marginTop: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                            <Link
                                href={`/contact?subject=Order Help: ${order.id}`}
                                style={{
                                    textDecoration: 'none',
                                    padding: '12px 24px',
                                    borderRadius: '12px',
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    color: 'white',
                                    fontWeight: 600,
                                    fontSize: '0.9rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                            >
                                <Package size={18} />
                                Need Help? Contact Support
                            </Link>
                            <p style={{ fontSize: '0.8rem', opacity: 0.3 }}>Synchronized with PrintHub Manufacturing System</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Return Modal */}
            {showReturnModal && (
                <div className={styles.modalOverlay}>
                    <div className="glass" style={{
                        maxWidth: '500px',
                        width: '90%',
                        padding: '32px',
                        borderRadius: '24px',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                            <div style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '14px',
                                background: 'rgba(255, 174, 0, 0.1)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <RotateCcw size={24} color="#ffae00" />
                            </div>
                            <div>
                                <h2 style={{ margin: 0 }}>Return Request</h2>
                                <p style={{ margin: 0, opacity: 0.5, fontSize: '0.85rem' }}>Order #{order?.id?.slice(0, 8).toUpperCase()}</p>
                            </div>
                        </div>

                        <p style={{ fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '24px' }}>
                            Please provide a reason for your return or refund request. Our team will review your request and get back to you within 24-48 hours.
                        </p>

                        <div style={{ marginBottom: '24px' }}>
                            <label htmlFor="returnReasonInput" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#ffae00', marginBottom: '8px', textTransform: 'uppercase' }}>Reason for Return</label>
                            <textarea
                                id="returnReasonInput"
                                value={returnReason}
                                onChange={(e) => setReturnReason(e.target.value)}
                                placeholder="e.g., Damaged item, Incorrect material, Quality issues..."
                                style={{
                                    width: '100%',
                                    minHeight: '100px',
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '12px',
                                    padding: '16px',
                                    color: 'white',
                                    fontSize: '0.9rem',
                                    resize: 'none',
                                    outline: 'none',
                                    marginBottom: '16px'
                                }}
                            />

                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#00bfff', marginBottom: '8px', textTransform: 'uppercase' }}>Evidence (Photos/Videos)</label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '10px' }}>
                                {returnEvidence.map((file, i) => (
                                    <div key={i} style={{ position: 'relative', aspectRatio: '1', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                                        {file.type.startsWith('image/') ? (
                                            <ImageIcon size={24} color="#00bfff" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0.4 }} />
                                        ) : (
                                            <RotateCcw size={24} color="#00bfff" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0.4 }} />
                                        )}
                                        <div style={{ fontSize: '0.6rem', position: 'absolute', bottom: '4px', left: '4px', right: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', background: 'rgba(0,0,0,0.5)', padding: '2px' }}>{file.name}</div>
                                        <button
                                            onClick={() => setReturnEvidence(prev => prev.filter((_, idx) => idx !== i))}
                                            style={{ position: 'absolute', top: '2px', right: '2px', background: 'rgba(255,0,85,0.8)', border: 'none', borderRadius: '50%', width: '16px', height: '16px', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '10px' }}
                                        >✕</button>
                                    </div>
                                ))}
                                <label style={{
                                    aspectRatio: '1', borderRadius: '8px', border: '1px dashed rgba(0,191,255,0.3)',
                                    background: 'rgba(0,191,255,0.02)', display: 'flex', flexDirection: 'column',
                                    alignItems: 'center', justifyContent: 'center', cursor: 'pointer', gap: '4px',
                                    transition: 'all 0.2s'
                                }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,191,255,0.05)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,191,255,0.02)'}>
                                    <Upload size={18} color="#00bfff" />
                                    <span style={{ fontSize: '0.6rem', color: '#00bfff', fontWeight: 700 }}>ADD FILE</span>
                                    <input
                                        type="file"
                                        multiple
                                        accept="image/*,video/*"
                                        onChange={e => {
                                            const files = Array.from(e.target.files || [])
                                            setReturnEvidence(prev => [...prev, ...files])
                                        }}
                                        style={{ display: 'none' }}
                                    />
                                </label>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                onClick={() => setShowReturnModal(false)}
                                className="btn btn-outline"
                                style={{ flex: 1 }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleReturn}
                                disabled={!returnReason.trim() || submittingReturn}
                                className="btn"
                                style={{
                                    flex: 2,
                                    background: '#ffae00',
                                    color: 'black',
                                    opacity: (!returnReason.trim() || submittingReturn) ? 0.5 : 1
                                }}
                            >
                                {submittingReturn ? 'Submitting...' : 'Submit Request'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )

}

export default function TrackingPage() {
    return (
        <Suspense fallback={<Loader text="Loading tracker..." />}>
            <TrackingContent />
        </Suspense>
    )
}
