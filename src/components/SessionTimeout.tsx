'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useToastStore } from '@/store/toastStore'
import { useAuthStore } from '@/store/authStore'

export default function SessionTimeout() {
    const router = useRouter()
    const timeoutRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null)
    const { isAdmin, user } = useAuthStore()
    const isLoggedIn = !!user

    useEffect(() => {
        if (!isLoggedIn) {
            if (timeoutRef.current !== null) {
                globalThis.clearTimeout(timeoutRef.current)
                timeoutRef.current = null
            }
            return
        }

        const supabase = createClient()

        // Read timeout hours from environment variables (fallback: Admin=3h, Customer=1h)
        const adminHours = Number.parseFloat(process.env.NEXT_PUBLIC_ADMIN_SESSION_TIMEOUT_HOURS || '3')
        const customerHours = Number.parseFloat(process.env.NEXT_PUBLIC_CUSTOMER_SESSION_TIMEOUT_HOURS || '1')

        const timeoutMs = (isAdmin ? adminHours : customerHours) * 60 * 60 * 1000

        const handleActivity = () => {
            if (timeoutRef.current !== null) {
                globalThis.clearTimeout(timeoutRef.current)
            }

            timeoutRef.current = globalThis.setTimeout(async () => {
                const { data: { session } } = await supabase.auth.getSession()
                if (session) {
                    await supabase.auth.signOut()
                    globalThis.localStorage.clear()
                    useToastStore.getState().addToast('Logged out due to inactivity', 'info')
                    router.push('/login')
                }
            }, timeoutMs)
        }

        handleActivity()

        const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart']
        events.forEach(event => globalThis.addEventListener(event, handleActivity, { passive: true }))

        return () => {
            if (timeoutRef.current !== null) {
                globalThis.clearTimeout(timeoutRef.current)
            }
            events.forEach(event => globalThis.removeEventListener(event, handleActivity))
        }
    }, [isAdmin, isLoggedIn, router])

    return null
}
