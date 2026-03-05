'use client'
import { useState, useEffect } from 'react'
import styles from './CheckoutModal.module.css'
import { X, CreditCard, Shield, Truck, MapPin, Plus, Phone, ArrowLeft } from 'lucide-react'
import { formatCurrency } from '@/utils/pricingEngine'
import { useCartStore } from '@/store/cartStore'
import { createClient } from '@/utils/supabase/client'
import { useToastStore } from '@/store/toastStore'
import { useRouter } from 'next/navigation'

import Loader from '@/components/Loader'

interface CheckoutModalProps {
    total: number
    selectedItems: any[]
    onClose: () => void
    onSuccess: () => void
}

export default function CheckoutModal({ total, selectedItems, onClose, onSuccess }: CheckoutModalProps) {
    const [step, setStep] = useState(1)
    const [isLoading, setIsLoading] = useState(false)
    const [savedAddresses, setSavedAddresses] = useState<any[]>([])
    const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null)
    const [showNewAddressForm, setShowNewAddressForm] = useState(false)
    const [deliveryMethod, setDeliveryMethod] = useState<'standard' | 'porter' | 'pickup'>('standard')

    // Shipping State (for new address)
    const [shipping, setShipping] = useState({
        full_name: '',
        address_line1: '',
        city: '',
        zip_code: '',
        phone: ''
    })

    const fetchAddresses = async () => {
        setIsLoading(true)
        try {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                // Pre-fill name from auth metadata if available
                if (user.user_metadata?.full_name) {
                    setShipping(s => ({ ...s, full_name: String(user.user_metadata.full_name) }))
                }
                if (user.phone) {
                    setShipping(s => ({ ...s, phone: String(user.phone) }))
                }

                const { data } = await supabase.from('addresses').select('*').eq('user_id', user.id)
                if (data && data.length > 0) {
                    setSavedAddresses(data)
                    // Auto-select first if none selected
                    if (!selectedAddressId) setSelectedAddressId(data[0].id)
                } else {
                    setShowNewAddressForm(true) // No addresses, show form
                }
            }
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchAddresses()
    }, [])

    const finalTotal = total // No shipping cost initially on user side

    const handleShippingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setShipping({ ...shipping, [e.target.name]: e.target.value })
    }

    const { removeItem } = useCartStore()

    const router = useRouter() // Make sure to import this from 'next/navigation'

    const handleConfirmOrder = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)

        try {
            const supabase = createClient()
            // Race getUser against a 5-second timeout to prevent indefinite hanging
            const getUserWithTimeout = Promise.race([
                supabase.auth.getUser(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Auth check timed out')), 5000))
            ]) as Promise<{ data: { user: any } }>

            const { data: { user } } = await getUserWithTimeout

            if (!user) {
                const addToast = useToastStore.getState().addToast
                addToast('Please login to place an order', 'info')
                router.push('/login?callbackUrl=/cart')
                throw new Error("User not authenticated")
            }

            let finalAddressId = selectedAddressId
            let finalAddressData = null

            // 1. Handle Address (New or Selected)
            if (showNewAddressForm || !finalAddressId) {
                // Save new address
                const { data: addressData, error: addressError } = await supabase
                    .from('addresses')
                    .insert({
                        user_id: user.id,
                        full_name: shipping.full_name,
                        address_line1: shipping.address_line1,
                        city: shipping.city,
                        zip_code: shipping.zip_code,
                        phone: shipping.phone
                    })
                    .select()
                    .single()

                if (addressError) throw addressError
                finalAddressId = addressData.id
                finalAddressData = addressData // Use snapshot if needed
            } else {
                // Fetch selected address snapshot for the order record (ensure we have it)
                const { data } = await supabase.from('addresses').select('*').eq('id', finalAddressId).single()
                finalAddressData = data
            }

            // 2. Create Order

            const { data: orderData, error: orderError } = await supabase
                .from('orders')
                .insert({
                    user_id: user.id,
                    status: 'ordered', // Initial status as requested
                    total_amount: finalTotal,
                    shipping_address: finalAddressData,
                    delivery_method: deliveryMethod,
                    shipping_cost: 0 // Will be updated by admin
                })
                .select()
                .single()

            if (orderError) throw orderError

            // 3. Move STL files from the temporary cart folder into the order's permanent folder.
            //    Cart path:  models/{userId}/{filename}.stl         (assigned at upload time)
            //    Order path: models/{userId}/{orderId}/{filename}.stl  (assigned at checkout)
            const itemsToInsert = await Promise.all(
                selectedItems.map(async (item) => {
                    let storagePath = item.fileUrl

                    // If the fileUrl is somehow still a full URL (legacy), extract the path
                    if (item.fileUrl.startsWith('http')) {
                        try {
                            const url = new URL(item.fileUrl)
                            const pathParts = url.pathname.split('/')
                            const printsIndex = pathParts.indexOf('prints')
                            if (printsIndex !== -1) {
                                storagePath = decodeURIComponent(pathParts.slice(printsIndex + 1).join('/'))
                            }
                        } catch (e) {
                            console.error('URL parse error:', e)
                        }
                    }

                    // New permanent path: models/{userId}/{orderId}/{original_filename}
                    const originalFileName = storagePath.split('/').pop() || item.fileName
                    const newPath = `models/${user.id}/${orderData.id}/${originalFileName}`

                    // Move the file from its temp cart location to the order's permanent folder
                    let finalPath = storagePath
                    if (storagePath !== newPath) {
                        const { error: moveError } = await supabase.storage
                            .from('prints')
                            .move(storagePath, newPath)
                        if (!moveError) {
                            finalPath = newPath
                        } else {
                            console.warn('File move failed, keeping original path:', moveError)
                        }
                    }

                    return {
                        order_id: orderData.id,
                        file_name: item.fileName, // Keep original display name
                        file_url: finalPath,       // Updated storage path
                        material: item.material,
                        color: item.color,
                        quantity: item.quantity,
                        price: item.price,
                        volume: item.volume,
                        weight: item.weight,
                        dimensions: item.dimensions,
                        layer_height: item.layerHeight,
                        infill: item.infill,
                        support_type: item.supportType,
                        support_material: item.supportMaterial || null,
                        brim: item.brim || false,
                        brand: item.brand || null,
                        infill_pattern: item.infillPattern || 'grid',
                        ams_colors: item.amsColors || [],
                        ams_brands: item.amsBrands || []
                    }
                })
            )

            // 4. Insert into order_items table using the updated data
            const { error: itemsError } = await supabase
                .from('order_items')
                .insert(itemsToInsert)

            if (itemsError) throw itemsError

            await new Promise(resolve => setTimeout(resolve, 1000))

            const addToast = useToastStore.getState().addToast
            addToast('Order placed successfully!', 'success')

            // Handled by onSuccess in page.tsx now
            onSuccess()

        } catch (error: any) {
            console.error('Checkout Error Full:', error)

            // Should capture standard Error objects too
            const errorMessage = error.message || (typeof error === 'object' ? JSON.stringify(error) : String(error))

            if (errorMessage !== "User not authenticated") {
                const addToast = useToastStore.getState().addToast
                addToast(`Checkout issue: ${errorMessage}`, 'error')
            }
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className={styles.overlay}>
            {isLoading && <Loader text={savedAddresses.length === 0 && !showNewAddressForm ? "Loading your details..." : "Confirming your order..."} />}
            <div className={`${styles.modal} glass`}>
                <div style={{ position: 'absolute', top: '22px', left: '24px', zIndex: 10 }}>
                    <button type="button" className={styles.backLink} onClick={onClose} style={{ margin: 0, color: 'rgba(255,255,255,0.7)', transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = 'white'} onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.7)'}>
                        <ArrowLeft size={16} /> Back
                    </button>
                </div>
                <button type="button" className={styles.closeBtn} onClick={onClose}><X size={20} /></button>

                <form onSubmit={handleConfirmOrder} className={styles.form}>
                    <div className={styles.stepHeader} style={{ justifyContent: 'center' }}>
                        <h2 style={{ textAlign: 'center' }}>Checkout</h2>
                    </div>

                    {/* Saved Addresses Section */}
                    <div className={styles.section}>
                        <div className={styles.sectionHeader}>
                            <h3><MapPin size={18} /> Shipping Address</h3>
                            {!showNewAddressForm && <button type="button" className={styles.addBtn} onClick={() => { setShowNewAddressForm(true); setSelectedAddressId(null); }}><Plus size={14} /> Add New</button>}
                        </div>

                        {!showNewAddressForm && savedAddresses.length > 0 && (
                            <div className={styles.addressGrid}>
                                {savedAddresses.map(addr => (
                                    <div
                                        key={addr.id}
                                        className={`${styles.addressCard} ${selectedAddressId === addr.id ? styles.selected : ''}`}
                                        onClick={() => setSelectedAddressId(addr.id)}
                                    >
                                        <div className={styles.cardContent}>
                                            <div className={styles.cardTop}>
                                                <strong>{addr.full_name}</strong>
                                                {selectedAddressId === addr.id && <div className={styles.checkIndicator}><div className={styles.checkInner}></div></div>}
                                                {selectedAddressId !== addr.id && <div className={styles.radioIndicator}></div>}
                                            </div>
                                            <div className={styles.cardDetails}>
                                                <p>{addr.address_line1}</p>
                                                <p>{addr.city}, {addr.zip_code}</p>
                                                <div className={styles.phoneTag}><Phone size={12} /> {addr.phone}</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* New Address Form */}
                        {(showNewAddressForm || savedAddresses.length === 0) && (
                            <div className={styles.newAddressForm}>
                                {savedAddresses.length > 0 && (
                                    <button type="button" className={styles.backLink} onClick={() => setShowNewAddressForm(false)}>
                                        ← Back to saved addresses
                                    </button>
                                )}
                                <div className={styles.inputGrid}>
                                    <div className={styles.inputGroup}>
                                        <label>Full Name</label>
                                        <input type="text" name="full_name" placeholder="E.g. John Doe" value={shipping.full_name} onChange={handleShippingChange} required={showNewAddressForm} className={styles.input} autoComplete="name" />
                                    </div>
                                    <div className={styles.inputGroup}>
                                        <label>Mobile Number</label>
                                        <input type="tel" name="phone" placeholder="+91 99999 99999" value={shipping.phone} onChange={handleShippingChange} required={showNewAddressForm} className={styles.input} autoComplete="tel" />
                                    </div>
                                    <div className={`${styles.inputGroup} ${styles.fullWidth}`}>
                                        <label>Address</label>
                                        <input type="text" name="address_line1" placeholder="Flat/House No, Street, Area" value={shipping.address_line1} onChange={handleShippingChange} required={showNewAddressForm} className={styles.input} autoComplete="shipping address-line1" />
                                    </div>
                                    <div className={styles.inputGroup}>
                                        <label>City</label>
                                        <input type="text" name="city" placeholder="City" value={shipping.city} onChange={handleShippingChange} required={showNewAddressForm} className={styles.input} />
                                    </div>
                                    <div className={styles.inputGroup}>
                                        <label>Zip Code</label>
                                        <input type="text" name="zip_code" placeholder="Zip Code" value={shipping.zip_code} onChange={handleShippingChange} required={showNewAddressForm} className={styles.input} />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Delivery Method Selection */}
                    <div className={styles.section}>
                        <h3 className={styles.sectionTitle}><Truck size={18} /> Delivery Method</h3>
                        <div className={styles.deliveryGrid}>
                            <div
                                className={`${styles.deliveryOption} ${deliveryMethod === 'standard' ? styles.selected : ''}`}
                                onClick={() => setDeliveryMethod('standard')}
                            >
                                <div className={styles.optionHeader}>
                                    <Truck size={20} />
                                    <span>Standard</span>
                                </div>
                                <p>Reliable shipping within 3-5 days.</p>
                            </div>
                            <div
                                className={`${styles.deliveryOption} ${deliveryMethod === 'porter' ? styles.selected : ''}`}
                                onClick={() => setDeliveryMethod('porter')}
                            >
                                <div className={styles.optionHeader}>
                                    <Truck size={20} className={styles.fastIcon} />
                                    <span>Local Shipping</span>
                                </div>
                                <p>Instant local delivery via Porter.</p>
                            </div>
                            <div
                                className={`${styles.deliveryOption} ${deliveryMethod === 'pickup' ? styles.selected : ''}`}
                                onClick={() => setDeliveryMethod('pickup')}
                            >
                                <div className={styles.optionHeader}>
                                    <MapPin size={20} />
                                    <span>Self Pickup</span>
                                </div>
                                <p>Collect from our facility directly.</p>
                            </div>
                        </div>

                        <div className={styles.liveTotal}>
                            <span style={{ fontSize: '1rem', fontWeight: 500, color: 'white' }}>Parts Total:</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end', flex: 1, textAlign: 'right' }}>
                                <strong style={{ fontSize: '1.4rem', color: '#00ff88' }}>{formatCurrency(finalTotal)}</strong>
                                {deliveryMethod !== 'pickup' && (
                                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'rgba(255, 255, 255, 0.7)', whiteSpace: 'nowrap' }}>+ shipping</span>
                                )}
                            </div>
                        </div>
                        <p style={{ fontSize: '0.8rem', opacity: 0.6, marginTop: '8px', color: '#00ff88' }}>
                            * Kindly confirm the order and we will get back to you with the shipping cost.
                        </p>
                    </div>

                    <button type="submit" className={styles.primaryBtn} disabled={isLoading}>
                        {isLoading ? 'Processing...' : 'Confirm Order'}
                    </button>
                </form>
            </div>
        </div>
    )
}
