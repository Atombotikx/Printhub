'use client'
import styles from '../Policy.module.css'
import { FileText, Shield, Gavel } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getSiteConfig } from '@/app/admin/actions'
import BackButton from '@/components/BackButton'
import Loader from '@/components/Loader'

export default function TermsPage() {
    const [content, setContent] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const load = async () => {
            const { data } = await getSiteConfig('site_policies')
            if (data && data.terms) setContent(data.terms)
            setLoading(false)
        }
        load()
    }, [])

    if (loading) return <Loader text="Loading Terms of Service..." />

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.backWrapper}>
                    <BackButton />
                </div>
                <h1 className="title-gradient" style={{ margin: 0 }}>Terms of Service</h1>
                <p className={styles.subtitle}>Rules and regulations for using AtombotikX</p>
            </div>

            <div className={styles.content}>
                {content ? (
                    <div className={styles.section} style={{ whiteSpace: 'pre-wrap' }}>
                        {content}
                    </div>
                ) : (
                    <>
                        <div className={styles.section}>
                            <h2><FileText size={24} /> 1. Service Description</h2>
                            <p>AtombotikX provides a custom 3D printing service. When you upload a file, you are requesting us to manufacture a physical object based on your digital design. We do not provide design services unless explicitly stated.</p>
                        </div>

                        <div className={styles.section}>
                            <h2><Shield size={24} /> 2. Intellectual Property</h2>
                            <p>You retain full ownership of the designs you upload. By uploading them, you grant AtombotikX a temporary license to process/print the model for the sole purpose of fulfilling your order. We will never share or sell your designs to third parties.</p>
                        </div>

                        <div className={styles.section}>
                            <h2><Gavel size={24} /> 3. Prohibited Items</h2>
                            <p>We reserve the right to refuse service for designs that include:</p>
                            <ul>
                                <li>Weapons or components for weapons (including 3D printed firearms).</li>
                                <li>Illicit drug-related paraphernalia.</li>
                                <li>Items that infringe on existing copyrights or trademarks without permission.</li>
                                <li>Explosive or hazardous device components.</li>
                            </ul>
                        </div>

                        <div className={styles.section}>
                            <h2><FileText size={24} /> 4. Pricing and Payments</h2>
                            <p>Prices are calculated based on material volume, print time, and complexity. Orders will only enter the print queue once payment verification is complete. We reserve the right to adjust pricing if a file requires major repair or support optimization.</p>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
