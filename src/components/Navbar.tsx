'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { ShoppingCart, User, LogOut, FileText, Eye, Package, Shield, MessageCircle, Home } from 'lucide-react'
import styles from './Navbar.module.css'
import { useCartStore } from '@/store/cartStore'
import { useQueueStore } from '@/store/queueStore'
import { useAuthStore } from '@/store/authStore'
import { createClient } from '@/utils/supabase/client'
import { User as SupabaseUser } from '@supabase/supabase-js'

export default function Navbar() {
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const [isOpen, setIsOpen] = useState(false)
    const currentPath = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '')
    const menuRef = useRef<HTMLDivElement>(null)
    const items = useCartStore((state) => state.items)

    // Central Auth State
    const { user, isAdmin } = useAuthStore()
    const [userName, setUserName] = useState<string>('User')
    const cartCount = items.length

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside)
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [isOpen])

    // Reactive Cart Loading & DB Name Fetching
    useEffect(() => {
        if (user?.id) {
            const supabase = createClient()
            useCartStore.getState().loadFromSupabase(user.id)

            const fetchUserName = async () => {
                const { data } = await supabase.from('user_details').select('full_name').eq('user_id', user.id).single()
                if (data && data.full_name) {
                    setUserName(data.full_name)
                } else {
                    setUserName(user.name || 'User')
                }
            }
            fetchUserName()
        } else {
            setUserName('User')
        }
    }, [user?.id, user?.name])

    const handleLogout = async () => {
        const supabase = createClient()
        // Purge local storage completely without affecting the Database
        useCartStore.getState().purge()
        useQueueStore.getState().purge()

        await supabase.auth.signOut()

        // Force hard refresh to clear all states
        globalThis.location.href = '/'
    }

    return (
        <nav className={styles.nav}>
            <div className={styles.container}>
                <Link href={isAdmin ? "/admin" : "/"} className={styles.logo}>
                    <div className={styles.atomContainer}>
                        <div className={styles.nucleus} />
                        <div className={`${styles.orbit} ${styles.orbit1}`}>
                            <div className={styles.electron} />
                        </div>
                    </div>
                    <span style={{ color: 'white', fontWeight: '800', letterSpacing: '1px' }}>PrintHub</span>
                </Link>

                {/* Desktop Menu - Empty for now */}
                <div className={styles.links}>

                </div>

                <div className={styles.actions}>
                    {!isAdmin && (
                        <Link href="/cart" className={styles.iconBtn}>
                            <ShoppingCart size={20} />
                            {cartCount > 0 && <span className={styles.badge}>{cartCount}</span>}
                        </Link>
                    )}
                    {user ? (
                        <div className={styles.userSection}>
                            <span className={styles.userName}>Hi, {userName.split(' ')[0]}</span>
                            <button onClick={handleLogout} className={styles.logoutBtn} title="Logout">
                                <LogOut size={20} />
                            </button>
                        </div>
                    ) : (
                        <Link href={`/login?redirectTo=${encodeURIComponent(currentPath)}`} className={styles.loginBtn}>
                            <User size={18} />
                            <span>Sign In</span>
                        </Link>
                    )}
                    <div ref={menuRef} style={{ display: 'flex', alignItems: 'center' }}>
                        <button className={`${styles.menuBtn} ${isOpen ? styles.active : ''}`} onClick={() => setIsOpen(!isOpen)}>
                            <span></span>
                            <span></span>
                            <span></span>
                        </button>

                        {/* Dropdown Menu */}
                        <div className={`${styles.mobileMenu} ${isOpen ? styles.open : ''}`}>
                            <Link href="/" onClick={() => setIsOpen(false)} className={styles.menuItem}>
                                <Home size={18} /> Home
                            </Link>
                            {isAdmin ? (
                                // Admin Only Links
                                <Link href="/admin" onClick={() => setIsOpen(false)} className={styles.menuItem}>
                                    <Shield size={18} /> Admin Panel
                                </Link>
                            ) : (
                                <>
                                    <Link href="/upload" onClick={() => setIsOpen(false)} className={styles.menuItem}>
                                        <FileText size={18} /> Upload 3D Model
                                    </Link>
                                    <Link href="/gcode-viewer" onClick={() => setIsOpen(false)} className={styles.menuItem}>
                                        <Eye size={18} /> Visualize G-Code
                                    </Link>
                                    {user && (
                                        <>
                                            <Link href="/orders" onClick={() => setIsOpen(false)} className={styles.menuItem}>
                                                <Package size={18} /> Your Orders
                                            </Link>
                                            <Link href="/settings" onClick={() => setIsOpen(false)} className={styles.menuItem}>
                                                <User size={18} /> Account Settings
                                            </Link>
                                        </>
                                    )}
                                    <Link href="/contact" onClick={() => setIsOpen(false)} className={styles.menuItem}>
                                        <MessageCircle size={18} /> Contact Us
                                    </Link>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </nav>
    )
}
