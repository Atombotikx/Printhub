'use client'
import { useState, Suspense } from 'react'
import Loader from '@/components/Loader'
import styles from './Login.module.css'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { Mail, Lock, ArrowRight } from 'lucide-react'
import BackButton from '@/components/BackButton'

import { isCurrentUserAdmin } from '@/app/admin/actions'

// Separate component to handle search params safely within Suspense
function LoginContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const redirectTo = searchParams.get('redirectTo') || '/'

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        const supabase = createClient()
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        if (error) {
            setError(error.message)
            setLoading(false)
        } else {
            const isAdmin = await isCurrentUserAdmin()
            if (isAdmin) {
                router.push('/admin')
            } else {
                router.push(redirectTo)
            }
        }
    }

    const handleGoogleLogin = async () => {
        const redirectUrl = `${globalThis.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`

        try {
            const supabase = createClient()
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: redirectUrl,
                    queryParams: {
                        access_type: 'offline',
                        prompt: 'select_account',
                    },
                },
            })
            if (error) {
                setError(error.message)
            }
        } catch (err) {
            console.error('Google login error:', err)
            setError('An unexpected error occurred')
        }
    }

    return (
        <div className={styles.container}>
            {loading && <Loader text="Signing in..." />}
            <div className={styles.header}>
                <div className={styles.backWrapper}>
                    <BackButton fallback="/" />
                </div>
                <h1 className={`${styles.title} title-gradient`}>Welcome Back</h1>
            </div>
            <div className={styles.card}>
                <p className={styles.subtitle}>Sign in to continue to PrintHub</p>

                {/* Google Sign In */}
                <button onClick={handleGoogleLogin} className={styles.googleBtn}>
                    <svg className={styles.googleIcon} viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Continue with Google
                </button>

                <div className={styles.divider}>
                    <span>or sign in with email</span>
                </div>

                <form onSubmit={handleEmailLogin} className={styles.form}>
                    {error && <div className={styles.error}>{error}</div>}

                    <div className={styles.inputGroup}>
                        <Mail size={18} className={styles.inputIcon} />
                        <input
                            type="email"
                            placeholder="Email Address"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className={styles.inputGroup}>
                        <Lock size={18} className={styles.inputIcon} />
                        <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <div className={styles.forgotPassword}>
                        <Link href="/forgot-password">Forgot password?</Link>
                    </div>

                    <button type="submit" className={styles.submitBtn} disabled={loading}>
                        {loading ? 'Signing in...' : 'Sign In'}
                        {!loading && <ArrowRight size={18} />}
                    </button>
                </form>

                <div className={styles.footer}>
                    <p>Don&apos;t have an account? <Link href={redirectTo === '/' ? '/signup' : `/signup?redirectTo=${encodeURIComponent(redirectTo)}`}>Sign up</Link></p>
                </div>
            </div>
        </div>
    )
}

export default function LoginPage() {
    return (
        <Suspense fallback={<div style={{ color: 'white', textAlign: 'center', paddingTop: '100px' }}>Loading login...</div>}>
            <LoginContent />
        </Suspense>
    )
}
