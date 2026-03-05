'use client'
import { useState, useEffect } from 'react'
import { Megaphone, AlertTriangle, Zap, AlertCircle } from 'lucide-react'
import { getSiteConfig } from '@/app/admin/actions'
import styles from './AnnouncementBanner.module.css'

type BannerType = 'info' | 'offer' | 'maintenance' | 'unavailable'

export default function AnnouncementBanner() {
    const [config, setConfig] = useState<{ active: boolean, message: string, type: BannerType } | null>(null)

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const { data } = await getSiteConfig('announcement_banner')
                if (data && data.active && data.message) {
                    setConfig(data)
                }
            } catch (e) {
                console.error('Failed to fetch banner config:', e)
            }
        }
        fetchConfig()
    }, [])

    if (!config || !config.active) return null

    const getIcon = () => {
        switch (config.type) {
            case 'offer': return <Zap size={18} className={styles.icon} />
            case 'maintenance': return <AlertTriangle size={18} className={styles.icon} />
            case 'unavailable': return <AlertCircle size={18} className={styles.icon} />
            default: return <Megaphone size={18} className={styles.icon} />
        }
    }

    const typeClass = styles[config.type] || styles.info

    return (
        <div className={`${styles.banner} ${typeClass}`}>
            <div className={styles.content}>
                {getIcon()}
                <p>{config.message}</p>
            </div>
        </div>
    )
}
