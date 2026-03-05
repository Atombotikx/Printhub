'use client'
import { useEffect } from 'react'
import { useAdminStore } from '@/store/adminStore'

export default function ClientInitializer() {
    const fetchSettings = useAdminStore((state) => state.fetchSettings)

    useEffect(() => {
        fetchSettings()
    }, [fetchSettings])

    return null
}
