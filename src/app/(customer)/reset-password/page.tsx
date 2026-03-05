'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import styles from '../login/Login.module.css'
import { Lock, ArrowRight, CheckCircle } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useToastStore } from '@/store/toastStore'

export default function ResetPasswordPage() {
    const router = useRouter()
    const { addToast } = useToastStore()
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        if (password !== confirmPassword) {
            setError('Passwords do not match')
            setLoading(false)
            return
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters long')
            setLoading(false)
            return
        }

        const supabase = createClient()
        const { error: updateError } = await supabase.auth.updateUser({
            password: password,
        })

        if (updateError) {
            setError(updateError.message)
            addToast(`Update failed: ${updateError.message}`, 'error')
        } else {
            setSuccess(true)
            addToast('Password reset successfully!', 'success')
            setTimeout(() => {
                router.push('/login')
            }, 3000)
        }
        setLoading(false)
    }

    if (success) {
        return (
            <div className={styles.container}>
                <div className={styles.header}>
                    <h1 className={`${styles.title} title-gradient`}>Success</h1>
                </div>
                <div className={styles.card}>
                    <div style={{ color: 'var(--primary-color)', marginBottom: '16px' }}>
                        <CheckCircle size={48} style={{ margin: '0 auto' }} />
                    </div>
                    <p className={styles.subtitle}>Your password has been updated.</p>
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem' }}>Redirecting to login...</p>
                    <Link href="/login" className={styles.submitBtn} style={{ marginTop: '24px', textDecoration: 'none' }}>
                        Go to Sign In
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1 className={`${styles.title} title-gradient`}>New Password</h1>
            </div>
            <div className={styles.card}>
                <p className={styles.subtitle}>Enter your new password below</p>

                {error && <div className={styles.error} style={{ marginBottom: '16px' }}>{error}</div>}

                <form onSubmit={handleSubmit} className={styles.form}>
                    <div className={styles.inputGroup}>
                        <Lock size={18} className={styles.inputIcon} />
                        <input
                            type="password"
                            placeholder="New Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <div className={styles.inputGroup}>
                        <Lock size={18} className={styles.inputIcon} />
                        <input
                            type="password"
                            placeholder="Confirm Password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button type="submit" className={styles.submitBtn} disabled={loading}>
                        {loading ? 'Updating...' : 'Update Password'}
                        {!loading && <ArrowRight size={18} />}
                    </button>
                </form>
            </div>
        </div>
    )
}
