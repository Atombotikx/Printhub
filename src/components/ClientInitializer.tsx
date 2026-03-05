'use client'
import { useEffect, useRef } from 'react'
import { useAdminStore } from '@/store/adminStore'
import { useAuthStore } from '@/store/authStore'
import { createClient } from '@/utils/supabase/client'

export default function ClientInitializer() {
    const fetchSettings = useAdminStore((state) => state.fetchSettings)
    const setUser = useAuthStore((state) => state.setUser)
    const setLoadingAuth = useAuthStore((state) => state.setLoading)
    const initialized = useRef(false)
    const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const lastSyncUserRef = useRef<string | null>(null)

    useEffect(() => {
        if (initialized.current) return
        initialized.current = true

        const supabase = createClient()

        // 1. Initial Settings Fetch (Lazy)
        setTimeout(() => fetchSettings(), 100)

        // 2. Centralized Auth Listener
        const syncAuth = async (session: any) => {
            // De-duplicate rapid calls
            if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current)

            syncTimeoutRef.current = setTimeout(async () => {
                const userId = session?.user?.id || null
                if (userId === lastSyncUserRef.current && !!session?.user === (!!lastSyncUserRef.current)) {
                    return // No change in user identity
                }
                lastSyncUserRef.current = userId

                if (session?.user) {
                    try {
                        const { isCurrentUserAdmin } = await import('@/app/admin/actions')
                        const isAdmin = await isCurrentUserAdmin()
                        setUser({
                            id: session.user.id,
                            name: session.user.user_metadata?.full_name || 'User',
                            email: session.user.email || '',
                            image: session.user.user_metadata?.avatar_url
                        }, isAdmin)
                    } catch (err) {
                        console.error('Auth sync failed:', err)
                        setUser(null, false)
                    }
                } else {
                    setUser(null, false)
                }
            }, 50) // Small debounce to catch double-fire events
        }

        // Check initial session
        supabase.auth.getSession().then(({ data: { session } }: { data: { session: any } }) => {
            syncAuth(session)
        })

        // Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
            syncAuth(session)
        })

        return () => {
            subscription.unsubscribe()
        }
    }, [fetchSettings, setUser, setLoadingAuth])

    return null
}
