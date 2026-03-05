'use client'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Mail, Phone, MapPin, Instagram, MessageCircle } from 'lucide-react'
import styles from './Footer.module.css'
import { getSiteConfig } from '@/app/admin/actions'

interface ContactInfo {
    instagram: string
    whatsapp: string
    email: string
    phone: string
    address: string
    google_maps: string
}

export default function Footer() {
    const pathname = usePathname()
    const [contactInfo, setContactInfo] = useState<ContactInfo | null>(null)

    useEffect(() => {
        async function fetchConfig() {
            const { data } = await getSiteConfig('contact_info')
            if (data) setContactInfo(data as ContactInfo)
        }
        fetchConfig()
    }, [])

    if (pathname?.startsWith('/admin')) return null

    return (
        <footer className={styles.footer}>
            <div className={styles.container}>
                <div className={styles.grid}>
                    {/* Brand Section */}
                    <div className={styles.brand}>
                        <h3>PrintHub</h3>
                        <p>Industrial grade 3D printing service for everyone.<br />High quality, fast turnaround, and competitive pricing.</p>
                        {contactInfo && (
                            <div className={styles.socials}>
                                {contactInfo.whatsapp && (
                                    <a href={`https://wa.me/${contactInfo.whatsapp.replaceAll(/\D/g, '')}`} className={styles.socialLink} target="_blank" rel="noopener noreferrer" title="WhatsApp">
                                        <MessageCircle size={20} />
                                    </a>
                                )}
                                {contactInfo.instagram && (
                                    <a href={contactInfo.instagram} className={styles.socialLink} target="_blank" rel="noopener noreferrer" title="Instagram">
                                        <Instagram size={20} />
                                    </a>
                                )}
                                {contactInfo.google_maps && (
                                    <a href={contactInfo.google_maps} className={styles.socialLink} target="_blank" rel="noopener noreferrer" title="Google Maps">
                                        <MapPin size={20} />
                                    </a>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Support */}
                    <div className={styles.links}>
                        <h4>Support</h4>
                        <ul>
                            <li><Link href="/faq">FAQ</Link></li>
                            <li><Link href="/shipping">Shipping Policy</Link></li>
                            <li><Link href="/returns">Returns &amp; Refunds</Link></li>
                            <li><Link href="/terms">Terms of Service</Link></li>
                        </ul>
                    </div>

                    {/* Contact Us — only render when database data is loaded */}
                    {contactInfo && (
                        <div className={styles.contact}>
                            <h4>Contact Us</h4>
                            {contactInfo.email && (
                                <div className={styles.contactItem}>
                                    <Mail size={18} />
                                    <span>{contactInfo.email}</span>
                                </div>
                            )}
                            {contactInfo.phone && (
                                <div className={styles.contactItem}>
                                    <Phone size={18} />
                                    <span>{contactInfo.phone}</span>
                                </div>
                            )}
                            {contactInfo.address && (
                                <div className={styles.contactItem} style={{ alignItems: 'flex-start' }}>
                                    <MapPin size={18} style={{ marginTop: '4px' }} />
                                    <span style={{ whiteSpace: 'pre-line' }}>{contactInfo.address}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className={styles.bottom}>
                    <p>&copy; {new Date().getFullYear()} PrintHub. All rights reserved.</p>
                </div>
            </div>
        </footer>
    )
}
