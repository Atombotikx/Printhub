'use client'
import Loader from '@/components/Loader'
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import styles from '../login/Login.module.css'
import { Mail, Lock, User, ArrowRight, CheckCircle, AlertCircle } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useToastStore } from '@/store/toastStore'
import BackButton from '@/components/BackButton'

function SignupContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const redirectTo = searchParams.get('redirectTo') || ''

    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')
        const supabase = createClient()

        if (password !== confirmPassword) {
            setError('Passwords do not match')
            setLoading(false)
            return
        }

        const { error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: name,
                },
            },
        })

        if (signUpError) {
            setError(signUpError.message)
            setLoading(false)
        } else {
            useToastStore.getState().addToast('Account created! Please check your email to confirm.', 'success')
            const redirectQuery = redirectTo ? '?redirectTo=' + encodeURIComponent(redirectTo) : ''
            router.push('/login' + redirectQuery)
        }
    }

    return (
        <div className={styles.container}>
            {loading && <Loader text="Creating account..." />}
            <div style={{ maxWidth: '440px', margin: '0 auto 24px', width: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ position: 'absolute', left: 0 }}>
                    <BackButton fallback="/" />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className={styles.logo} style={{ fontSize: '1.8rem', margin: 0 }}>
                        🚀
                    </div>
                    <h1 className="title-gradient" style={{ margin: 0, fontSize: '1.8rem', lineHeight: 1 }}>Join PrintHub</h1>
                </div>
            </div>
            <div className={styles.card} style={{ maxWidth: '440px', padding: '32px' }}>
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <p className={styles.subtitle} style={{ fontSize: '0.95rem', margin: 0 }}>Create your account to start printing industrial-grade parts globally.</p>
                </div>

                <form onSubmit={handleSubmit} className={styles.form} style={{ gap: '20px' }}>
                    {error && (
                        <div className={styles.error} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px' }}>
                            <AlertCircle size={20} />
                            {error}
                        </div>
                    )}

                    <div className={styles.inputGroup}>
                        <User size={20} className={styles.inputIcon} />
                        <input
                            type="text"
                            placeholder="Full Name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            style={{ height: '50px', fontSize: '1rem' }}
                        />
                    </div>

                    <div className={styles.inputGroup}>
                        <Mail size={20} className={styles.inputIcon} />
                        <input
                            type="email"
                            placeholder="Email Address"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            style={{ height: '50px', fontSize: '1rem' }}
                        />
                    </div>

                    <div className={styles.inputGroup}>
                        <Lock size={20} className={styles.inputIcon} />
                        <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={6}
                            style={{ height: '50px', fontSize: '1rem' }}
                        />
                    </div>

                    <div className={styles.inputGroup}>
                        <CheckCircle size={20} className={styles.inputIcon} style={{ color: password && password === confirmPassword ? '#00ff88' : 'var(--text-secondary)' }} />
                        <input
                            type="password"
                            placeholder="Confirm Password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            minLength={6}
                            style={{ height: '50px', fontSize: '1rem' }}
                        />
                    </div>

                    <button type="submit" className={styles.submitBtn} disabled={loading} style={{ height: '60px', fontSize: '1.2rem', marginTop: '10px', fontWeight: '600' }}>
                        {loading ? 'Creating Account...' : 'Create Account'}
                        {!loading && <ArrowRight size={22} />}
                    </button>
                </form>

                <div className={styles.footer} style={{ marginTop: '30px', fontSize: '1rem' }}>
                    <p>Already have an account? <Link href={'/login' + (redirectTo ? '?redirectTo=' + encodeURIComponent(redirectTo) : '')} style={{ fontWeight: 'bold', color: 'var(--primary-color)' }}>Sign in</Link></p>
                </div>
            </div>
        </div>
    )
}

export default function SignupPage() {
    return (
        <Suspense fallback={<Loader text="Loading..." />}>
            <SignupContent />
        </Suspense>
    )
}
