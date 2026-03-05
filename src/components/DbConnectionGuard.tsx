'use client'

import { useEffect, useState, useCallback } from 'react'
import Loader from '@/components/Loader'
import { createClient } from '@/utils/supabase/client'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface DbGuardProps {
    readonly children: React.ReactNode
}

export default function DbConnectionGuard({ children }: DbGuardProps) {
    const [status, setStatus] = useState<'loading' | 'connected' | 'error'>('loading')
    const [retrying, setRetrying] = useState(false)

    const checkConnection = useCallback(async () => {
        try {
            const supabase = createClient()
            // Lightweight health check — fetch a single row from any public table
            const { error } = await supabase
                .from('site_config')
                .select('key')
                .limit(1)
                .maybeSingle()

            if (error) {
                // If the table doesn't exist yet, still treat as connected (migration pending)
                if (error.code === 'PGRST116' || error.code === '42P01') {
                    setStatus('connected')
                } else {
                    console.error('[DbGuard] Connection check failed:', error.message)
                    setStatus('error')
                }
            } else {
                setStatus('connected')
            }
        } catch {
            setStatus('error')
        }
    }, [])

    useEffect(() => {
        checkConnection()
    }, [checkConnection])

    const handleRetry = async () => {
        setRetrying(true)
        setStatus('loading')
        await checkConnection()
        setRetrying(false)
    }

    if (status === 'loading') {
        return <Loader text="Connecting to PrintHub..." />
    }

    if (status === 'error') {
        return (
            <div style={{
                position: 'fixed',
                inset: 0,
                zIndex: 99999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0, 0, 0, 0.95)',
                backdropFilter: 'blur(20px)',
            }}>
                <div style={{
                    maxWidth: '480px',
                    width: '90%',
                    padding: '48px 40px',
                    borderRadius: '24px',
                    background: 'linear-gradient(135deg, rgba(255,71,87,0.08), rgba(0,0,0,0.4))',
                    border: '1px solid rgba(255,71,87,0.3)',
                    textAlign: 'center',
                }}>
                    <div style={{
                        width: '72px',
                        height: '72px',
                        borderRadius: '50%',
                        background: 'rgba(255,71,87,0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 24px',
                    }}>
                        <AlertTriangle size={36} color="#ff4757" />
                    </div>

                    <h2 style={{
                        margin: '0 0 12px',
                        fontSize: '1.6rem',
                        fontWeight: 800,
                        color: '#ff4757',
                    }}>
                        Connection Lost
                    </h2>

                    <p style={{
                        margin: '0 0 32px',
                        fontSize: '0.95rem',
                        color: 'rgba(255,255,255,0.55)',
                        lineHeight: 1.6,
                    }}>
                        PrintHub is unable to reach its database. This could be due to a temporary network issue or server maintenance. Please try again in a few moments.
                    </p>

                    <button
                        onClick={handleRetry}
                        disabled={retrying}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '14px 32px',
                            borderRadius: '14px',
                            border: '1px solid rgba(255,71,87,0.4)',
                            background: 'rgba(255,71,87,0.15)',
                            color: '#ff4757',
                            fontSize: '1rem',
                            fontWeight: 700,
                            cursor: retrying ? 'not-allowed' : 'pointer',
                            transition: 'all 0.3s',
                            opacity: retrying ? 0.6 : 1,
                        }}
                    >
                        <RefreshCw size={18} className={retrying ? 'spin' : ''} />
                        {retrying ? 'Reconnecting...' : 'Try Again'}
                    </button>

                    <p style={{
                        margin: '24px 0 0',
                        fontSize: '0.75rem',
                        color: 'rgba(255,255,255,0.25)',
                    }}>
                        If this persists, please contact the administrator.
                    </p>
                </div>
            </div>
        )
    }

    return <>{children}</>
}
