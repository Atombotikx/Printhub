'use client'
import styles from '../Policy.module.css'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getSiteConfig } from '@/app/admin/actions'
import BackButton from '@/components/BackButton'
import Loader from '@/components/Loader'

export default function FAQPage() {
    const [faqs, setFaqs] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    const defaultFaqs = [
        {
            q: "How do I get a price for my 3D file?",
            a: "Simply upload your STL or 3MF file on the home page. Our pricing engine will analyze the geometry and give you an instant quote based on your material and quality settings."
        },
        {
            q: "What materials do you offer?",
            a: "We currently support PLA+, TPU (flexible), PETG, and ABS. Each material has different properties suitable for various applications from decorative to functional parts."
        },
        {
            q: "How long does printing take?",
            a: "Standard orders are usually printed within 2-3 business days. More complex or large volume orders might take longer. We'll provide an estimated timeline during checkout."
        }
    ]

    useEffect(() => {
        const loadFaqs = async () => {
            const { data } = await getSiteConfig('site_policies')
            if (data && data.faq) {
                try {
                    const parsed = JSON.parse(data.faq)
                    setFaqs(parsed)
                } catch (e) {
                    console.error("Failed to parse FAQ JSON:", e)
                    setFaqs(defaultFaqs)
                }
            } else {
                setFaqs(defaultFaqs)
            }
            setLoading(false)
        }
        loadFaqs()
    }, [])

    if (loading) return <Loader text="Loading FAQ..." />

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.backWrapper}>
                    <BackButton />
                </div>
                <h1 className="title-gradient" style={{ margin: 0 }}>Frequently Asked Questions</h1>
                <p className={styles.subtitle}>Find answers to the most common questions about AtombotikX</p>
            </div>

            <div className={styles.content}>
                <div className={styles.faqGrid}>
                    {faqs.map((faq, i) => (
                        <div key={i} className={styles.faqItem}>
                            <h3>{faq.q}</h3>
                            <p>{faq.a}</p>
                        </div>
                    ))}
                </div>

                <div className={styles.section} style={{ marginTop: '4rem', textAlign: 'center' }}>
                    <p>Still have questions?</p>
                    <Link href="/contact" className="btn" style={{ background: 'transparent', border: '1px solid #39ff14', color: '#39ff14' }}>
                        Contact Support
                    </Link>
                </div>
            </div>
        </div>
    )
}
