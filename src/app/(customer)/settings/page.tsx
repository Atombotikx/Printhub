'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import styles from './Settings.module.css'
import { User, MapPin, Plus, Trash2, Settings as SettingsIcon, Bell, Moon, Shield, Zap, DollarSign, Activity } from 'lucide-react'
import BackButton from '@/components/BackButton'
import { createClient } from '@/utils/supabase/client'
import { User as SupabaseUser } from '@supabase/supabase-js'
import { useToastStore } from '@/store/toastStore'
import { useAdminStore } from '@/store/adminStore'
import Loader from '@/components/Loader'

interface Address {
    id: string
    full_name: string
    address_line1: string
    city: string
    zip_code: string
    phone: string
}

export default function SettingsPage() {
    const router = useRouter()
    const addToast = useToastStore((state) => state.addToast)
    const {
        electricityRate,
        miscellaneousFee,
        updateGlobalSettings
    } = useAdminStore()

    const [user, setUser] = useState<SupabaseUser | null>(null)
    const [loading, setLoading] = useState(true)

    // Admin Specific State
    const [isAdmin, setIsAdmin] = useState(false)
    const [localElecRate, setLocalElecRate] = useState(electricityRate)
    const [localMiscFee, setLocalMiscFee] = useState(miscellaneousFee)
    const [maintenanceMode, setMaintenanceMode] = useState(false)

    const [activeTab, setActiveTab] = useState('profile')

    // Profile info
    const [phone, setPhone] = useState('')
    const [fullName, setFullName] = useState('')

    // Addresses from Supabase
    const [addresses, setAddresses] = useState<Address[]>([])
    const [showAddAddress, setShowAddAddress] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [newAddress, setNewAddress] = useState({
        full_name: '',
        address_line1: '',
        city: '',
        zip_code: '',
        phone: ''
    })

    useEffect(() => {
        loadUserData()
        // Sync local admin state with store on mount
        setLocalElecRate(electricityRate)
        setLocalMiscFee(miscellaneousFee)
    }, [])

    const loadUserData = async () => {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            router.push('/login')
            return
        }

        setUser(user)
        setIsAdmin(user.email ? (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').includes(user.email) : false)
        setFullName(user.user_metadata?.full_name || '')

        if (user.email && (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').includes(user.email)) {
            // Default admin tab to 'configuration'
            setActiveTab('configuration')
        }

        // Load user_details (for name and phone)
        const { data: details } = await supabase
            .from('user_details')
            .select('*')
            .eq('user_id', user.id)
            .single()

        if (details) {
            setFullName(details.full_name || user.user_metadata?.full_name || '')
            setPhone(details.phone || '')
        } else {
            // Fallback to metadata if no DB record yet
            setFullName(user.user_metadata?.full_name || '')
        }

        // Load addresses (Only for non-admin)
        if (!user.email || !(process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').includes(user.email)) {
            const { data: addrs } = await supabase
                .from('addresses')
                .select('*')
                .eq('user_id', user.id)

            if (addrs) {
                setAddresses(addrs)
            }
        }

        setLoading(false)
    }

    const saveAdminSettings = () => {
        updateGlobalSettings({
            electricityRate: Number(localElecRate),
            miscellaneousFee: Number(localMiscFee)
        })
        addToast('Global settings updated!', 'success')
    }

    if (loading) {
        return <Loader text="Loading profile..." />
    }

    if (!user) return null


    const saveProfile = async () => {
        if (!user) return

        try {
            const supabase = createClient()
            // Update auth metadata
            const { error: authError } = await supabase.auth.updateUser({
                data: { full_name: fullName }
            })
            if (authError) throw authError

            // Update user_details table
            const { error: detailError } = await supabase
                .from('user_details')
                .upsert({
                    user_id: user.id,
                    full_name: fullName,
                    phone: phone,
                    updated_at: new Date().toISOString()
                })

            if (detailError) throw detailError

            // Re-fetch user to get updated metadata locally
            const { data: { user: updatedUser } } = await supabase.auth.getUser()
            setUser(updatedUser)
            addToast('Profile saved!', 'success')
        } catch (error) {
            addToast('Failed to save profile', 'error')
        }
    }

    const handleAddAddress = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user) return

        try {
            const supabase = createClient()
            const addressPayload = {
                user_id: user.id,
                full_name: newAddress.full_name,
                address_line1: newAddress.address_line1,
                city: newAddress.city,
                zip_code: newAddress.zip_code,
                phone: newAddress.phone
            }

            if (editingId) {
                // Update existing
                const { data, error } = await supabase
                    .from('addresses')
                    .update(addressPayload)
                    .eq('id', editingId)
                    .select()

                if (error) throw error
                if (data) {
                    setAddresses(addresses.map(a => a.id === editingId ? data[0] : a))
                    addToast('Address updated successfully!', 'success')
                }
            } else {
                // Insert new
                const { data, error } = await supabase
                    .from('addresses')
                    .insert(addressPayload)
                    .select()

                if (error) throw error
                if (data) {
                    setAddresses([...addresses, data[0]])
                    addToast('Address added successfully!', 'success')
                }
            }

            setNewAddress({ full_name: '', address_line1: '', city: '', zip_code: '', phone: '' })
            setShowAddAddress(false)
            setEditingId(null)
        } catch (error) {
            addToast('Failed to save address', 'error')
        }
    }

    const openAddressForm = (addr?: Address) => {
        if (addr) {
            setEditingId(addr.id)
            setNewAddress({
                full_name: addr.full_name,
                address_line1: addr.address_line1,
                city: addr.city,
                zip_code: addr.zip_code,
                phone: addr.phone || ''
            })
        } else {
            setEditingId(null)
            setNewAddress({
                full_name: user?.user_metadata?.full_name || '',
                address_line1: '',
                city: '',
                zip_code: '',
                phone: phone || ''
            })
        }
        setShowAddAddress(true)
    }

    const closeAddressForm = () => {
        setShowAddAddress(false)
        setEditingId(null)
        setNewAddress({ full_name: '', address_line1: '', city: '', zip_code: '', phone: '' })
    }

    const handleDeleteAddress = async (id: string) => {
        try {
            const supabase = createClient()
            const { error, count } = await supabase
                .from('addresses')
                .delete({ count: 'exact' })
                .eq('id', id)

            if (error) throw error

            // Update local state
            setAddresses(addresses.filter(addr => addr.id !== id))
            addToast('Address deleted successfully!', 'success')
        } catch (error: any) {
            addToast(`Failed to delete: ${error.message}`, 'error')
        }
    }


    return (
        <div className={styles.container}>
            <BackButton />
            <div className={styles.header}>
                <h1 className="title-gradient">{isAdmin ? 'Admin Settings' : 'Account Settings'}</h1>
            </div>

            <div className={styles.grid}>
                {/* Sidebar */}
                <div className={styles.sidebar}>
                    <div className={styles.userInfo}>
                        <div className={styles.avatar}>
                            {user.user_metadata?.avatar_url ? (
                                <img src={user.user_metadata.avatar_url} alt={user.user_metadata.full_name || 'User'} />
                            ) : (
                                <User size={40} />
                            )}
                        </div>
                        <div className={styles.userDetails}>
                            <h3>{user.user_metadata?.full_name || 'User'}</h3>
                            <p>{user.email}</p>
                            {isAdmin && <span className={styles.badge}>ADMIN</span>}
                        </div>
                    </div>

                    <nav className={styles.nav}>
                        {isAdmin && (
                            <button
                                className={`${styles.navItem} ${activeTab === 'configuration' ? styles.active : ''}`}
                                onClick={() => setActiveTab('configuration')}
                            >
                                <SettingsIcon size={20} />
                                Global Config
                            </button>
                        )}

                        <button
                            className={`${styles.navItem} ${activeTab === 'profile' ? styles.active : ''}`}
                            onClick={() => setActiveTab('profile')}
                        >
                            <User size={20} />
                            Edit Profile
                        </button>

                        {!isAdmin && (
                            <button
                                className={`${styles.navItem} ${activeTab === 'addresses' ? styles.active : ''}`}
                                onClick={() => setActiveTab('addresses')}
                            >
                                <MapPin size={20} />
                                Addresses
                            </button>
                        )}


                    </nav>
                </div>

                {/* Content Area */}
                <div className={styles.content}>
                    {activeTab === 'configuration' && isAdmin && (
                        <div className={styles.section}>
                            <h2>Global Platform Settings</h2>
                            <p className={styles.subtitle}>These settings affect all new order calculations immediately.</p>

                            <form className={styles.form} onSubmit={(e) => e.preventDefault()}>
                                <div className={styles.formGroup}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                        <Zap size={18} color="var(--primary-color)" />
                                        <label style={{ margin: 0 }}>Electricity Rate (INR/Hour)</label>
                                    </div>
                                    <input
                                        type="number"
                                        value={localElecRate}
                                        onChange={(e) => setLocalElecRate(parseFloat(e.target.value))}
                                        className={styles.input}
                                    />
                                    <p className={styles.hint}>Used to calculate print cost based on estimated print hours.</p>
                                </div>

                                <div className={styles.formGroup}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                        <DollarSign size={18} color="var(--primary-color)" />
                                        <label style={{ margin: 0 }}>Miscellaneous Fee (INR)</label>
                                    </div>
                                    <input
                                        type="number"
                                        value={localMiscFee}
                                        onChange={(e) => setLocalMiscFee(parseFloat(e.target.value))}
                                        className={styles.input}
                                    />
                                    <p className={styles.hint}>Flat fee added to every line item for handling/packaging.</p>
                                </div>

                                <div className={styles.divider}></div>

                                <div className={styles.formGroup} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <Activity size={24} color={maintenanceMode ? '#ff4d4d' : '#888'} />
                                        <div>
                                            <label style={{ margin: 0, fontSize: '1rem', color: 'white' }}>Maintenance Mode</label>
                                            <p className={styles.hint} style={{ margin: 0 }}>Disable new uploads and orders</p>
                                        </div>
                                    </div>
                                    <label className={styles.switch}>
                                        <input
                                            type="checkbox"
                                            checked={maintenanceMode}
                                            onChange={(e) => setMaintenanceMode(e.target.checked)}
                                        />
                                        <span className={styles.slider}></span>
                                    </label>
                                </div>

                                <button className={styles.saveBtn} onClick={saveAdminSettings} style={{ marginTop: '24px' }}>
                                    Update Global Settings
                                </button>
                            </form>
                        </div>
                    )}

                    {activeTab === 'profile' && (
                        <div className={styles.section}>
                            <h2>Edit Profile</h2>
                            <form className={styles.form} onSubmit={(e) => e.preventDefault()}>
                                <div className={styles.formGroup}>
                                    <label>Full Name</label>
                                    <input
                                        type="text"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        className={styles.input}
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Email Address</label>
                                    <input type="email" defaultValue={user.email || ''} disabled className={styles.input} />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Phone Number</label>
                                    <input
                                        type="tel"
                                        placeholder="+xx xxxxxxxxxx"
                                        className={styles.input}
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                    />
                                </div>
                                <button className={styles.saveBtn} onClick={saveProfile} type="button">Save Changes</button>
                            </form>
                        </div>
                    )}

                    {activeTab === 'addresses' && !isAdmin && (
                        <div className={styles.section}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <h2>Saved Addresses</h2>
                                {!showAddAddress && (
                                    <button
                                        className={styles.secondaryBtn}
                                        onClick={() => openAddressForm()}
                                    >
                                        <Plus size={18} /> Add New
                                    </button>
                                )}
                            </div>

                            {showAddAddress && (
                                <form onSubmit={handleAddAddress} className={styles.addressForm}>
                                    <h3 style={{ marginTop: 0, marginBottom: '20px', color: 'white' }}>
                                        {editingId ? 'Edit Address' : 'Add New Address'}
                                    </h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                        <div className={styles.formGroup}>
                                            <label>Full Name (Recipient)</label>
                                            <input
                                                placeholder="Recipient's Name"
                                                className={styles.input}
                                                value={newAddress.full_name}
                                                onChange={e => setNewAddress({ ...newAddress, full_name: e.target.value })}
                                                required
                                            />
                                        </div>
                                        <div className={styles.formGroup}>
                                            <label>Mobile Number</label>
                                            <input
                                                placeholder="Recipient's Phone"
                                                className={styles.input}
                                                value={newAddress.phone}
                                                onChange={e => setNewAddress({ ...newAddress, phone: e.target.value })}
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>Street Address</label>
                                        <input
                                            placeholder="House No, Area, Landmark..."
                                            className={styles.input}
                                            value={newAddress.address_line1}
                                            onChange={e => setNewAddress({ ...newAddress, address_line1: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                        <div className={styles.formGroup}>
                                            <label>City</label>
                                            <input
                                                placeholder="City"
                                                className={styles.input}
                                                value={newAddress.city}
                                                onChange={e => setNewAddress({ ...newAddress, city: e.target.value })}
                                                required
                                            />
                                        </div>
                                        <div className={styles.formGroup}>
                                            <label>ZIP Code</label>
                                            <input
                                                placeholder="ZIP Code"
                                                className={styles.input}
                                                value={newAddress.zip_code}
                                                onChange={e => setNewAddress({ ...newAddress, zip_code: e.target.value })}
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                                        <button type="submit" className={styles.saveBtn}>
                                            {editingId ? 'Update Address' : 'Save Address'}
                                        </button>
                                        <button
                                            type="button"
                                            className={styles.cancelBtn}
                                            onClick={closeAddressForm}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            )}

                            {!showAddAddress && addresses.length > 0 && (
                                <div className={styles.addressList}>
                                    {addresses.map(addr => (
                                        <div key={addr.id} className={styles.addressCard}>
                                            <div className={styles.addressIcon}>
                                                <MapPin size={24} />
                                            </div>
                                            <div className={styles.addressDetails}>
                                                <h4>{addr.full_name}</h4>
                                                <p>{addr.address_line1}, {addr.city}, {addr.zip_code}</p>
                                                {addr.phone && <p style={{ fontSize: '0.8rem', color: 'var(--primary-color)', marginTop: '4px' }}>📞 {addr.phone}</p>}
                                            </div>
                                            <div className={styles.addressItemActions}>
                                                <button
                                                    className={styles.editBtn}
                                                    onClick={() => openAddressForm(addr)}
                                                    title="Edit Address"
                                                >
                                                    <SettingsIcon size={18} />
                                                </button>
                                                <button
                                                    className={styles.deleteBtn}
                                                    onClick={() => handleDeleteAddress(addr.id)}
                                                    title="Delete Address"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {addresses.length === 0 && !showAddAddress && (
                                <div className={styles.emptyState}>
                                    <MapPin size={48} />
                                    <p>No addresses saved yet</p>
                                </div>
                            )}
                        </div>
                    )}

                </div>
            </div>
        </div>
    )
}
