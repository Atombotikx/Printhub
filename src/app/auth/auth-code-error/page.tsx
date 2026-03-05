'use client'
import Link from 'next/link'
import styles from './AuthError.module.css'
import { AlertTriangle, Home, RotateCcw } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'

function AuthErrorContent() {
    const searchParams = useSearchParams()
    const [errorState, setErrorState] = useState<{ error: string | null, description: string | null }>({
        error: searchParams.get('error'),
        description: searchParams.get('error_description')
    })

    useEffect(() => {
        // Also check hash params (Supabase sometimes redirects with #error=...)
        if (!errorState.error && window.location.hash) {
            const hashParams = new URLSearchParams(window.location.hash.substring(1))
            const hashError = hashParams.get('error')
            const hashDesc = hashParams.get('error_description') || hashParams.get('error_code')
            if (hashError) {
                setErrorState({ error: hashError, description: hashDesc })
            }
        }
    }, [searchParams, errorState.error])

    const error = errorState.error
    const errorDescription = errorState.description

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <div className={styles.iconWrapper}>
                    <AlertTriangle size={48} className={styles.icon} />
                </div>

                <h1 className={styles.title}>Authentication Error</h1>

                <div className={styles.errorBox}>
                    <p className={styles.errorCode}>Error: {error || 'Unknown Error'}</p>
                    <p className={styles.errorMessage}>
                        {errorDescription?.replaceAll('+', ' ') || 'An unexpected error occurred during authentication.'}
                    </p>
                </div>

                <div className={styles.actions}>
                    <Link href="/login" className={styles.retryBtn}>
                        <RotateCcw size={18} />
                        Try Login Again
                    </Link>
                    <Link href="/" className={styles.homeBtn}>
                        <Home size={18} />
                        Go Home
                    </Link>
                </div>
            </div>
        </div>
    )
}

export default function AuthErrorPage() {
    return (
        <Suspense fallback={<div style={{ padding: 20, textAlign: 'center', color: 'white' }}>Loading error details...</div>}>
            <AuthErrorContent />
        </Suspense>
    )
}
