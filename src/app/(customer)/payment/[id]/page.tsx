'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { formatCurrency } from '@/utils/pricingEngine'
import { ArrowLeft, Upload, QrCode, CheckCircle, Loader2 } from 'lucide-react'
import styles from '../Payment.module.css'
import { useToastStore } from '@/store/toastStore'
import Image from 'next/image'
import { submitPaymentProof } from '../actions'
import { getCustomerPaymentQrSignedUrl } from '@/app/(customer)/actions'
import BackButton from '@/components/BackButton'
import Loader from '@/components/Loader'

export default function PaymentPage() {
    const { id } = useParams()
    const router = useRouter()
    const [user, setUser] = useState<any>(null)
    const [order, setOrder] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [screenshot, setScreenshot] = useState<File | null>(null)
    const [preview, setPreview] = useState<string | null>(null)
    const [qrError, setQrError] = useState(false)
    const [qrUrl, setQrUrl] = useState('')
    const addToast = useToastStore.getState().addToast


    useEffect(() => {
        const supabase = createClient()

        const fetchQr = async () => {
            const { data } = await getCustomerPaymentQrSignedUrl()
            if (data) {
                setQrUrl(data)
                setQrError(false)
            } else {
                setQrError(true)
            }
        }
        fetchQr()

        const fetchOrder = async () => {
            try {
                const { data: { user }, error: authError } = await supabase.auth.getUser()
                if (authError || !user) {
                    router.push('/login')
                    return
                }
                setUser(user)

                const { data, error } = await supabase
                    .from('orders')
                    .select('*')
                    .eq('id', id)
                    .single()

                if (error) throw error

                if (data) {
                    setOrder(data)
                } else {
                    throw new Error('Order not found')
                }
            } catch (err: any) {
                addToast(err.message || 'Failed to load order', 'error')
                router.push('/orders')
            } finally {
                setLoading(false)
            }
        }
        fetchOrder()
    }, [id, router, addToast])

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            setScreenshot(file)
            const reader = new FileReader()
            reader.onloadend = () => {
                setPreview(reader.result as string)
            }
            reader.readAsDataURL(file)
        }
    }

    const handleSubmit = async () => {
        if (!screenshot) {
            addToast('Please upload a screenshot first', 'error')
            return
        }
        setIsSubmitting(true)

        try {
            const supabase = createClient()
            // 1. Upload to `prints` bucket as payments/{userId}/{orderId}/{originalFilename}
            //    orderId subfolder keeps all payment files for this order together.
            const cleanName = screenshot.name.replace(/[^a-zA-Z0-9.-]/g, '_')
            const filePath = `payments/${user!.id}/${order.id}/${cleanName}`

            const { error: uploadError } = await supabase.storage
                .from('prints')
                .upload(filePath, screenshot, { upsert: true })

            if (uploadError) throw uploadError

            // 2. Update order status via Server Action for reliability and cache revalidation
            const result = await submitPaymentProof(order.id as string)

            if (result.error) throw new Error(result.error)

            addToast('Payment proof submitted successfully!', 'success')

            router.refresh()

            // Give the DB a split second to breathe and ensure revalidation is picked up
            setTimeout(() => {
                router.push('/orders')
            }, 800)
        } catch (error: any) {
            addToast(error.message || 'Failed to submit payment proof', 'error')
        } finally {
            setIsSubmitting(false)
        }
    }

    if (loading) return <Loader text="Securing order details..." />

    if (!order) return null

    return (
        <div className={styles.container}>
            <div className={styles.pageHeader}>
                <div className={styles.headerTitleRow}>
                    <div className={styles.headerLeft}>
                        <BackButton fallback="/orders" />
                    </div>
                    <div className={styles.headerContent}>
                        <h1 className="title-gradient" style={{ margin: 0 }}>Payment required</h1>
                    </div>
                    <div className={styles.headerRight} />
                </div>
                <p className={styles.subtitle}>Scan and upload proof to confirm your print order</p>
            </div>

            <div className={`${styles.paymentCard} glass`}>
                <div className={styles.header}>
                    <p className={styles.instructions}>Scan the QR code below using any UPI app (GPay, PhonePe, Paytm) to pay for your order.</p>
                </div>

                <div className={styles.amount}>
                    {formatCurrency(order.total_amount)}
                    <span style={{ fontSize: '1.2rem', opacity: 0.5, marginLeft: '12px', verticalAlign: 'middle', fontWeight: 500 }}>
                        + shipping (Discuss with Admin)
                    </span>
                </div>

                <div className={styles.qrSection}>
                    <div className={styles.qrPlaceholder}>
                        {qrError ? (
                            <div style={{ color: '#333', textAlign: 'center', padding: '20px' }}>
                                QR Code currently unavailable.<br />Please contact support.
                            </div>
                        ) : qrUrl ? (
                            <img
                                src={qrUrl}
                                alt="Payment QR Code"
                                style={{ width: '200px', height: '200px', objectFit: 'contain' }}
                                onError={() => setQrError(true)}
                            />
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
                                <Loader2 className="spin" size={32} />
                            </div>
                        )}
                    </div>
                    <span style={{ fontSize: '0.8rem', marginTop: '12px', display: 'block' }}>UPI ID: printhub@okaxis</span>
                </div>

                <div className={styles.instructions}>
                    <p>1. Scan the QR code and pay <strong>{formatCurrency(order.total_amount)}</strong> + Shipping</p>
                    <p>2. Take a screenshot of the successful payment</p>
                    <p>3. Upload the screenshot below to confirm your order</p>
                </div>

                <div className={styles.uploadSection}>
                    <Upload className={styles.uploadIcon} size={32} />
                    <p>{screenshot ? screenshot.name : 'Click or drag to upload payment screenshot'}</p>
                    <input
                        type="file"
                        accept="image/*"
                        className={styles.fileInput}
                        onChange={handleFileChange}
                    />
                    {preview && (
                        <img src={preview} alt="Screenshot Preview" className={styles.preview} />
                    )}
                </div>

                <button
                    className={styles.submitBtn}
                    onClick={handleSubmit}
                    disabled={!screenshot || isSubmitting}
                >
                    {isSubmitting ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            <Loader2 className="spin" size={20} /> Submitting...
                        </div>
                    ) : (
                        'Submit Payment Proof'
                    )}
                </button>
            </div>
        </div>
    )
}
