'use client'
import { useState, useEffect } from 'react'
import styles from './Contact.module.css'
import { Mail, Phone, MapPin, Instagram, MessageCircle, Clock, ExternalLink } from 'lucide-react'
import BackButton from '@/components/BackButton'
import { getSiteConfig } from '@/app/admin/actions'

interface ContactInfo {
    instagram: string
    whatsapp: string
    email: string
    phone: string
    address: string
    google_maps: string
}

import Loader from '@/components/Loader'

export default function ContactPage() {
    const [contactInfo, setContactInfo] = useState<ContactInfo | null>(null)
    const [loading, setLoading] = useState(true)

    const [workHours, setWorkHours] = useState([
        { day: 'Monday – Friday', hours: '9:00 AM – 8:00 PM' },
        { day: 'Saturday', hours: '10:00 AM – 6:00 PM' },
        { day: 'Sunday', hours: 'Closed' },
    ])

    useEffect(() => {
        async function fetchConfig() {
            setLoading(true)
            try {
                const [contactRes, hoursRes] = await Promise.all([
                    getSiteConfig('contact_info'),
                    getSiteConfig('work_hours')
                ])
                if (contactRes.data) setContactInfo(contactRes.data as ContactInfo)
                if (hoursRes.data && Array.isArray(hoursRes.data)) setWorkHours(hoursRes.data)
            } finally {
                setLoading(false)
            }
        }
        fetchConfig()
    }, [])

    if (loading) {
        return <Loader text="Loading contact information..." fullPage={true} />
    }

    const igHandle = contactInfo?.instagram?.replace(/.*instagram\.com\//, '@').replace(/\/$/, '') || ''

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <div className={styles.backWrapper}>
                    <BackButton fallback="/" />
                </div>
                <h1 className="title-gradient" style={{ margin: 0 }}>Contact Us</h1>
                <p>Have a special request or need help? We&apos;re here for you.</p>
            </div>

            <div className={styles.grid}>
                {/* Left column – contact cards */}
                <div className={styles.cards}>
                    {contactInfo?.email && (
                        <a href={`mailto:${contactInfo.email}`} className={styles.contactCard}>
                            <div className={styles.cardIcon} style={{ background: 'rgba(0,191,255,0.1)', border: '1px solid rgba(0,191,255,0.2)' }}>
                                <Mail size={22} color="#00bfff" />
                            </div>
                            <div>
                                <div className={styles.cardLabel}>Email</div>
                                <div className={styles.cardValue}>{contactInfo.email}</div>
                            </div>
                            <ExternalLink size={14} className={styles.ext} />
                        </a>
                    )}

                    {contactInfo?.whatsapp && (
                        <a href={`https://wa.me/${contactInfo.whatsapp.replaceAll(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className={styles.contactCard}>
                            <div className={styles.cardIcon} style={{ background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.2)' }}>
                                <MessageCircle size={22} color="#25D366" />
                            </div>
                            <div>
                                <div className={styles.cardLabel}>WhatsApp</div>
                                <div className={styles.cardValue}>Message us directly</div>
                            </div>
                            <ExternalLink size={14} className={styles.ext} />
                        </a>
                    )}

                    {contactInfo?.phone && (
                        <a href={`tel:${contactInfo.phone}`} className={styles.contactCard}>
                            <div className={styles.cardIcon} style={{ background: 'rgba(57,255,20,0.1)', border: '1px solid rgba(57,255,20,0.2)' }}>
                                <Phone size={22} color="#39ff14" />
                            </div>
                            <div>
                                <div className={styles.cardLabel}>Phone</div>
                                <div className={styles.cardValue}>{contactInfo.phone}</div>
                            </div>
                            <ExternalLink size={14} className={styles.ext} />
                        </a>
                    )}

                    {contactInfo?.instagram && (
                        <a href={contactInfo.instagram} target="_blank" rel="noopener noreferrer" className={styles.contactCard}>
                            <div className={styles.cardIcon} style={{ background: 'rgba(225,48,108,0.1)', border: '1px solid rgba(225,48,108,0.2)' }}>
                                <Instagram size={22} color="#e1306c" />
                            </div>
                            <div>
                                <div className={styles.cardLabel}>Instagram</div>
                                <div className={styles.cardValue}>{igHandle}</div>
                            </div>
                            <ExternalLink size={14} className={styles.ext} />
                        </a>
                    )}


                </div>

                {/* Right column – hours + address */}
                <div className={styles.right}>
                    {/* Business Hours */}
                    <div className={styles.panel}>
                        <div className={styles.panelTitle}>
                            <Clock size={18} color="#39ff14" />
                            Business Hours
                        </div>
                        <div className={styles.hoursList}>
                            {workHours.map((row, i) => (
                                <div key={i} className={styles.hoursRow}>
                                    <span className={styles.hoursDay}>{row.day}</span>
                                    <span className={`${styles.hoursVal} ${row.hours.toLowerCase() === 'closed' ? styles.closed : ''}`}>
                                        {row.hours}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <p className={styles.note}> * Orders accepted any time.</p>
                    </div>

                    {/* Location */}
                    {contactInfo?.address && (
                        <div className={styles.panel}>
                            <div className={styles.panelTitle}>
                                <MapPin size={18} color="#39ff14" />
                                Our Location
                            </div>
                            <p className={styles.address}>{contactInfo.address}</p>
                            {contactInfo.google_maps && (
                                <a href={contactInfo.google_maps} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '12px', color: '#39ff14', textDecoration: 'none', fontSize: '0.88rem', fontWeight: 600, transition: 'opacity 0.2s' }}>
                                    <ExternalLink size={14} /> View on Google Maps
                                </a>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
