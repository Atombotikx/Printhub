'use client'
import { useCartStore } from '@/store/cartStore'
import { formatCurrency } from '@/utils/pricingEngine'
import { Trash2, ShoppingBag, ArrowLeft, CreditCard, Plus, Edit } from 'lucide-react'
import Link from 'next/link'
import BackButton from '@/components/BackButton'
import styles from './Cart.module.css'
import CheckoutModal from './CheckoutModal'
import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useSearchParams, useRouter } from 'next/navigation'
import Loader from '@/components/Loader'

function CartContent() {
    const router = useRouter()
    const { items, removeItem, updateQuantity, clearCart } = useCartStore()
    const [selectedIds, setSelectedIds] = useState<string[]>(items.map(i => i.id))
    const [showCheckout, setShowCheckout] = useState(false)
    const searchParams = useSearchParams()

    const [isLoading, setIsLoading] = useState(false)

    useEffect(() => {
        const supabase = createClient()
        const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
            // Refetch or update if needed, but we don't need local state for redirect loops anymore
        })
        return () => subscription.unsubscribe()
    }, [])

    // Calculate total for only selected items
    const selectedItems = items.filter(item => selectedIds.includes(item.id))
    const selectedTotal = selectedItems.reduce((acc, item) => acc + item.price, 0)

    const toggleSelect = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        )
    }

    const toggleSelectAll = () => {
        if (selectedIds.length === items.length) {
            setSelectedIds([])
        } else {
            setSelectedIds(items.map(i => i.id))
        }
    }

    const handleCheckout = async () => {
        if (selectedIds.length === 0) return
        setShowCheckout(true)
    }

    if (items.length === 0) {
        return (
            <div className={styles.emptyState}>
                <ShoppingBag size={64} style={{ marginBottom: '24px', opacity: 0.3 }} />
                <h1>Your cart is empty</h1>
                <p>Looks like you haven't uploaded any designs yet.</p>
                <Link href="/upload" className="btn">Start Printing</Link>
            </div>
        )
    }

    return (
        <div className="container" style={{ paddingTop: '120px', paddingBottom: '100px' }}>
            {isLoading && <Loader text="Processing..." />}
            <div className={styles.header}>
                <div className={styles.backWrapper}>
                    <BackButton fallback="/upload" />
                </div>
                <h1 className="title-gradient" style={{ margin: 0 }}>Shopping Cart</h1>
                <div className={styles.rightWrapper}>
                    <Link href="/upload" className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Plus size={18} /> Add More Parts
                    </Link>
                </div>
            </div>

            <div className={styles.layout}>
                {/* Items List */}
                <div className={styles.itemsList}>
                    <div className={styles.selectAllHeader}>
                        <label className={styles.checkboxContainer}>
                            <input
                                type="checkbox"
                                checked={selectedIds.length === items.length && items.length > 0}
                                onChange={toggleSelectAll}
                            />
                            <span className={styles.checkmark}></span>
                            Select All ({items.length} items)
                        </label>
                    </div>

                    {items.map((item) => (
                        <div key={item.id} className={`${styles.cartItem} glass ${selectedIds.includes(item.id) ? styles.selectedItem : ''}`}>
                            <div className={styles.selectionArea}>
                                <label className={styles.checkboxContainer}>
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.includes(item.id)}
                                        onChange={() => toggleSelect(item.id)}
                                    />
                                    <span className={styles.checkmark}></span>
                                </label>
                            </div>
                            <div className={styles.itemInfo}>
                                <div className={styles.itemHeader}>
                                    <h3>{item.fileName}</h3>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <Link
                                            href={`/configure?id=${item.id}&source=cart`}
                                            className={styles.editBtn}
                                        >
                                            <Edit size={18} />
                                        </Link>
                                        <button onClick={() => removeItem(item.id)} className={styles.removeBtn}>
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                                <div className={styles.itemMeta}>
                                    <div className={styles.metaItem}>Material: <strong>{item.material}</strong></div>
                                    {item.brand && <div className={styles.metaItem}>Brand: <strong>{item.brand}</strong></div>}
                                    <div className={styles.metaItem}>Weight: <strong>{item.weight}g</strong></div>
                                    <div className={styles.colorRow}>
                                        <span>Colors: </span>
                                        <div className={styles.colorStack}>
                                            {item.amsColors && item.amsColors.length > 0 ? (
                                                item.amsColors.map((c, i) => (
                                                    <div key={i} className={styles.colorCircle} style={{ backgroundColor: c }} title={`Slot ${i + 1}`} />
                                                ))
                                            ) : (
                                                <div className={styles.colorCircle} style={{ backgroundColor: item.color }} />
                                            )}
                                        </div>
                                    </div>
                                    <div className={styles.tagGroup}>
                                        <span className={styles.paramTag}>
                                            Infill: {item.infill}% ({item.infillPattern || 'Grid'})
                                        </span>
                                        <span className={`${styles.paramTag} ${item.brim ? styles.brimTag : ''}`}>
                                            Brim: {item.brim ? 'Yes' : 'No'}
                                        </span>
                                        {item.supportType && item.supportType !== 'none' && (
                                            <span className={`${styles.paramTag} ${styles.supportTag}`}>
                                                Support: {item.supportType.toUpperCase()}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className={styles.itemPriceSection}>
                                    <div className={styles.quantity}>
                                        <span style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)' }}>Qty: {item.quantity}</span>
                                    </div>
                                    <span className={styles.price}>{formatCurrency(item.price)}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Summary Card */}
                <div className={styles.summarySection}>
                    <div className="glass" style={{ padding: '30px', borderRadius: '16px', position: 'sticky', top: '100px' }}>
                        <h2 style={{ marginBottom: '24px' }}>Order Summary</h2>

                        <div className={styles.summaryRow}>
                            <span>Subtotal ({selectedIds.length} items)</span>
                            <span>{formatCurrency(selectedTotal)}</span>
                        </div>

                        <hr style={{ border: 'none', borderTop: '1px solid var(--glass-border)', margin: '20px 0' }} />

                        <div className={`${styles.summaryRow} ${styles.totalRow}`}>
                            <span>Total</span>
                            <span>{formatCurrency(selectedTotal)}</span>
                        </div>

                        <button
                            className="btn"
                            style={{ width: '100%', marginTop: '32px' }}
                            onClick={handleCheckout}
                            disabled={selectedIds.length === 0}
                        >
                            Checkout <CreditCard size={18} style={{ marginLeft: 8 }} />
                        </button>
                        <p style={{ textAlign: 'center', fontSize: '0.8rem', marginTop: '16px', opacity: 0.5 }}>
                            Payment details (UPI) will be provided after order confirmation.
                        </p>
                    </div>
                </div>
            </div>

            {showCheckout && (
                <CheckoutModal
                    total={selectedTotal}
                    selectedItems={selectedItems}
                    onClose={() => setShowCheckout(false)}
                    onSuccess={async () => {
                        // Only remove selected items from cart
                        await Promise.all(selectedIds.map(id => removeItem(id)))
                        setShowCheckout(false)
                        router.push('/orders')
                    }}
                />
            )}


        </div>
    )
}

export default function CartPage() {
    return (
        <Suspense fallback={<Loader text="Loading Cart..." />}>
            <CartContent />
        </Suspense>
    )
}
