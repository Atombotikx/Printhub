'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import styles from './Orders.module.css'
import { Package, Clock, Truck, CheckCircle, ChevronRight, Search, RotateCcw, Mail, ArrowLeft, XCircle, Eye, Download, X } from 'lucide-react'
import BackButton from '@/components/BackButton'
import { createClient } from '@/utils/supabase/client'
import { User } from '@supabase/supabase-js'
import { formatCurrency } from '@/utils/pricingEngine'
import { getCustomerSignedModelUrl, getCustomerDownloadUrl } from '@/app/(customer)/actions'
import { useQueueStore } from '@/store/queueStore'
import { useToastStore } from '@/store/toastStore'
import Loader from '@/components/Loader'
import dynamic from 'next/dynamic'

const STLViewer = dynamic(() => import('@/components/STLViewer'), { ssr: false, loading: () => <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader text="Loading 3D Model..." fullPage={false} /></div> })

export default function OrdersPage() {
    const router = useRouter()
    const [user, setUser] = useState<User | null>(null)
    const [orders, setOrders] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [previewItem, setPreviewItem] = useState<any | null>(null)

    useEffect(() => {
        const supabase = createClient()
        let channel: any = null

        const getData = async () => {
            try {
                const { data: { user }, error: authError } = await supabase.auth.getUser()

                if (authError || !user) {
                    router.push('/login?callbackUrl=/orders')
                    return
                }

                setUser(user)

                const fetchOrders = async () => {
                    const { data } = await supabase
                        .from('orders')
                        .select('*, order_items(*)')
                        .eq('user_id', user.id)
                        .order('created_at', { ascending: false })

                    if (data) setOrders(data)
                    setLoading(false)
                }

                fetchOrders()

                channel = supabase.channel('order-status-sync')
                    .on('postgres_changes',
                        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `user_id=eq.${user.id}` },
                        () => fetchOrders()
                    )
                    .subscribe()

            } catch (err) {
                setLoading(false)
            }
        }

        getData()

        return () => {
            if (channel) supabase.removeChannel(channel)
        }
    }, [router])

    const [redirectingId, setRedirectingId] = useState<string | null>(null)

    const handlePayNow = (orderId: string) => {
        setRedirectingId(orderId)
        router.push(`/payment/${orderId}`)
    }

    const handleReprint = (orderItem: any) => {
        const addToast = useToastStore.getState().addToast
        const addToQueue = useQueueStore.getState().addToQueue

        // Create a mock File object for the reprint (we don't have the actual file)
        const mockFile = new File([], orderItem.file_name, { type: 'model/stl' })

        // Create a proper QueueItem from the order item
        const reprintItem = {
            id: `reprint-${Date.now()}`, // Unique ID for queue
            file: mockFile,
            fileName: orderItem.file_name,
            fileUrl: orderItem.file_url,
            size: 0, // Size not stored in order
            uploadProgress: 100, // Already uploaded
            status: 'pending' as const,
            // Store print configuration for reprint
            reprintConfig: {
                material: orderItem.material,
                color: orderItem.color,
                layerHeight: orderItem.layer_height || 0.2,
                infill: orderItem.infill || 20,
                supportType: orderItem.support_type || 'none'
            }
        }

        addToQueue(reprintItem)
        addToast('Item added to queue for reprinting!', 'success')
        router.push(`/configure?source=queue&id=${reprintItem.id}`)
    }

    const handleDownloadSTL = async (e: React.MouseEvent, url: string, fileName: string) => {
        e.stopPropagation()
        const addToast = useToastStore.getState().addToast
        try {
            // Use dedicated download action — generates a signed URL with
            // Content-Disposition: attachment; filename="..."
            // This forces the browser to download with the correct filename and extension.
            // No blob/fetch needed — the server header does the work.
            const res = await getCustomerDownloadUrl(url, fileName)
            if (!res.data) throw new Error(res.error || 'Could not get download URL')

            // Navigate to the signed URL; Content-Disposition forces a download
            window.location.href = res.data

            addToast('Download started', 'success')
        } catch (error) {
            console.error('Download error:', error)
            addToast('Failed to download file', 'error')
        }
    }







    if (loading) return <Loader text="Loading your orders..." />

    if (!user) return null

    return (
        <div className={styles.container}>
            <div className={styles.pageHeader}>
                <div className={styles.headerLeft}>
                    <BackButton fallback="/" />
                </div>
                <div className={styles.headerContent}>
                    <h1 className="title-gradient">Your orders</h1>
                    <p className={styles.subtitle}>Track and manage your 3D printing jobs in real-time</p>
                </div>
                <div className={styles.headerRight} />
            </div>


            {
                orders.length === 0 ? (
                    <div className={styles.emptyState}>
                        <Package size={64} style={{ opacity: 0.3, marginBottom: '20px' }} />
                        <h3>No orders yet</h3>
                        <p style={{ opacity: 0.6 }}>When you place an order, it will appear here.</p>
                        <Link href="/upload" className="btn" style={{ marginTop: '20px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                            Start Printing
                        </Link>
                    </div>
                ) : (
                    <div className={styles.splitLayout}>
                        {/* Current Orders Panel */}
                        <div className={styles.panel}>
                            <div className={styles.panelHeader}>
                                <h2><Clock size={18} /> Active Jobs</h2>
                                <span className={styles.countBadge}>
                                    {orders.filter(o => !['delivered', 'cancelled', 'returned', 'refunded', 'return_refused', 'return_requested'].includes(o.status)).length}
                                </span>
                            </div>
                            <div className={styles.panelContent}>
                                {orders.filter(o => !['delivered', 'cancelled', 'returned', 'refunded', 'return_refused', 'return_requested'].includes(o.status)).length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '40px 20px', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                                        <Package size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
                                        <h3 style={{ fontSize: '1.1rem', marginBottom: '8px' }}>No active orders</h3>
                                        <p style={{ fontSize: '0.85rem', opacity: 0.5, marginBottom: '20px' }}>You don't have any prints in progress.</p>
                                        <Link href="/upload" className="btn btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 20px', fontSize: '0.85rem' }}>
                                            Start Printing
                                        </Link>
                                    </div>
                                ) : (
                                    orders
                                        .filter(o => !['delivered', 'cancelled', 'returned', 'refunded', 'return_refused', 'return_requested'].includes(o.status))
                                        .map(order => (
                                            <div key={order.id} className={styles.orderCard}>
                                                <div>
                                                    <div className={styles.orderIdInfo}>
                                                        <h2>#{order.id.slice(0, 8).toUpperCase()}</h2>
                                                        <span className={styles.orderDate}>{new Date(order.created_at).toLocaleDateString()}</span>
                                                    </div>
                                                    <div className={styles.trackingInfo}>
                                                        <span className={`${styles.trackingVal} ${!order.tracking_number ? styles.none : ''}`}>
                                                            {order.tracking_number || 'Tracking ID TBA'}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className={`${styles.statusBadge} ${styles[order.status]}`}>
                                                    {(order.status === 'ordered' || order.status === 'pending') && <Clock size={12} />}
                                                    {order.status === 'pending_confirmation' && <Search size={12} color="#ffae00" />}
                                                    {order.status === 'payment_confirmed' && <CheckCircle size={12} color="#39ff14" />}
                                                    {order.status === 'processing' && <RotateCcw size={12} className={styles.spin} />}
                                                    {order.status === 'shipped' && <Truck size={12} />}
                                                    {order.status === 'completed' && <CheckCircle size={12} />}
                                                    <span style={{ color: order.status === 'pending_confirmation' ? '#ffae00' : 'inherit' }}>
                                                        {order.status === 'pending_confirmation' ? 'PENDING CONFIRMATION' :
                                                            order.status === 'payment_confirmed' ? 'ORDER CONFIRMED' :
                                                                order.status === 'return_requested' ? 'RETURN REQUESTED' :
                                                                    order.status === 'return_refused' ? 'RETURN DECLINED' :
                                                                        order.status.replace('_', ' ').toUpperCase()}
                                                    </span>
                                                </div>

                                                <div className={styles.priceSection}>
                                                    <div className={styles.priceVal}>
                                                        {formatCurrency(order.total_amount)}
                                                        {order.delivery_method !== 'pickup' && <span style={{ fontSize: '0.7rem', opacity: 0.5, marginLeft: '4px' }}>+ shipping</span>}
                                                    </div>
                                                </div>

                                                <div className={styles.actions}>
                                                    {order.status === 'ordered' && (
                                                        <button
                                                            className={styles.payNowBtn}
                                                            onClick={() => handlePayNow(order.id)}
                                                            disabled={redirectingId === order.id}
                                                        >
                                                            {redirectingId === order.id ? (
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                    <RotateCcw size={14} className={styles.spin} /> Redirecting...
                                                                </div>
                                                            ) : 'Pay Now'}
                                                        </button>
                                                    )}

                                                    {order.order_items && order.order_items.length > 0 && (
                                                        <>
                                                            <button
                                                                onClick={() => setPreviewItem({ ...order.order_items[0], orderId: order.id })}
                                                                className={styles.contactBtn}
                                                                style={{ border: '1px solid rgba(0, 191, 255, 0.4)', color: '#00bfff', background: 'rgba(0, 191, 255, 0.05)', backgroundColor: 'rgba(0, 191, 255, 0.05)', padding: '8px 12px', minWidth: 'auto', flexShrink: 0 }}
                                                                title="Preview 3D Model"
                                                            >
                                                                <Eye size={14} /> Preview
                                                            </button>
                                                        </>
                                                    )}
                                                    <Link href={`/contact?subject=Order Help: ${order.id}`} className={styles.contactBtn} title="Contact Support">
                                                        <Mail size={16} />
                                                    </Link>
                                                    <Link href={`/tracking?id=${order.id}`} className={styles.trackBtn}>
                                                        Track <ChevronRight size={14} />
                                                    </Link>
                                                </div>
                                            </div>
                                        )))}
                            </div>
                        </div>

                        {/* Past Orders Panel */}
                        <div className={styles.panel}>
                            <div className={styles.panelHeader}>
                                <h2><CheckCircle size={18} /> Past Orders</h2>
                                <span className={styles.countBadge}>
                                    {orders.filter(o => ['delivered', 'cancelled', 'returned', 'refunded', 'return_refused', 'return_requested'].includes(o.status)).length}
                                </span>
                            </div>
                            <div className={styles.panelContent}>
                                {orders
                                    .filter(o => ['delivered', 'cancelled', 'returned', 'refunded', 'return_refused', 'return_requested'].includes(o.status))
                                    .map(order => (
                                        <div key={order.id} className={styles.orderCard}>
                                            <div>
                                                <div className={styles.orderIdInfo}>
                                                    <h2>#{order.id.slice(0, 8).toUpperCase()}</h2>
                                                    <span className={styles.orderDate}>{new Date(order.created_at).toLocaleDateString()}</span>
                                                </div>
                                                <div className={styles.trackingInfo}>
                                                    <span className={styles.trackingVal}>
                                                        {order.tracking_number}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className={`${styles.statusBadge} ${styles[order.status]}`}>
                                                {['returned', 'refunded', 'return_requested', 'return_refused'].includes(order.status) ?
                                                    (order.status === 'return_refused' ? <XCircle size={12} /> : <RotateCcw size={12} />) :
                                                    <CheckCircle size={12} />}
                                                <span>
                                                    {order.status === 'pending_confirmation' ? 'PENDING CONFIRMATION' :
                                                        order.status === 'payment_confirmed' ? 'ORDER CONFIRMED' :
                                                            order.status === 'return_requested' ? 'RETURN REQUESTED' :
                                                                order.status === 'return_refused' ? 'RETURN DECLINED' :
                                                                    order.status.replace('_', ' ').toUpperCase()}
                                                </span>
                                            </div>

                                            <div className={styles.priceSection}>
                                                <div className={styles.priceVal}>
                                                    {formatCurrency(order.total_amount)}
                                                    {order.delivery_method !== 'pickup' && <span style={{ fontSize: '0.7rem', opacity: 0.5, marginLeft: '4px' }}>+ shipping</span>}
                                                </div>
                                            </div>

                                            <div className={styles.actions}>
                                                {order.order_items && order.order_items.length > 0 && (
                                                    <>
                                                        <button
                                                            onClick={() => setPreviewItem({ ...order.order_items[0], orderId: order.id })}
                                                            className={styles.contactBtn}
                                                            style={{ border: '1px solid rgba(0, 191, 255, 0.4)', color: '#00bfff', background: 'rgba(0, 191, 255, 0.05)', backgroundColor: 'rgba(0, 191, 255, 0.05)', padding: '8px 12px', minWidth: 'auto', flexShrink: 0 }}
                                                            title="Preview 3D Model"
                                                        >
                                                            <Eye size={14} /> Preview
                                                        </button>
                                                        <button
                                                            onClick={() => handleReprint(order.order_items[0])}
                                                            className={styles.contactBtn}
                                                            style={{ border: '1px solid rgba(57, 255, 20, 0.4)', color: '#39ff14', background: 'rgba(57, 255, 20, 0.05)', backgroundColor: 'rgba(57, 255, 20, 0.05)', padding: '8px 12px', minWidth: 'auto', flexShrink: 0 }}
                                                            title="Reorder this print"
                                                        >
                                                            <RotateCcw size={14} /> Reorder
                                                        </button>
                                                    </>
                                                )}
                                                <Link href={`/contact?subject=Order Help: ${order.id}`} className={styles.contactBtn} title="Contact Support">
                                                    <Mail size={16} />
                                                </Link>
                                                <Link href={`/tracking?id=${order.id}`} className={styles.trackBtn}>
                                                    Details <ChevronRight size={14} />
                                                </Link>
                                            </div>

                                        </div>
                                    ))}
                            </div>
                        </div>
                    </div>
                )
            }

            {previewItem && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
                    animation: 'fadeIn 0.2s ease'
                }}>
                    <div className="glass" style={{ width: '90%', maxWidth: '800px', height: '80vh', display: 'flex', flexDirection: 'column', borderRadius: '24px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.4)' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'white' }}>{previewItem.file_name}</h3>
                                <div style={{ fontSize: '0.8rem', opacity: 0.5, marginTop: '4px' }}>Order #{previewItem.orderId?.slice(0, 8).toUpperCase()}</div>
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button
                                    onClick={(e) => handleDownloadSTL(e, previewItem.file_url, previewItem.file_name)}
                                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: '#39ff14', color: 'black', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', transition: 'transform 0.2s' }}
                                    onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                                    onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                                >
                                    <Download size={16} /> Download
                                </button>
                                <button
                                    onClick={() => setPreviewItem(null)}
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', cursor: 'pointer', transition: 'background 0.2s' }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,0,85,0.2)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>
                        <div style={{ flex: 1, position: 'relative', background: '#0d1117' }}>
                            <STLViewer
                                url={previewItem.file_url}
                                color={previewItem.color || '#39ff14'}
                                autoRotate={true}
                                showCrossSection={false}
                                wireframe={false}
                                showLoader={true}
                                urlResolver={getCustomerSignedModelUrl}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div >
    )
}
