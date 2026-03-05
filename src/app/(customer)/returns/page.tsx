'use client'
import styles from '../Policy.module.css'
import { RotateCcw, AlertCircle, CheckCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getSiteConfig } from '@/app/admin/actions'
import BackButton from '@/components/BackButton'
import Loader from '@/components/Loader'

export default function ReturnsPage() {
    const [content, setContent] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const load = async () => {
            const { data } = await getSiteConfig('site_policies')
            if (data && data.returns) setContent(data.returns)
            setLoading(false)
        }
        load()
    }, [])

    if (loading) return <Loader text="Loading Returns Policy..." />

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.backWrapper}>
                    <BackButton />
                </div>
                <h1 className="title-gradient" style={{ margin: 0 }}>Returns & Refunds</h1>
                <p className={styles.subtitle}>Our commitment to your satisfaction</p>
            </div>

            <div className={styles.content}>
                {content ? (
                    <div className={styles.section} style={{ whiteSpace: 'pre-wrap' }}>
                        {content}
                    </div>
                ) : (
                    <>
                        <div className={styles.section}>
                            <h2><AlertCircle size={24} /> Custom Manufacturing Policy</h2>
                            <p>Since 3D printing is a custom manufacturing process where items are made specifically for you, we generally do not accept returns for change of mind. However, we stand by our quality.</p>
                        </div>

                        <div className={styles.section}>
                            <h2><RotateCcw size={24} /> Eligibility for Refund</h2>
                            <p>You are eligible for a replacement or refund if:</p>
                            <ul>
                                <li>The item arrived broken or damaged during transit.</li>
                                <li>There is a major manufacturing defect that deviates significantly from the 3D model.</li>
                                <li>The material used does not match your order.</li>
                                <li>The item was significantly delayed beyond the promised timeline (excluding courier delays).</li>
                            </ul>
                        </div>

                        <div className={styles.section}>
                            <h2><CheckCircle size={24} /> Our Process</h2>
                            <p>To initiate a claim, please email us at atombotikx@gmail.com within 48 hours of delivery with:</p>
                            <ul>
                                <li>Your Order ID (e.g., #AB1234).</li>
                                <li>Clear photos of the defect or damage.</li>
                                <li>A brief description of the issue.</li>
                            </ul>
                            <p>We will review your request within 24 hours and either provide a free reprint or a full refund.</p>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
