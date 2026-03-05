'use client'
import { useState } from 'react'
import Link from 'next/link'
import styles from '../login/Login.module.css'
import { Mail, ArrowRight, CheckCircle } from 'lucide-react'
import BackButton from '@/components/BackButton'
import { createClient } from '@/utils/supabase/client'

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [error, setError] = useState('')

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        const supabase = createClient()
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${globalThis.location.origin}/auth/callback?next=/reset-password`,
        })

        if (resetError) {
            setError(resetError.message)
        } else {
            setSubmitted(true)
        }
        setLoading(false)
    }

    if (submitted) {
        return (
            <div className={styles.container}>
                <div style={{ maxWidth: '440px', margin: '0 auto 24px', width: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ position: 'absolute', left: 0 }}>
                        <BackButton fallback="/login" />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className={styles.logo} style={{ fontSize: '1.8rem', margin: 0 }}>
                            🔑
                        </div>
                        <h1 className="title-gradient" style={{ margin: 0, fontSize: '1.8rem', lineHeight: 1 }}>Reset Password</h1>
                    </div>
                </div>
                <div className={styles.card} style={{ maxWidth: '440px', padding: '32px' }}>
                    <div style={{ color: 'var(--primary-color)', marginBottom: '16px', textAlign: 'center' }}>
                        <CheckCircle size={48} style={{ margin: '0 auto' }} />
                    </div>
                    <h2 style={{ textAlign: 'center' }}>Check your email</h2>
                    <p style={{ color: 'rgba(255,255,255,0.6)', margin: '16px 0', textAlign: 'center' }}>
                        We&apos;ve sent password reset instructions to <strong>{email}</strong>
                    </p>
                    <Link href="/login" className={styles.submitBtn} style={{ textDecoration: 'none', height: '54px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600' }}>
                        Return to Sign In
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className={styles.container}>
            <div style={{ maxWidth: '440px', margin: '0 auto 24px', width: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ position: 'absolute', left: 0 }}>
                    <BackButton fallback="/login" />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className={styles.logo} style={{ fontSize: '1.8rem', margin: 0 }}>
                        🔑
                    </div>
                    <h1 className="title-gradient" style={{ margin: 0, fontSize: '1.8rem', lineHeight: 1 }}>Reset Password</h1>
                </div>
            </div>
            <div className={styles.card} style={{ maxWidth: '440px', padding: '32px' }}>
                <p className={styles.subtitle} style={{ textAlign: 'center', fontSize: '0.95rem', marginBottom: '24px' }}>Enter your email to receive a reset link</p>

                {error && (
                    <div className={styles.error} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', marginBottom: '16px' }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className={styles.form} style={{ gap: '20px' }}>
                    <div className={styles.inputGroup}>
                        <Mail size={18} className={styles.inputIcon} />
                        <input
                            type="email"
                            placeholder="Email Address"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            style={{ height: '50px' }}
                        />
                    </div>

                    <button type="submit" className={styles.submitBtn} disabled={loading} style={{ height: '54px', fontWeight: '600' }}>
                        {loading ? 'Sending link...' : 'Send Reset Link'}
                        {!loading && <ArrowRight size={18} />}
                    </button>
                </form>

                <div className={styles.footer} style={{ marginTop: '24px' }}>
                    <p>Remember your password? <Link href="/login" style={{ fontWeight: 'bold' }}>Sign in</Link></p>
                </div>
            </div>
        </div>
    )
}
