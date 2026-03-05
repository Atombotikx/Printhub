'use client'
import styles from '../Policy.module.css'
import { Truck, Shield, Clock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getSiteConfig } from '@/app/admin/actions'
import BackButton from '@/components/BackButton'
import Loader from '@/components/Loader'

export default function ShippingPage() {
    const [content, setContent] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const load = async () => {
            const { data } = await getSiteConfig('site_policies')
            if (data && data.shipping) setContent(data.shipping)
            setLoading(false)
        }
        load()
    }, [])

    if (loading) return <Loader text="Loading Shipping Policy..." />

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.backWrapper}>
                    <BackButton />
                </div>
                <h1 className="title-gradient" style={{ margin: 0 }}>Shipping Policy</h1>
                <p className={styles.subtitle}>How we get your parts from our farm to your door</p>
            </div>

            <div className={styles.content}>
                {content ? (
                    <div className={styles.section} style={{ whiteSpace: 'pre-wrap' }}>
                        {content}
                    </div>
                ) : (
                    <>
                        <div className={styles.section}>
                            <h2><Clock size={24} /> Processing Times</h2>
                            <p>All orders go through a three-stage processing flow:</p>
                            <ul>
                                <li><strong>Verification:</strong> 1 business day to verify payment and file integrity.</li>
                                <li><strong>Printing:</strong> 1-3 business days depending on model complexity and queue.</li>
                                <li><strong>Inspection:</strong> Final quality check and packaging before dispatch.</li>
                            </ul>
                        </div>

                        <div className={styles.section}>
                            <h2><Truck size={24} /> Delivery Estimates</h2>
                            <p>We partner with major courier services to ensure reliable delivery:</p>
                            <ul>
                                <li><strong>Standard Shipping:</strong> 5-7 business days across India.</li>
                                <li><strong>Priority Shipping:</strong> 2-4 business days (available for select regions).</li>
                                <li><strong>Local Pickup:</strong> Available for customers in Coimbatore (Tamil Nadu).</li>
                            </ul>
                        </div>

                        <div className={styles.section}>
                            <h2><Shield size={24} /> Handling & Packaging</h2>
                            <p>3D prints can be delicate. We use professional-grade bubble wrap and sturdy cardboard boxes to protect your items. For large or thin models, we may include temporary support structures to ensure safe transit.</p>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
