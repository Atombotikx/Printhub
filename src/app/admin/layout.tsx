'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, ShoppingCart, Layers, Printer, LogOut, Settings, Box, FileCode } from 'lucide-react'
import styles from './AdminLayout.module.css'
import { createClient } from '@/utils/supabase/client'
import { useCartStore } from '@/store/cartStore'
import { useQueueStore } from '@/store/queueStore'

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const pathname = usePathname()

    const handleLogout = async () => {
        const supabase = createClient()
        useCartStore.getState().purge()
        useQueueStore.getState().purge()
        await supabase.auth.signOut()
        window.location.href = '/'
    }

    const navItems = [
        { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
        { name: 'Orders', href: '/admin/orders', icon: ShoppingCart },
        { name: 'Manage Materials', href: '/admin/materials', icon: Layers },
        { name: 'Manage Printers', href: '/admin/printers', icon: Printer },
        { name: 'View STL', href: '/admin/stl-viewer', icon: Box },
        { name: 'View G-Code', href: '/admin/gcode-viewer', icon: FileCode },
    ]

    return (
        <div className={styles.adminContainer}>
            {/* Sidebar */}
            <aside className={styles.sidebar}>
                <div className={styles.sidebarHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                        <div style={{ width: '32px', height: '32px', background: 'var(--primary-color)', borderRadius: '8px' }} />
                        <span style={{ color: 'white', fontWeight: '800', fontSize: '1.2rem' }}>PrintHub <span style={{ color: 'var(--primary-color)', fontSize: '0.7rem', display: 'block', opacity: 0.8 }}>ADMIN</span></span>
                    </div>
                </div>

                <nav className={styles.nav}>
                    {navItems.map((item) => {
                        const Icon = item.icon
                        const isActive = pathname === item.href
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`${styles.navItem} ${isActive ? styles.active : ''}`}
                            >
                                <Icon size={20} />
                                <span>{item.name}</span>
                            </Link>
                        )
                    })}
                </nav>

                <div className={styles.sidebarFooter}>
                    <div onClick={handleLogout} className={styles.footerItem}>
                        <LogOut size={20} />
                        <span>Sign Out</span>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className={styles.mainContent}>
                {children}
            </main>
        </div>
    )
}
