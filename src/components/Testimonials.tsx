'use client'
import { useEffect, useState, useRef } from 'react'
import styles from './Testimonials.module.css'
import { Star, MessageSquarePlus, X, Loader2, Send } from 'lucide-react'
import { getApprovedTestimonials, submitUserTestimonial } from '@/app/admin/actions'
import { createClient } from '@/utils/supabase/client'
import { useToastStore } from '@/store/toastStore'

interface Testimonial {
    id?: string
    name: string
    role: string
    quote: string
    initials: string
    rating: number
    admin_reply?: string
}


function getInitials(name: string) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export default function Testimonials() {
    const [testimonials, setTestimonials] = useState<Testimonial[]>([])
    const [loading, setLoading] = useState(true)
    const [loggedIn, setLoggedIn] = useState(false)
    const [showModal, setShowModal] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const addToast = useToastStore((state) => state.addToast)
    const trackRef = useRef<HTMLDivElement>(null)

    // Drag-to-scroll
    const drag = useRef({ active: false, startX: 0, scrollLeft: 0 })
    const onMouseDown = (e: React.MouseEvent) => {
        drag.current = { active: true, startX: e.pageX - (trackRef.current?.offsetLeft ?? 0), scrollLeft: trackRef.current?.scrollLeft ?? 0 }
    }
    const onMouseMove = (e: React.MouseEvent) => {
        if (!drag.current.active || !trackRef.current) return
        e.preventDefault()
        const x = e.pageX - (trackRef.current.offsetLeft ?? 0)
        trackRef.current.scrollLeft = drag.current.scrollLeft - (x - drag.current.startX)
    }
    const onMouseUp = () => { drag.current.active = false }

    const [form, setForm] = useState({
        name: '',
        role: '',
        quote: '',
        rating: 5
    })

    useEffect(() => {
        // Load approved testimonials from DB
        getApprovedTestimonials().then(res => {
            if (res.data) {
                setTestimonials(res.data)
            }
            setLoading(false)
        }).catch(() => setLoading(false))

        // Check if user is logged in
        const supabase = createClient()
        supabase.auth.getUser().then((res: any) => {
            const user = res?.data?.user
            if (user) {
                setLoggedIn(true)
                const fullName = user.user_metadata?.full_name || user.email?.split('@')[0] || ''
                setForm(f => ({ ...f, name: fullName }))
            }
        })
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!loggedIn) {
            addToast('Please sign in to submit a review.', 'error')
            setTimeout(() => { window.location.href = '/login' }, 2000)
            return
        }

        if (!form.quote.trim() || !form.name.trim()) {
            addToast('Please fill in all fields', 'error')
            return
        }

        setSubmitting(true)
        try {
            const newTestimonial: Testimonial = {
                name: form.name.trim(),
                role: form.role.trim() || 'Customer',
                quote: form.quote.trim(),
                initials: getInitials(form.name.trim()),
                rating: form.rating
            }

            const res = await submitUserTestimonial(newTestimonial)

            if (res.error) {
                addToast('Failed to submit review. Please try again.', 'error')
            } else {
                setTestimonials(prev => [...prev, newTestimonial])
                addToast('Thank you for your review! 🎉', 'success')
                setShowModal(false)
                setForm(f => ({ ...f, role: '', quote: '', rating: 5 }))
            }
        } finally {
            setSubmitting(false)
        }
    }

    if (loading && testimonials.length === 0) return null

    return (
        <section className={styles.testimonials}>
            <div className="container">
                <div className={styles.header}>
                    <h2 className="title-gradient">What Our Clients Say</h2>
                    <p>Trusted by engineers, designers, and creators across India.</p>
                    <button
                        className={styles.reviewBtn}
                        onClick={() => {
                            if (!loggedIn) {
                                window.location.href = '/login'
                            } else {
                                setShowModal(true)
                            }
                        }}
                    >
                        <MessageSquarePlus size={18} />
                        Leave a Review
                    </button>
                </div>

                <div className={styles.trackWrapper}>
                    {testimonials.length > 0 ? (
                        <div
                            className={styles.track}
                            ref={trackRef}
                            onMouseDown={onMouseDown}
                            onMouseMove={onMouseMove}
                            onMouseUp={onMouseUp}
                            onMouseLeave={onMouseUp}
                        >
                            {testimonials.slice(-15).map((t, i) => (
                                <div key={t.id || i.toString()} className={`${styles.card} glass`}>
                                    <div className={styles.stars}>
                                        {[...Array(t.rating ?? 5)].map((_, idx) => (
                                            <Star key={idx} size={16} fill="currentColor" />
                                        ))}
                                    </div>
                                    <p className={styles.quote}>&quot;{t.quote}&quot;</p>
                                    {t.admin_reply && (
                                        <div className={styles.adminReply}>
                                            <span className={styles.adminReplyLabel}>Reply from PrintHub</span>
                                            <p>{t.admin_reply}</p>
                                        </div>
                                    )}
                                    <div className={styles.author}>
                                        <div className={styles.avatar}>{t.initials}</div>
                                        <div className={styles.info}>
                                            <h4>{t.name}</h4>
                                            <p>{t.role}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '40px 20px', opacity: 0.8, border: '1px dashed rgba(255,255,255,0.2)', borderRadius: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
                            <p style={{ margin: 0 }}>No reviews yet. Be the first to share your experience!</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Review Modal */}
            {showModal && (
                <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <div>
                                <h3>Share Your Experience</h3>
                                <p>Your review will be visible to everyone.</p>
                            </div>
                            <button className={styles.closeBtn} onClick={() => setShowModal(false)}>
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className={styles.reviewForm}>
                            {/* Star Rating */}
                            <div className={styles.ratingRow}>
                                <label>Rating</label>
                                <div className={styles.starPicker}>
                                    {[1, 2, 3, 4, 5].map(star => (
                                        <button
                                            key={star}
                                            type="button"
                                            onClick={() => setForm(f => ({ ...f, rating: star }))}
                                            className={styles.starBtn}
                                            style={{ color: star <= form.rating ? '#39ff14' : 'rgba(255,255,255,0.2)' }}
                                        >
                                            <Star size={28} fill="currentColor" />
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className={styles.formRow}>
                                <div className={styles.formGroup}>
                                    <label>Your Name</label>
                                    <input
                                        type="text"
                                        value={form.name}
                                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                        placeholder="e.g. Rahul S."
                                        required
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Your Role / Profession</label>
                                    <input
                                        type="text"
                                        value={form.role}
                                        onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                                        placeholder="e.g. Robotics Engineer"
                                    />
                                </div>
                            </div>

                            <div className={styles.formGroup}>
                                <label>Your Review</label>
                                <textarea
                                    value={form.quote}
                                    onChange={e => setForm(f => ({ ...f, quote: e.target.value }))}
                                    placeholder="Tell us about your experience..."
                                    rows={4}
                                    required
                                />
                            </div>

                            <button type="submit" className={styles.submitBtn} disabled={submitting}>
                                {submitting ? (
                                    <><Loader2 size={18} className={styles.spin} /> Submitting...</>
                                ) : (
                                    <><Send size={18} /> Submit Review</>
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </section>
    )
}
