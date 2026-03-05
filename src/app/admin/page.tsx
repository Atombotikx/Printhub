'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { User } from '@supabase/supabase-js'
import { formatCurrency } from '@/utils/pricingEngine'
import styles from './Admin.module.css'
import { getAdminStats, getAdminFinancials, getSiteConfig, updateSiteConfig, getAdminTestimonials, updateTestimonialAdmin, deleteTestimonialAdmin, submitUserTestimonial, uploadPaymentQrAdmin, getPaymentQrSignedUrl } from './actions'
import { RefreshCw, Upload, CreditCard, Phone, Save, FileText, HelpCircle, Truck, RotateCcw, Shield, MessageSquare, Plus, Trash2, Edit3, Check, Megaphone, Star } from 'lucide-react'
import { useToastStore } from '@/store/toastStore'
import { useAdminStore } from '@/store/adminStore'
import Link from 'next/link'
import Loader from '@/components/Loader'

// Removed client-side admin email list for security

export default function AdminDashboard() {
    const router = useRouter()
    const [user, setUser] = useState<User | null>(null)
    const [orders, setOrders] = useState<any[]>([])
    const [financials, setFinancials] = useState<{ totalRevenue: number; estimatedProfit: number } | null>(null)
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [qrUpdating, setQrUpdating] = useState(false)
    const [qrError, setQrError] = useState(false)
    const [qrSignedUrl, setQrSignedUrl] = useState<string | null>(null)
    const [migrationNeeded, setMigrationNeeded] = useState(false)
    const addToast = useToastStore((state) => state.addToast)

    const [savingContacts, setSavingContacts] = useState(false)
    const [contactInfo, setContactInfo] = useState({
        instagram: '',
        whatsapp: '',
        email: '',
        phone: '',
        address: '',
        google_maps: ''
    })

    const [policies, setPolicies] = useState({
        faq: '',
        shipping: '',
        returns: '',
        terms: ''
    })
    const [savingPolicies, setSavingPolicies] = useState(false)

    // Testimonials state
    interface Testimonial { id?: string; name: string; role: string; quote: string; initials: string; rating: number; is_approved?: boolean; admin_reply?: string }
    const DEFAULT_TESTIMONIALS: Testimonial[] = []
    const [testimonials, setTestimonials] = useState<Testimonial[]>([])
    const [savingTestimonials, setSavingTestimonials] = useState(false)
    const [editingTestimonial, setEditingTestimonial] = useState<number | null>(null)
    const [newTestimonial, setNewTestimonial] = useState<Testimonial>({ name: '', role: '', quote: '', initials: '', rating: 5 })
    const [showAddTestimonial, setShowAddTestimonial] = useState(false)
    const [tmFilter, setTmFilter] = useState<'all' | 1 | 2 | 3 | 4 | 5>('all')
    const [replyingTo, setReplyingTo] = useState<string | null>(null)
    const [replyText, setReplyText] = useState('')

    // Admin Store
    const {
        materialTypes,
        supportTypes,
        addMaterialType,
        removeMaterialType,
        addSupportType,
        removeSupportType
    } = useAdminStore()

    // Work Hours state
    interface WorkHourRow { day: string; hours: string }
    const DEFAULT_HOURS: WorkHourRow[] = [
        { day: 'Monday – Friday', hours: '9:00 AM – 8:00 PM' },
        { day: 'Saturday', hours: '10:00 AM – 6:00 PM' },
        { day: 'Sunday', hours: 'Closed' },
    ]
    const [workHours, setWorkHours] = useState<WorkHourRow[]>(DEFAULT_HOURS)
    const [savingHours, setSavingHours] = useState(false)

    // Announcement Banner state
    const [bannerConfig, setBannerConfig] = useState({ message: '', active: false, type: 'info' })
    const [savingBanner, setSavingBanner] = useState(false)

    useEffect(() => {
        const checkUser = async () => {
            try {
                // Call server action to check admin status securely
                const { isCurrentUserAdmin } = await import('./actions')
                const isAdmin = await isCurrentUserAdmin()

                if (!isAdmin) {
                    router.push('/')
                    return
                }

                const supabase = createClient()
                const { data: { user } } = await supabase.auth.getUser()
                setUser(prev => prev?.id === user?.id ? prev : user)
                setLoading(false)
            } catch (err) {
                console.error('[Admin] Auth Error:', err)
                router.push('/')
            }
        }
        checkUser()
    }, [router])

    // Load a fresh signed URL for the QR on mount and after upload
    const refreshQrUrl = async () => {
        const { data } = await getPaymentQrSignedUrl()
        if (data) {
            setQrSignedUrl(data)
            setQrError(false)
        } else {
            setQrError(true)
        }
    }

    const handleQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setQrUpdating(true)
        try {
            // Pass the file through FormData to the server action (service role key)
            const formData = new FormData()
            formData.append('file', file)
            const { success, error } = await uploadPaymentQrAdmin(formData)

            if (!success) throw new Error(error || 'Upload failed')

            // Refresh the displayed QR with a fresh signed URL
            await refreshQrUrl()
            addToast('Payment QR updated successfully', 'success')
        } catch (err: any) {
            addToast(err.message || 'Upload failed', 'error')
        } finally {
            setQrUpdating(false)
            e.target.value = ''
        }
    }

    const fetchData = async () => {
        setRefreshing(true)
        try {
            const { isCurrentUserAdmin } = await import('./actions')
            const isAdmin = await isCurrentUserAdmin()
            if (!isAdmin) return
            const [statsRes, finRes, configRes, policyRes] = await Promise.all([
                getAdminStats(),
                getAdminFinancials(),
                getSiteConfig('contact_info'),
                getSiteConfig('site_policies')
            ])
            if (statsRes.data) setOrders(statsRes.data)
            if (finRes.data) setFinancials(finRes.data as any)

            if (configRes.error?.includes('site_config') || configRes.error?.includes('schema cache')) {
                setMigrationNeeded(true)
            } else if (configRes.data) {
                setContactInfo(prev => ({ ...prev, ...configRes.data }))
                setMigrationNeeded(false)
            }

            if (policyRes.data) {
                setPolicies(prev => ({ ...prev, ...policyRes.data }))
            }

            const testimonialsRes = await getAdminTestimonials()
            if (testimonialsRes.data) {
                setTestimonials(testimonialsRes.data)
            }

            const hoursRes = await getSiteConfig('work_hours')
            if (hoursRes.data && Array.isArray(hoursRes.data)) {
                setWorkHours(hoursRes.data)
            }

            const bannerRes = await getSiteConfig('announcement_banner')
            if (bannerRes.data) {
                setBannerConfig(bannerRes.data)
            }

            setMigrationNeeded(false)
        } catch (err: any) {
            setRefreshing(false)
        }
    }

    const handleSaveContacts = async () => {
        setSavingContacts(true)
        const { success, error } = await updateSiteConfig('contact_info', contactInfo)

        if (success) {
            addToast('Contact information updated successfully!', 'success')
        } else {
            addToast(error || 'Failed to update contact information', 'error')
        }
        setSavingContacts(false)
    }

    const handleSavePolicies = async () => {
        setSavingPolicies(true)
        const result = await updateSiteConfig('site_policies', policies)
        if (result.success) {
            addToast('Site policies updated successfully', 'success')
        } else {
            addToast(result.error || 'Failed to update policies', 'error')
        }
        setSavingPolicies(false)
    }

    const handleSaveBanner = async () => {
        setSavingBanner(true)
        const result = await updateSiteConfig('announcement_banner', bannerConfig)
        if (result.success) {
            addToast('Announcement banner updated successfully', 'success')
        } else {
            addToast(result.error || 'Failed to update banner', 'error')
        }
        setSavingBanner(false)
    }

    const handleSaveWorkHours = async (updated: any[]) => {
        setSavingHours(true)
        const { success, error } = await updateSiteConfig('work_hours', updated)
        if (success) {
            addToast('Business hours saved!', 'success')
            setWorkHours(updated)
        } else {
            addToast(error || 'Failed to save hours', 'error')
        }
        setSavingHours(false)
    }

    const getInitials = (name: string) => name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)

    const handleAddTestimonial = async () => {
        if (!newTestimonial.name.trim() || !newTestimonial.quote.trim()) {
            addToast('Name and quote are required', 'error')
            return
        }
        setSavingTestimonials(true)
        const { success, data, error } = await submitUserTestimonial({
            name: newTestimonial.name.trim(),
            role: newTestimonial.role.trim() || 'Customer',
            quote: newTestimonial.quote.trim(),
            rating: newTestimonial.rating,
            initials: getInitials(newTestimonial.name.trim())
        })

        if (success && data && data[0]) {
            // Automatically approve admin-added reviews
            await updateTestimonialAdmin(data[0].id, { is_approved: true })
            setTestimonials(prev => [{ ...data[0], is_approved: true }, ...prev])
            setNewTestimonial({ name: '', role: '', quote: '', initials: '', rating: 5 })
            setShowAddTestimonial(false)
            addToast('Review added!', 'success')
        } else {
            addToast(error || 'Failed to add review', 'error')
        }
        setSavingTestimonials(false)
    }

    const handleApproveTestimonial = async (id: string, approve: boolean) => {
        const { success } = await updateTestimonialAdmin(id, { is_approved: approve })
        if (success) {
            setTestimonials(prev => prev.map(t => t.id === id ? { ...t, is_approved: approve } : t))
            addToast(approve ? 'Testimonial approved!' : 'Testimonial hidden!', 'success')
        }
    }

    const handleUpdateTestimonial = async (id: string, updates: any) => {
        const { success } = await updateTestimonialAdmin(id, updates)
        if (success) {
            setTestimonials(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t))
            addToast('Testimonial updated!', 'success')
            setEditingTestimonial(null)
        }
    }

    const handleDeleteTestimonial = async (id: string) => {
        if (!confirm('Delete this testimonial?')) return
        const { success } = await deleteTestimonialAdmin(id)
        if (success) {
            setTestimonials(prev => prev.filter(t => t.id !== id))
            addToast('Testimonial deleted!', 'success')
        }
    }

    const handleSaveReply = async (id: string, reply: string) => {
        if (!reply.trim()) return
        const { success } = await updateTestimonialAdmin(id, { admin_reply: reply.trim() })
        if (success) {
            setTestimonials(prev => prev.map(t => t.id === id ? { ...t, admin_reply: reply.trim() } : t))
            setReplyingTo(null)
            setReplyText('')
            addToast('Reply saved!', 'success')
        }
    }

    useEffect(() => {
        if (user) {
            const supabase = createClient()
            fetchData()
            refreshQrUrl() // Load QR signed URL on mount

            // Subscribe to real-time order changes
            const channel = supabase.channel('admin-dashboard-sync')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
                    fetchData()
                })
                .subscribe()

            return () => {
                supabase.removeChannel(channel)
            }
        }
    }, [user])

    if (loading || !user) return <Loader text="Verifying permissions..." />
    if (refreshing && orders.length === 0) return <Loader text="Loading dashboard..." />

    const today = new Date().toDateString()

    return (
        <div className="container" style={{ maxWidth: '1200px', padding: '40px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                <div>
                    <h1 className="title-gradient" style={{ margin: 0, fontSize: '2.5rem' }}>Admin Console</h1>
                    <p style={{ opacity: 0.5, marginTop: '8px' }}>Manage your print farm, payments, and site configuration.</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                        onClick={fetchData}
                        className="btn"
                        disabled={refreshing}
                        style={{
                            padding: '10px 24px',
                            background: 'rgba(57,255,20,0.1)',
                            border: '1px solid rgba(57,255,20,0.3)',
                            color: '#39ff14',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            fontWeight: 700,
                            letterSpacing: '0.5px',
                            transition: 'all 0.3s',
                            boxShadow: '0 0 20px rgba(57,255,20,0.1)'
                        }}
                    >
                        <RefreshCw size={18} className={refreshing ? 'spin' : ''} />
                        {refreshing ? 'Syncing...' : 'Sync Stats'}
                    </button>
                </div>
            </div>

            <div className={styles.statsGrid}>
                {/* ... existing stats cards same as before but inside modernized grid if needed ... */}
                <div className={styles.statCard}>
                    <div className={styles.statLabel}>🆕 Received Today</div>
                    <div className={styles.statValue} style={{ color: '#0070f3' }}>
                        {orders.filter(o => new Date(o.created_at).toDateString() === today).length}
                    </div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statLabel}>💰 Pending Payment</div>
                    <div className={styles.statValue} style={{ color: '#ffae00' }}>
                        {orders.filter(o => o.status === 'ordered').length}
                    </div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statLabel}>🔍 Admin Confirmation</div>
                    <div className={styles.statValue} style={{ color: '#39ff14' }}>
                        {orders.filter(o => o.status === 'pending_confirmation').length}
                    </div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statLabel}>🖨️ Printing</div>
                    <div className={styles.statValue} style={{ color: '#00ff88' }}>
                        {orders.filter(o => o.status === 'printing').length}
                    </div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statLabel}>📦 In Shipping</div>
                    <div className={styles.statValue} style={{ color: '#00bfff' }}>
                        {orders.filter(o => o.status === 'shipped').length}
                    </div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statLabel}>🔄 Return Requests</div>
                    <div className={styles.statValue} style={{ color: '#ffae00' }}>
                        {orders.filter(o => o.status === 'return_requested').length}
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '24px' }}>
                <div style={{
                    padding: '28px 32px', borderRadius: '24px',
                    background: 'linear-gradient(135deg, rgba(0,191,255,0.08), rgba(0,0,0,0.2))',
                    border: '1px solid rgba(0,191,255,0.2)',
                    backdropFilter: 'blur(10px)'
                }}>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(0,191,255,0.8)', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 800, marginBottom: '8px' }}>Revenue</div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 900, color: 'white' }}>{financials ? formatCurrency(financials.totalRevenue) : '—'}</div>
                </div>
                <div style={{
                    padding: '28px 32px', borderRadius: '24px',
                    background: 'linear-gradient(135deg, rgba(57,255,20,0.08), rgba(0,0,0,0.2))',
                    border: '1px solid rgba(57,255,20,0.2)',
                    backdropFilter: 'blur(10px)'
                }}>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(57,255,20,0.8)', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 800, marginBottom: '8px' }}>Estimated Profit</div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 900, color: 'white' }}>{financials ? formatCurrency(financials.estimatedProfit) : '—'}</div>
                </div>
            </div>

            {/* ── Migration Warning ── */}
            {migrationNeeded && (
                <div style={{
                    padding: '20px', background: 'rgba(255, 174, 0, 0.1)',
                    border: '1px solid rgba(255, 174, 0, 0.3)', borderRadius: '16px',
                    marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '16px'
                }}>
                    <div style={{ fontSize: '1.5rem' }}>⚠️</div>
                    <div>
                        <div style={{ fontWeight: 800, color: '#ffae00', fontSize: '1rem' }}>Database Migration Required</div>
                        <p style={{ margin: '4px 0 0', fontSize: '0.85rem', opacity: 0.8 }}>
                            The 'site_config' table is missing. Please run the SQL migration in <code>schema.sql</code> using your Supabase SQL Editor to enable site-wide settings.
                        </p>
                    </div>
                </div>
            )}

            {/* ── Settings Grid ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 2fr', gap: '32px', marginTop: '40px' }}>

                {/* Payment QR Section */}
                <div className="glass" style={{ padding: '32px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                        <div style={{ background: 'rgba(57,255,20,0.1)', padding: '10px', borderRadius: '12px' }}>
                            <CreditCard size={20} color="#39ff14" />
                        </div>
                        <h3 style={{ margin: 0 }}>Payment QR</h3>
                    </div>

                    <div style={{
                        aspectRatio: '1', width: '100%', maxWidth: '200px', background: 'white', borderRadius: '16px', padding: '12px',
                        margin: '0 auto 24px', boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
                    }}>
                        {qrError || !qrSignedUrl ? (
                            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: '0.8rem' }}>No QR Found</div>
                        ) : (
                            <img
                                src={qrSignedUrl}
                                alt="Payment QR"
                                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                onError={() => setQrError(true)}
                            />
                        )}
                    </div>

                    <label className="btn" style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                        background: 'white', color: 'black', fontWeight: 700, padding: '14px', borderRadius: '12px', cursor: 'pointer'
                    }}>
                        {qrUpdating ? <RefreshCw size={18} className="spin" /> : <Upload size={18} />}
                        {qrUpdating ? 'Uploading...' : 'Replace QR'}
                        <input type="file" accept="image/*" onChange={handleQrUpload} style={{ display: 'none' }} />
                    </label>
                </div>

                {/* Contact Settings Section */}
                <div className="glass" style={{ padding: '32px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ background: 'rgba(0,191,255,0.1)', padding: '10px', borderRadius: '12px' }}>
                                <Phone size={20} color="#00bfff" />
                            </div>
                            <h3 style={{ margin: 0 }}>Site Contact Info</h3>
                        </div>
                        <button
                            onClick={handleSaveContacts}
                            disabled={savingContacts}
                            className="btn"
                            style={{
                                background: '#39ff14', color: 'black', fontWeight: 700,
                                padding: '8px 20px', borderRadius: '10px', display: 'flex',
                                alignItems: 'center', gap: '8px', fontSize: '0.9rem'
                            }}
                        >
                            {savingContacts ? <RefreshCw size={14} className="spin" /> : <Save size={16} />}
                            {savingContacts ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                        <div>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', opacity: 0.5, marginBottom: '6px', fontWeight: 600 }}>INSTAGRAM</label>
                                <input
                                    type="text"
                                    value={contactInfo.instagram}
                                    onChange={(e) => setContactInfo({ ...contactInfo, instagram: e.target.value })}
                                    style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: 'white' }}
                                />
                            </div>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', opacity: 0.5, marginBottom: '6px', fontWeight: 600 }}>WHATSAPP</label>
                                <input
                                    type="text"
                                    value={contactInfo.whatsapp}
                                    onChange={(e) => setContactInfo({ ...contactInfo, whatsapp: e.target.value })}
                                    style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: 'white' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', opacity: 0.5, marginBottom: '6px', fontWeight: 600 }}>PHONE DISPLAY</label>
                                <input
                                    type="text"
                                    value={contactInfo.phone}
                                    onChange={(e) => setContactInfo({ ...contactInfo, phone: e.target.value })}
                                    style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: 'white' }}
                                />
                            </div>
                        </div>
                        <div>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', opacity: 0.5, marginBottom: '6px', fontWeight: 600 }}>SUPPORT EMAIL</label>
                                <input
                                    type="text"
                                    value={contactInfo.email}
                                    onChange={(e) => setContactInfo({ ...contactInfo, email: e.target.value })}
                                    style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: 'white' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', opacity: 0.5, marginBottom: '6px', fontWeight: 600 }}>ADDRESS</label>
                                <textarea
                                    value={contactInfo.address}
                                    onChange={(e) => setContactInfo({ ...contactInfo, address: e.target.value })}
                                    rows={4}
                                    style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: 'white', resize: 'none' }}
                                />
                            </div>
                            <div style={{ marginTop: '16px' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', opacity: 0.5, marginBottom: '6px', fontWeight: 600 }}>GOOGLE MAPS LINK</label>
                                <input
                                    type="text"
                                    value={contactInfo.google_maps}
                                    onChange={(e) => setContactInfo({ ...contactInfo, google_maps: e.target.value })}
                                    placeholder="https://maps.google.com/..."
                                    style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: 'white' }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Policies Editor Section */}
            <div className="glass" style={{ padding: '32px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)', marginTop: '32px', gridColumn: 'span 2' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: 'rgba(57,255,20,0.1)', padding: '10px', borderRadius: '12px' }}>
                            <FileText size={20} color="#39ff14" />
                        </div>
                        <h3 style={{ margin: 0 }}>Content & Policies Manager</h3>
                    </div>
                    <button
                        onClick={handleSavePolicies}
                        disabled={savingPolicies}
                        className="btn"
                        style={{
                            background: '#39ff14', color: 'black', fontWeight: 700,
                            padding: '10px 24px', borderRadius: '12px', display: 'flex',
                            alignItems: 'center', gap: '8px'
                        }}
                    >
                        {savingPolicies ? <RefreshCw size={18} className="spin" /> : <Save size={18} />}
                        {savingPolicies ? 'Saving...' : 'Publish Content'}
                    </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                    <div>
                        <div style={{ marginBottom: '24px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', opacity: 0.6, marginBottom: '10px', fontWeight: 700 }}>
                                <HelpCircle size={14} /> FAQ CONTENT (JSON Format)
                            </label>
                            <textarea
                                value={policies.faq}
                                onChange={(e) => setPolicies({ ...policies, faq: e.target.value })}
                                rows={8}
                                placeholder='[{"q": "Question?", "a": "Answer."}]'
                                style={{ width: '100%', padding: '16px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', color: 'white', fontFamily: 'monospace', fontSize: '0.85rem' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', opacity: 0.6, marginBottom: '10px', fontWeight: 700 }}>
                                <Truck size={14} /> SHIPPING POLICY
                            </label>
                            <textarea
                                value={policies.shipping}
                                onChange={(e) => setPolicies({ ...policies, shipping: e.target.value })}
                                rows={8}
                                style={{ width: '100%', padding: '16px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', color: 'white', fontSize: '0.9rem' }}
                            />
                        </div>
                    </div>
                    <div>
                        <div style={{ marginBottom: '24px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', opacity: 0.6, marginBottom: '10px', fontWeight: 700 }}>
                                <RotateCcw size={14} /> RETURNS & REFUNDS
                            </label>
                            <textarea
                                value={policies.returns}
                                onChange={(e) => setPolicies({ ...policies, returns: e.target.value })}
                                rows={8}
                                style={{ width: '100%', padding: '16px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', color: 'white', fontSize: '0.9rem' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', opacity: 0.6, marginBottom: '10px', fontWeight: 700 }}>
                                <Shield size={14} /> TERMS OF SERVICE
                            </label>
                            <textarea
                                value={policies.terms}
                                onChange={(e) => setPolicies({ ...policies, terms: e.target.value })}
                                rows={8}
                                style={{ width: '100%', padding: '16px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', color: 'white', fontSize: '0.9rem' }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Announcement Banner ── */}
            <div className="glass" style={{ padding: '32px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)', marginTop: '32px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: 'rgba(57,255,20,0.1)', padding: '10px', borderRadius: '12px' }}>
                            <Megaphone size={20} color="#39ff14" />
                        </div>
                        <div>
                            <h3 style={{ margin: 0 }}>Announcement Banner</h3>
                            <p style={{ margin: '4px 0 0', fontSize: '0.8rem', opacity: 0.4 }}>Global notice shown at the top of the homepage</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: bannerConfig.active ? '#39ff14' : '#666' }}>
                                {bannerConfig.active ? 'ACTIVE' : 'INACTIVE'}
                            </span>
                            <label className={styles.switch}>
                                <input
                                    type="checkbox"
                                    checked={bannerConfig.active}
                                    onChange={(e) => setBannerConfig({ ...bannerConfig, active: e.target.checked })}
                                />
                                <span className={styles.slider}></span>
                            </label>
                        </div>
                        <button
                            onClick={handleSaveBanner}
                            disabled={savingBanner}
                            className="btn"
                            style={{
                                background: '#39ff14', color: 'black', fontWeight: 700,
                                padding: '10px 24px', borderRadius: '12px', display: 'flex',
                                alignItems: 'center', gap: '8px'
                            }}
                        >
                            {savingBanner ? <RefreshCw size={18} className="spin" /> : <Save size={18} />}
                            {savingBanner ? 'Saving...' : 'Update Banner'}
                        </button>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                    {(['info', 'offer', 'maintenance', 'unavailable'] as const).map((type) => (
                        <button
                            key={type}
                            onClick={() => setBannerConfig({ ...bannerConfig, type })}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '10px',
                                border: '1px solid',
                                fontSize: '0.85rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                background: bannerConfig.type === type ?
                                    (type === 'info' ? 'rgba(57,255,20,0.15)' :
                                        type === 'offer' ? 'rgba(0,191,255,0.15)' :
                                            type === 'maintenance' ? 'rgba(255,174,0,0.15)' :
                                                'rgba(255,71,87,0.15)') : 'rgba(255,255,255,0.03)',
                                borderColor: bannerConfig.type === type ?
                                    (type === 'info' ? '#39ff14' :
                                        type === 'offer' ? '#00bfff' :
                                            type === 'maintenance' ? '#ffae00' :
                                                '#ff4757') : 'rgba(255,255,255,0.1)',
                                color: bannerConfig.type === type ?
                                    (type === 'info' ? '#39ff14' :
                                        type === 'offer' ? '#00bfff' :
                                            type === 'maintenance' ? '#ffae00' :
                                                '#ff4757') : 'rgba(255,255,255,0.4)',
                            }}
                        >
                            {type.charAt(0).toUpperCase() + type.slice(1)}
                        </button>
                    ))}
                </div>

                <textarea
                    value={bannerConfig.message}
                    onChange={(e) => setBannerConfig({ ...bannerConfig, message: e.target.value })}
                    rows={2}
                    placeholder="Enter announcement message (e.g., 'Free shipping on orders over ₹1000!')"
                    style={{
                        width: '100%', padding: '16px', background: 'rgba(0,0,0,0.2)',
                        border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px',
                        color: 'white', fontSize: '0.95rem', resize: 'none'
                    }}
                />
            </div>

            {/* ── Testimonials Manager ── */}
            <div className="glass" style={{ padding: '32px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)', marginTop: '32px' }}>
                {/* Header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: 'rgba(57,255,20,0.1)', padding: '10px', borderRadius: '12px' }}>
                            <MessageSquare size={20} color="#39ff14" />
                        </div>
                        <div>
                            <h3 style={{ margin: 0 }}>Testimonials Manager</h3>
                            <p style={{ margin: '4px 0 0', fontSize: '0.8rem', opacity: 0.4 }}>Customer reviews shown on the homepage</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowAddTestimonial(!showAddTestimonial)}
                        className="btn"
                        style={{ background: 'rgba(57,255,20,0.15)', color: '#39ff14', border: '1px solid rgba(57,255,20,0.3)', padding: '10px 20px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}
                    >
                        <Plus size={18} /> Add Review
                    </button>
                </div>

                {/* Star filter chips */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                    {(['all', 5, 4, 3, 2, 1] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setTmFilter(f as any)}
                            style={{
                                padding: '6px 14px', borderRadius: '20px', border: '1px solid',
                                fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
                                background: tmFilter === f ? 'rgba(57,255,20,0.15)' : 'rgba(255,255,255,0.04)',
                                borderColor: tmFilter === f ? 'rgba(57,255,20,0.4)' : 'rgba(255,255,255,0.1)',
                                color: tmFilter === f ? '#39ff14' : 'rgba(255,255,255,0.5)',
                                transition: 'all 0.2s'
                            }}
                        >
                            {f === 'all' ? 'All' : `${'★'.repeat(f as number)} ${f}★`}
                        </button>
                    ))}
                    <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)', alignSelf: 'center' }}>
                        {(tmFilter === 'all' ? testimonials : testimonials.filter(t => t.rating === tmFilter)).length} review{testimonials.length !== 1 ? 's' : ''}
                    </span>
                </div>

                {/* Add new testimonial form */}
                {showAddTestimonial && (
                    <div style={{ background: 'rgba(57,255,20,0.04)', border: '1px solid rgba(57,255,20,0.15)', borderRadius: '16px', padding: '24px', marginBottom: '20px' }}>
                        <h4 style={{ margin: '0 0 20px', color: '#39ff14' }}>New Testimonial</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', opacity: 0.5, marginBottom: '6px', fontWeight: 700 }}>NAME *</label>
                                <input value={newTestimonial.name} onChange={e => setNewTestimonial(t => ({ ...t, name: e.target.value }))} placeholder="Customer name" style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: 'white', boxSizing: 'border-box' as any }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', opacity: 0.5, marginBottom: '6px', fontWeight: 700 }}>ROLE / PROFESSION</label>
                                <input value={newTestimonial.role} onChange={e => setNewTestimonial(t => ({ ...t, role: e.target.value }))} placeholder="e.g. Robotics Engineer" style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: 'white', boxSizing: 'border-box' as any }} />
                            </div>
                        </div>
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', opacity: 0.5, marginBottom: '6px', fontWeight: 700 }}>REVIEW TEXT *</label>
                            <textarea value={newTestimonial.quote} onChange={e => setNewTestimonial(t => ({ ...t, quote: e.target.value }))} rows={3} placeholder="Customer's review..." style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: 'white', resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as any }} />
                        </div>
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', opacity: 0.5, marginBottom: '8px', fontWeight: 700 }}>RATING</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                {[1, 2, 3, 4, 5].map(s => (
                                    <button key={s} type="button" onClick={() => setNewTestimonial(t => ({ ...t, rating: s }))} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: s <= newTestimonial.rating ? '#39ff14' : 'rgba(255,255,255,0.2)', fontSize: '1.6rem', lineHeight: 1 }}>★</button>
                                ))}
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button onClick={handleAddTestimonial} disabled={savingTestimonials} className="btn" style={{ background: '#39ff14', color: 'black', fontWeight: 700, padding: '10px 24px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {savingTestimonials ? <RefreshCw size={16} className="spin" /> : <Check size={16} />} Save Review
                            </button>
                            <button onClick={() => setShowAddTestimonial(false)} className="btn" style={{ background: 'rgba(255,255,255,0.06)', color: 'white', padding: '10px 20px', borderRadius: '10px' }}>Cancel</button>
                        </div>
                    </div>
                )}

                {/* Scrollable list — ~3 cards visible */}
                <div style={{ maxHeight: '420px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '4px' }}>
                    {(tmFilter === 'all' ? testimonials : testimonials.filter(t => t.rating === (tmFilter as number))).map((t, i) => {
                        const id = (t.id as string) || i.toString()
                        return (
                            <div key={id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '16px 20px', opacity: t.is_approved ? 1 : 0.6 }}>
                                {/* Main review row */}
                                <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg,#39ff14,#00bfff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'black', fontSize: '0.85rem', flexShrink: 0 }}>
                                        {t.initials || getInitials(t.name)}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px', flexWrap: 'wrap' }}>
                                            <strong style={{ color: 'white', fontSize: '0.95rem' }}>{t.name}</strong>
                                            <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)' }}>{t.role}</span>
                                            <span style={{ color: '#39ff14', fontSize: '0.85rem', letterSpacing: '1px' }}>{'★'.repeat(t.rating ?? 5)}<span style={{ color: 'rgba(255,255,255,0.2)' }}>{'★'.repeat(5 - (t.rating ?? 5))}</span></span>
                                            {!t.is_approved && <span style={{ fontSize: '0.65rem', background: 'rgba(255,0,85,0.2)', color: '#ff0055', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>HIDDEN</span>}
                                        </div>
                                        <p style={{ margin: 0, fontSize: '0.88rem', color: 'rgba(255,255,255,0.55)', fontStyle: 'italic', lineHeight: 1.5 }}>"{t.quote}"</p>

                                        {/* Reply bubble */}
                                        {t.admin_reply && (
                                            <div style={{ marginTop: '10px', padding: '10px 14px', background: 'rgba(57,255,20,0.05)', border: '1px solid rgba(57,255,20,0.15)', borderRadius: '10px', borderLeft: '3px solid #39ff14' }}>
                                                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#39ff14', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Admin Reply</span>
                                                <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>{t.admin_reply}</p>
                                            </div>
                                        )}

                                        {/* Reply input */}
                                        {replyingTo === id && (
                                            <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
                                                <input
                                                    autoFocus
                                                    value={replyText}
                                                    onChange={e => setReplyText(e.target.value)}
                                                    placeholder="Type your reply..."
                                                    onKeyDown={e => { if (e.key === 'Enter') handleSaveReply(id, replyText) }}
                                                    style={{ flex: 1, padding: '8px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', color: 'white', fontFamily: 'inherit', fontSize: '0.88rem' }}
                                                />
                                                <button onClick={() => handleSaveReply(id, replyText)} disabled={savingTestimonials} style={{ padding: '8px 16px', background: '#39ff14', color: 'black', fontWeight: 700, borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    {savingTestimonials ? <RefreshCw size={13} className="spin" /> : null} Reply
                                                </button>
                                                <button onClick={() => { setReplyingTo(null); setReplyText('') }} style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.06)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>✕</button>
                                            </div>
                                        )}
                                    </div>
                                    {/* Action buttons */}
                                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                                        <button
                                            title={t.is_approved ? "Hide" : "Approve"}
                                            onClick={() => handleApproveTestimonial(id, !t.is_approved)}
                                            style={{ width: '34px', height: '34px', borderRadius: '8px', background: t.is_approved ? 'rgba(57,255,20,0.1)' : 'rgba(255,255,255,0.05)', border: `1px solid ${t.is_approved ? '#39ff14' : 'rgba(255,255,255,0.1)'}`, color: t.is_approved ? '#39ff14' : 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                        >
                                            {t.is_approved ? <Check size={14} /> : <Plus size={14} />}
                                        </button>
                                        <button
                                            title="Reply"
                                            onClick={() => { setReplyingTo(replyingTo === id ? null : id); setReplyText(t.admin_reply || '') }}
                                            style={{ width: '34px', height: '34px', borderRadius: '8px', background: replyingTo === id ? 'rgba(57,255,20,0.15)' : 'rgba(255,255,255,0.05)', border: `1px solid ${replyingTo === id ? 'rgba(57,255,20,0.3)' : 'rgba(255,255,255,0.1)'}`, color: replyingTo === id ? '#39ff14' : 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
                                        >
                                            <MessageSquare size={14} />
                                        </button>
                                        <button
                                            title="Delete"
                                            onClick={() => handleDeleteTestimonial(id)}
                                            style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'rgba(255,0,85,0.08)', border: '1px solid rgba(255,0,85,0.2)', color: '#ff0055', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                    {(tmFilter === 'all' ? testimonials : testimonials.filter(t => t.rating === (tmFilter as number))).length === 0 && (
                        <div style={{ textAlign: 'center', padding: '40px', opacity: 0.35 }}>
                            <MessageSquare size={36} style={{ marginBottom: '10px' }} />
                            <p style={{ margin: 0 }}>{tmFilter === 'all' ? 'No reviews yet.' : `No ${tmFilter}★ reviews.`}</p>
                        </div>
                    )}
                </div>
            </div>


            {/* ── Work Hours Manager ── */}
            <div className="glass" style={{ padding: '32px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)', marginTop: '32px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: 'rgba(57,255,20,0.1)', padding: '10px', borderRadius: '12px' }}>
                            <Check size={20} color="#39ff14" />
                        </div>
                        <div>
                            <h3 style={{ margin: 0 }}>Business Hours</h3>
                            <p style={{ margin: '4px 0 0', fontSize: '0.8rem', opacity: 0.4 }}>Displayed on the Contact Us page</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                            onClick={() => setWorkHours(h => [...h, { day: '', hours: '' }])}
                            className="btn"
                            style={{ background: 'rgba(57,255,20,0.12)', color: '#39ff14', border: '1px solid rgba(57,255,20,0.25)', padding: '8px 18px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
                        >
                            <Plus size={16} /> Add Row
                        </button>
                        <button
                            onClick={() => handleSaveWorkHours(workHours)}
                            disabled={savingHours}
                            className="btn"
                            style={{ background: '#39ff14', color: 'black', fontWeight: 700, padding: '8px 22px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                            {savingHours ? <RefreshCw size={16} className="spin" /> : <Save size={16} />} Save Hours
                        </button>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {workHours.map((row, idx) => (
                        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '12px', alignItems: 'center' }}>
                            <input
                                value={row.day}
                                onChange={e => setWorkHours(h => h.map((r, i) => i === idx ? { ...r, day: e.target.value } : r))}
                                placeholder="Day(s), e.g. Monday – Friday"
                                style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: 'white', fontFamily: 'inherit' }}
                            />
                            <input
                                value={row.hours}
                                onChange={e => setWorkHours(h => h.map((r, i) => i === idx ? { ...r, hours: e.target.value } : r))}
                                placeholder="Hours or 'Closed'"
                                style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: 'white', fontFamily: 'inherit' }}
                            />
                            <button
                                onClick={() => setWorkHours(h => h.filter((_, i) => i !== idx))}
                                style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(255,0,85,0.1)', border: '1px solid rgba(255,0,85,0.2)', color: '#ff0055', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                            >
                                <Trash2 size={15} />
                            </button>
                        </div>
                    ))}
                    {workHours.length === 0 && (
                        <p style={{ opacity: 0.4, textAlign: 'center', padding: '20px' }}>No rows yet. Click "Add Row".</p>
                    )}
                </div>
            </div>

            <style>{`
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .glass { background: rgba(255, 255, 255, 0.03); backdrop-filter: blur(10px); }
            `}</style>
        </div >
    )
}
