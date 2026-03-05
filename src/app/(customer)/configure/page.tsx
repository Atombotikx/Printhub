'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, Minus, ShoppingCart, Trash2, Scissors, Save, Clock } from 'lucide-react'
import BackButton from '@/components/BackButton'
import styles from './Configure.module.css'
import STLViewer from '@/components/STLViewer'
import GCodeViewer from '@/components/GCodeViewer'
import MaterialChart from '@/components/MaterialChart'
import CustomSelect from '@/components/CustomSelect'
import { FilamentKey, calculateDetailedPrice, formatCurrency } from '@/utils/pricingEngine'
import { estimateSupportMaterial } from '@/lib/estimate3d'
import { extractColors } from '@/lib/fileAnalyzer'
import { analyzeGeometry, formatFileSize, STLParameters } from '@/utils/stlAnalyzer'
import { useCartStore, CartItem } from '@/store/cartStore'
import { useQueueStore } from '@/store/queueStore'
import { useAdminStore } from '@/store/adminStore'
import { useToastStore } from '@/store/toastStore'
import * as THREE from 'three'
import { STLLoader } from 'three-stdlib'
import { uploadModelToStorage } from '@/utils/uploadModel'
import { getCustomerSignedModelUrl } from '@/app/(customer)/actions'
import { createClient } from '@/utils/supabase/client'
import { saveFileToDB, getFileFromDB, deleteFileFromDB } from '@/utils/db'
import Loader from '@/components/Loader'

function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID()
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8)
        return v.toString(16)
    })
}

interface FileData {
    file: File
    url: string
}

function ConfigureContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const id = searchParams.get('id')
    const source = searchParams.get('source') // 'queue' or 'cart'

    const [fileData, setFileData] = useState<FileData | null>(null)
    const [material, setMaterial] = useState<FilamentKey>('PLA')
    const [quantity, setQuantity] = useState<number | string>(1)
    const [color, setColor] = useState('#ffffff')
    const [parameters, setParameters] = useState<STLParameters | null>(null)
    const [loading, setLoading] = useState(true)
    const [isUploading, setIsUploading] = useState(true)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [infill, setInfill] = useState(20)
    const [infillPattern, setInfillPattern] = useState('grid')
    const [showComparison, setShowComparison] = useState(false)
    const [showMaterialDetails, setShowMaterialDetails] = useState(false)
    const [amsColors, setAmsColors] = useState<string[]>(['#ffffff'])
    const [showCrossSection, setShowCrossSection] = useState(true)
    const [crossSectionHeight, setCrossSectionHeight] = useState(100)
    const [autoRotate, setAutoRotate] = useState(true)
    const [showWireframe, setShowWireframe] = useState(false)
    const [crossSectionAxis, setCrossSectionAxis] = useState<'x' | 'y' | 'z'>('y')
    const [brim, setBrim] = useState(false)
    const [activeTab, setActiveTab] = useState<'stl' | 'gcode'>('stl')
    const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null)
    const [amsActiveIndex, setAmsActiveIndex] = useState(0)
    const [persistentUrl, setPersistentUrl] = useState<string | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const [selectedBrand, setSelectedBrand] = useState<string>('') // New: dedicated brand state
    const uploadRef = useRef<Promise<string> | null>(null)
    const action = searchParams.get('action')
    const [hasAutoCheckedOut, setHasAutoCheckedOut] = useState(false)
    const [loadedId, setLoadedId] = useState<string | null>(null)
    const lastMaterialRef = useRef<FilamentKey | ''>('')
    const lastBrandRef = useRef<string | null>(null)
    const isInitializingRef = useRef(false)


    const [supportType, setSupportType] = useState<string>('standard') // Default logic changed
    const [supportMaterial, setSupportMaterial] = useState<FilamentKey>('PLA')

    const addItem = useCartStore((state) => state.addItem)
    const updateItem = useCartStore((state) => state.updateItem)
    const cartItems = useCartStore((state) => state.items)
    const queueItems = useQueueStore((state) => state.items)
    const removeFromQueue = useQueueStore((state) => state.removeFromQueue)
    const updateQueueItem = useQueueStore((state) => state.updateQueueItem)
    const {
        filaments: adminFilaments,
        printers,
        hasHydrated,
        materialTypes,
        supportTypes,
        electricityRate,
        miscellaneousFee,
        supportMaterialPrice,
        fetchSettings
    } = useAdminStore()
    const availablePrinters = printers.filter(p => p.status === 'available' && (material === 'TPU' ? p.type === 'FDM' : true))
    const addToast = useToastStore((state) => state.addToast)
    const removeToast = useToastStore((state) => state.removeToast)

    useEffect(() => {
        fetchSettings()
    }, [fetchSettings])

    const availableBrands = Array.from(new Set(
        Object.values(adminFilaments)
            .filter(f => f.type === material)
            .map(f => f.brand || f.key)
    )).sort((a, b) => a.localeCompare(b))

    const displayBrand = selectedBrand || availableBrands[0] || ''

    // New: Count how many unique colors this brand has to restrict AMS additions
    const activeFilamentData = Object.values(adminFilaments).find(f =>
        f.type === material && (f.brand === displayBrand || f.key === displayBrand)
    )
    const availableColorsCount = activeFilamentData?.availableColors?.length || 0

    // Find the specific spool that the user picked the first color from
    const slot0Color = amsColors[0]
    const matchingSpool = Object.values(adminFilaments).find(f =>
        f.type === material && f.availableColors?.includes(slot0Color)
    )

    const activeFilament = matchingSpool || Object.values(adminFilaments).find(f => f.type === material)

    // Cross-tab sync for admin settings
    useEffect(() => {
        const handleStorage = (e: StorageEvent) => {
            if (e.key === 'admin-storage') {
                window.location.reload() // Simplest way to re-sync all states
            }
        }
        window.addEventListener('storage', handleStorage)
        return () => window.removeEventListener('storage', handleStorage)
    }, [])

    useEffect(() => {
        if (!id) {
            router.push('/upload')
            return
        }

        // Only load data if we haven't loaded THIS specific ID yet
        if (loadedId === id) return

        // Load from queue or cart based on source
        if (source === 'cart') {
            const cartItem = cartItems.find(item => item.id === id)
            if (cartItem) {
                setLoadedId(id)
                isInitializingRef.current = true
                loadFromCartItem(cartItem)
                // We keep it true for one more cycle to let the sync effect know we just loaded
                setTimeout(() => { isInitializingRef.current = false }, 100)
            } else if (hasHydrated) { // Only redirect if we ARE sure it doesn't exist
                router.push('/cart')
            }
        } else {
            // Load from queue
            const queueItem = queueItems.find(item => item.id === id)
            if (queueItem) {
                setLoadedId(id)
                loadFromQueueItem(queueItem)
            } else if (hasHydrated) {
                router.push('/upload')
            }
        }
    }, [id, source, cartItems, queueItems, loadedId, hasHydrated])

    const loadFromCartItem = async (cartItem: CartItem) => {
        setIsUploading(true)
        setLoading(true)

        // Pre-emptively sync the material ref to prevent the auto-sync effect from thinking
        // this programmatic loading is an intentional user material change.
        lastMaterialRef.current = cartItem.material
        lastBrandRef.current = cartItem.brand || ''

        // Handle secure storage path vs blob URL
        let url = cartItem.fileUrl

        // If it's a blob URL, it's likely dead after a redirect/refresh.
        // Try to recover it from IndexedDB.
        if (url.startsWith('blob:')) {
            const cachedFile = await getFileFromDB(cartItem.id);
            if (cachedFile) {
                url = URL.createObjectURL(cachedFile);
                setFileData({ file: cachedFile, url });
            } else {
                setFileData({ file: { name: cartItem.fileName, size: 0 } as any, url })
            }
        } else {
            setFileData({ file: { name: cartItem.fileName, size: 0 } as any, url })
        }

        setPersistentUrl(cartItem.fileUrl)
        setMaterial(cartItem.material)
        setQuantity(cartItem.quantity)
        setColor(cartItem.color)
        // setLayerHeight(cartItem.layerHeight || 0.2)
        setInfill(cartItem.infill || 20)
        setInfillPattern(cartItem.infillPattern || 'grid')
        setSupportType(cartItem.supportType || 'none')
        setSupportMaterial(cartItem.supportMaterial || cartItem.material)
        setBrim(cartItem.brim || false)
        if (cartItem.amsColors && cartItem.amsColors.length > 0) setAmsColors(cartItem.amsColors)
        if (cartItem.brand) setSelectedBrand(cartItem.brand)

        const isGCode = cartItem.fileName.toLowerCase().endsWith('.gcode')
        if (isGCode) setActiveTab('gcode')

        if (url) {
            analyzeFile(url, cartItem.fileName)
        }
    }


    const loadFromQueueItem = async (queueItem: any) => {
        // Pre-emptively sync the material ref to prevent auto-sync overwrites
        lastMaterialRef.current = queueItem.material || 'PLA'
        lastBrandRef.current = queueItem.brand || ''

        let file = queueItem.file;
        let url = queueItem.fileUrl;

        // If it's a blob URL, it's dead after a refresh. Try to recover.
        if (url.startsWith('blob:') && !file) {
            const cachedFile = await getFileFromDB(queueItem.id);
            if (cachedFile) {
                file = cachedFile;
                url = URL.createObjectURL(file);
            }
        }

        // If no file was found in memory or IndexedDB, use a placeholder
        const finalFile = file || { name: queueItem.fileName || 'model.stl', size: 0 } as File;
        setFileData({ file: finalFile, url: url })

        // If it's already a storage path (editing from cart), store it as persistentUrl
        if (!url.startsWith('blob:')) {
            setPersistentUrl(url)
        }

        // Analyze the STL file with real progress
        const isGCode = queueItem.fileName.toLowerCase().endsWith('.gcode')
        if (isGCode) setActiveTab('gcode')

        analyzeFile(url, queueItem.fileName)
    }



    useEffect(() => {
        if (action === 'checkout' && !loading && !isUploading && !isSaving && !hasAutoCheckedOut) {
            setHasAutoCheckedOut(true);
            handleSave();
        }
    }, [action, loading, isUploading, isSaving, hasAutoCheckedOut])


    // Auto-select first available material type if current one is missing or invalid
    useEffect(() => {
        if (hasHydrated && materialTypes?.length > 0) {
            if (!materialTypes.some(mt => mt.name === material)) {
                setMaterial(materialTypes[0]?.name as FilamentKey)
            }
        }
    }, [hasHydrated, materialTypes, material])

    // Auto-select first available support type if current one is invalid
    useEffect(() => {
        if (hasHydrated && supportTypes?.length > 0) {
            const validValues = supportTypes.map(t => t.toLowerCase())
            if (!validValues.includes(supportType.toLowerCase())) {
                setSupportType(validValues[0])
            }
        }
    }, [hasHydrated, supportTypes, supportType])

    // Sync Brand and Color based on availability
    useEffect(() => {
        if (!hasHydrated || isInitializingRef.current) return

        const isMaterialChanged = lastMaterialRef.current !== '' && lastMaterialRef.current !== material
        const isBrandChanged = lastBrandRef.current !== null && lastBrandRef.current !== selectedBrand

        lastMaterialRef.current = material
        lastBrandRef.current = selectedBrand

        // 1. Find all available brands for this material
        const brands = Array.from(new Set(
            Object.values(adminFilaments)
                .filter(f => f.type === material)
                .map(f => f.brand || f.key)
        )).sort((a, b) => a.localeCompare(b))

        // 2. Resolve the active brand
        let activeBrand = selectedBrand
        if (brands.length > 0) {
            // Only overwrite if no brand is selected OR the user explicitly changed the material making the old brand invalid
            if (!selectedBrand || (isMaterialChanged && !brands.includes(selectedBrand))) {
                activeBrand = brands[0]
                setSelectedBrand(activeBrand)
            }
        }

        // 3. Find the specific filament data for this brand to get its colors
        const filament = Object.values(adminFilaments).find(f =>
            f.type === material && (f.brand === activeBrand || f.key === activeBrand)
        )

        const colors = filament?.availableColors || []
        const userExplicitlyChanged = isMaterialChanged || isBrandChanged

        if (colors.length > 0) {
            // Main Color Sync
            // We strictly only auto-correct color if:
            // 1. There is no color at all
            // 2. The user just interacted (changed material/brand) AND the current color is invalid for it
            // 3. It is a completely new un-edited upload (!loadedId) and the color is invalid
            if (!color || (userExplicitlyChanged && !colors.includes(color)) || (!loadedId && !colors.includes(color))) {
                const defaultColor = colors.find((c: string) => !amsColors.includes(c)) || colors[0]
                setColor(defaultColor)

                // Sync Slot 0 if main color changes
                if (amsColors.length > 0 && amsColors[0] !== defaultColor) {
                    setAmsColors(prev => {
                        const next = [...prev]
                        next[0] = defaultColor
                        return next
                    })
                }
            } else if (amsColors.length > 0 && amsColors[0] !== color) {
                // Keep Slot 0 in sync with Main Color
                setAmsColors(prev => {
                    const next = [...prev]
                    next[0] = color
                    return next
                })
            }

            // Ensure all AMS slots have valid colors for THIS brand
            const hasInvalidAms = amsColors.some(c => !colors.includes(c))
            if (hasInvalidAms) {
                setAmsColors(prev => prev.map(c => colors.includes(c) ? c : (colors[0] || '')))
            }
        } else {
            // No colors available - Clear everything to prevent invalid state
            if (color !== '') setColor('')
            if (amsColors.length > 0) setAmsColors([])
        }
    }, [material, adminFilaments, hasHydrated, selectedBrand, color, amsColors.length, availableBrands.length])

    const analyzeFile = async (url: string, fileName: string) => {
        if (!url) {
            setLoading(false)
            setIsUploading(false)
            return
        }

        const isGCode = fileName.toLowerCase().endsWith('.gcode')

        if (isGCode) {
            // Future: Parse G-Code for volume/dimensions
            setParameters({
                volume: 0,
                weight: 0,
                dimensions: { x: 0, y: 0, z: 0 }
            })
            setLoading(false)
            setIsUploading(false)
            return
        }

        try {
            let fetchUrl = url

            // If it's a Supabase path, sign it
            if (!fetchUrl.startsWith('blob:') && !fetchUrl.startsWith('http')) {
                const res = await getCustomerSignedModelUrl(fetchUrl)
                if (res.data) {
                    fetchUrl = res.data
                } else {
                    addToast('Could not access secure model file', 'error')
                    setLoading(false)
                    setIsUploading(false)
                    return
                }
            }

            return new Promise<void>((resolve) => {
                const loader = new STLLoader()
                loader.load(fetchUrl, (loadedGeometry: THREE.BufferGeometry) => {
                    setUploadProgress(100) // Ensure it hits 100 on completion
                    loadedGeometry.center()
                    const density = activeFilament?.density || 1.24
                    const params = analyzeGeometry(loadedGeometry, density)
                    setParameters(params)
                    setGeometry(loadedGeometry)

                    // Use the original File if available for color extraction
                    const fileObj = fileData?.file
                    if (fileObj && fileObj.size > 0) {
                        extractColors(fileObj).then(detectedColors => {
                            if (detectedColors.length > 0) {
                                setAmsColors(detectedColors)
                                setColor(detectedColors[0])
                            }
                        }).catch(() => { })
                    }

                    // Small delay for the user to see 100% before it disappears
                    setTimeout(() => {
                        setLoading(false)
                        setIsUploading(false)
                        resolve()
                    }, 300)
                }, (xhr) => {
                    if (xhr.lengthComputable) {
                        const percent = Math.round((xhr.loaded / xhr.total) * 100)
                        setUploadProgress(percent)
                    }
                }, (err) => {
                    addToast('Error loading 3D model: Connection failed', 'error')
                    setLoading(false)
                    setIsUploading(false)
                    resolve()
                })
            })
        } catch (error) {
            setLoading(false)
            setIsUploading(false)
        }
    }

    useEffect(() => {
        if (parameters) {
            const density = activeFilament?.density || 1.24
            const newWeight = parameters.volume * density
            setParameters({
                ...parameters,
                weight: Math.round(newWeight * 100) / 100
            })
        }
    }, [material])

    const handleRemove = () => {
        if (source === 'cart') {
            router.push('/cart')
        } else {
            if (id) {
                removeFromQueue(id)
            }
            router.push('/upload')
        }
    }



    useEffect(() => {
        if (action === 'checkout' && !hasAutoCheckedOut && fileData && parameters && !isSaving && activeFilament) {
            setHasAutoCheckedOut(true)
            handleSave()
        }
    }, [action, hasAutoCheckedOut, fileData, parameters, isSaving, activeFilament])

    const handleSave = async () => {
        if (!id) {
            addToast('Configuration ID missing. Please go back and try again.', 'error')
            return
        }
        if (!fileData) {
            addToast('File data is still loading...', 'warning')
            return
        }
        if (!parameters) {
            addToast('Model analysis is not complete yet.', 'warning')
            return
        }

        if (!activeFilament) {
            addToast('Please select a material', 'error')
            return
        }



        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            const newItem: CartItem = {
                id: generateUUID(),
                fileName: fileData.file.name,
                fileUrl: persistentUrl || fileData.url,
                material,
                color,
                quantity: Number(quantity) || 1,
                price: detailedPrice ? detailedPrice.totalCost : 0,
                volume: parameters.volume,
                weight: parameters.weight,
                dimensions: parameters.dimensions,
                layerHeight: 0.2,
                infill: infill,
                infillPattern: infillPattern,
                supportType: supportType,
                supportMaterial: supportType !== 'none' ? supportMaterial : undefined,
                brim: brim,
                file: fileData.file,
                brand: selectedBrand,
                amsColors: amsColors,
                amsBrands: amsColors.map(() => selectedBrand)
            }

            // Persistence: Files don't survive refresh in localStorage, save to IndexedDB
            await saveFileToDB(newItem.id, fileData.file);

            await addItem(newItem)
            if (source !== 'cart') {
                removeFromQueue(id)
            }

            addToast('Configuration saved! Please log in to synchronize your cart.', 'info')
            const target = `/login?redirectTo=${encodeURIComponent('/cart')}`;
            router.push(target)
            return
        }

        setIsSaving(true)
        // Show loading state (toast)
        const loadingToastId = addToast('Saving configuration...', 'info', 0)

        try {
            // Upload the file now (only if not already uploaded)
            let persistentFileUrl = persistentUrl || fileData.url

            if (!persistentUrl && fileData.url.startsWith('blob:') && fileData.file) {
                addToast('Uploading model...', 'info', 2000)
                const res = await uploadModelToStorage(fileData.file)
                if (res === 'unauthenticated') {
                    // Not logged in — keep blob URL, cartStore will handle it
                    persistentFileUrl = fileData.url
                } else {
                    persistentFileUrl = res
                    setPersistentUrl(persistentFileUrl)
                }
            }

            if (source === 'cart') {
                // Update existing cart item
                const effectivePricePerGram = (activeFilament as any).colorPricing?.[color] || activeFilament.pricePerGram
                const updates: Partial<CartItem> = {
                    material: material,
                    color: color,
                    quantity: Number(quantity) || 1,
                    price: detailedPrice ? detailedPrice.totalCost : 0,
                    volume: parameters.volume,
                    weight: parameters.weight,
                    dimensions: parameters.dimensions,
                    layerHeight: 0.2,
                    infill: infill,
                    infillPattern: infillPattern,
                    supportType: supportType,
                    supportMaterial: supportMaterial,
                    brim: brim,
                    fileUrl: persistentFileUrl, // Update URL
                    file: persistentFileUrl.startsWith('blob:') ? fileData.file : undefined,
                    brand: selectedBrand, // One brand for the whole item
                    amsColors: amsColors,
                    amsBrands: amsColors.map(() => selectedBrand)
                }
                await updateItem(id, updates)
                addToast('Configuration updated successfully!', 'success')
                removeToast(loadingToastId)
                router.push('/cart')
                return
            } else {
                // Add new item to cart from queue
                const effectivePricePerGram = (activeFilament as any).colorPricing?.[color] || activeFilament.pricePerGram
                const newItem: CartItem = {
                    id: generateUUID(),
                    fileName: fileData.file.name,
                    fileUrl: persistentFileUrl, // Use persistent URL
                    material,
                    color,
                    quantity: Number(quantity) || 1,
                    price: detailedPrice ? detailedPrice.totalCost : 0,
                    volume: parameters.volume,
                    weight: parameters.weight,
                    dimensions: parameters.dimensions,
                    layerHeight: 0.2,
                    infill: infill,
                    infillPattern: infillPattern,
                    supportType: supportType,
                    supportMaterial: supportType !== 'none' ? supportMaterial : undefined,
                    brim: brim, // Add brim
                    file: persistentFileUrl.startsWith('blob:') ? fileData.file : undefined,
                    brand: selectedBrand, // One brand for the whole item
                    amsColors: amsColors,
                    amsBrands: amsColors.map(() => selectedBrand)
                }

                await addItem(newItem)
                addToast('Item added to cart!', 'success')

                // Remove from queue as it is now in cart
                removeFromQueue(id)
                removeToast(loadingToastId)

                setTimeout(() => {
                    router.push('/cart')
                }, 500)
            }
        } catch (error: any) {
            removeToast(loadingToastId)

            const errorMsg = error.message || 'Unknown error'
            if (errorMsg.includes('bucket')) {
                addToast('Storage Error: "prints" bucket not found in Supabase.', 'error')
            } else if (errorMsg.includes('JWT')) {
                addToast('Session Error: Please logout and login again.', 'error')
            } else {
                addToast(`Failed to save: ${errorMsg}`, 'error')
            }
        } finally {
            setIsSaving(false)
        }
    }

    if (!fileData || !hasHydrated) {
        return (
            <div className={styles.container}>
                <div className={styles.loading}>
                    {!hasHydrated ? 'Syncing Settings...' : 'Initializing...'}
                </div>
            </div>
        )
    }


    // Filter out the old hardcoded defaults that might still be in localStorage
    const unwantedDefaults = ['#00f0ff', '#7000ff', '#ff0055', '#333333']
    const displayColors = (activeFilament?.availableColors || []).filter((c: string) => !unwantedDefaults.includes(c))
    // Ensure at least one color is visible if the filter empties it
    const finalColors = displayColors.length > 0 ? displayColors : ['#ffffff']

    // Calculate pricing with support material
    const materialDensity = activeFilament?.density || 0

    const supportEstimate = geometry && parameters
        ? estimateSupportMaterial(geometry, materialDensity)
        : null

    // Calculate detailed pricing
    // const { electricityRate, miscellaneousFee } = useAdminStore() // Moved to top level

    // Note: If support material is present, we adjust the volume used for calculation
    // Logic: Only add support volume if support type is NOT 'none' and we have an estimate
    const supportVol = (supportType !== 'none' && supportEstimate) ? supportEstimate.supportVolume : 0

    // Get color-specific price or use base price
    const effectivePricePerGram = activeFilament ? ((activeFilament as any).colorPricing?.[color] || activeFilament.pricePerGram) : 0

    // Get support material price explicitly mapped globally
    const effectiveSupportPricePerGram = supportMaterialPrice

    // We pass the raw model volume to volumeCm3, and support volume explicitly
    const detailedPrice = parameters ? calculateDetailedPrice({
        volumeCm3: parameters.volume,
        material: material as FilamentKey,
        quantity: Number(quantity) || 1,
        layerHeight: 0.2, // Consistent with other removed options
        infill,
        infillPattern,
        brim,
        pricePerGram: effectivePricePerGram,
        electricityRate: electricityRate,
        miscFee: miscellaneousFee,
        supportVolumeCm3: supportVol,
        supportMaterial: supportMaterial,
        supportPricePerGram: effectiveSupportPricePerGram,
        mainDensity: activeFilament?.density || 0,
        supportDensity: 1.24 // Default PLA equivalent density mapping
    }) : null

    // Format Print Time
    const formatPrintTime = (totalMinutes: number) => {
        const hours = Math.floor(totalMinutes / 60)
        const mins = totalMinutes % 60
        return hours > 0 ? `${hours} Hour ${mins} Minutes` : `${mins} Minutes`
    }
    const estimatedTimeStr = detailedPrice ? formatPrintTime(detailedPrice.printTimeMinutes) : ''

    return (
        <div className={styles.container}>
            {isSaving && <Loader text={source === 'cart' ? 'Updating cart...' : 'Adding to cart...'} />}
            <div className={styles.header}>
                <div className={styles.backWrapper}>
                    <BackButton href={source === 'cart' ? '/cart' : '/upload'} />
                </div>
                <h1 className="title-gradient" style={{ margin: 0 }}>Print Configuration</h1>
            </div>

            <div className={styles.mainGrid}>
                {/* Left Column - Viewer & Parameters */}
                <div className={styles.viewerSection}>
                    {/* Tab Switcher */}
                    {!isUploading && (
                        <div className={styles.tabSwitcher}>
                            <button
                                className={activeTab === 'stl' ? styles.activeTab : styles.tab}
                                onClick={() => setActiveTab('stl')}
                            >
                                3D Preview
                            </button>
                            <button
                                className={styles.tab}
                                disabled
                                style={{ opacity: 0.6, cursor: 'not-allowed', display: 'flex', alignItems: 'center', gap: '8px' }}
                            >
                                G-Code Preview
                                <span style={{ fontSize: '0.65rem', background: '#39ff14', color: 'black', padding: '2px 6px', borderRadius: '4px', fontWeight: 900, textTransform: 'uppercase' }}>Coming Soon</span>
                            </button>
                        </div>
                    )}

                    <div className={styles.viewerContainer}>
                        {isUploading ? (
                            <div className={styles.uploadingContainer}>
                                <div className={styles.printerScene}>
                                    <div className={styles.printBed} />
                                    <div className={styles.modelGhost} />
                                    <div
                                        className={styles.modelProgress}
                                        style={{ height: `${uploadProgress * 1}px` }}
                                    />
                                    <div
                                        className={styles.nozzleAssembly}
                                        style={{ bottom: `${4 + (uploadProgress * 1)}px` }}
                                    >
                                        <div className={styles.gantry} />
                                        <div className={styles.nozzleHead} />
                                    </div>
                                </div>
                                <div className={styles.uploadStats}>
                                    LOADING {uploadProgress}%
                                </div>
                            </div>
                        ) : (
                            <>
                                {activeTab === 'stl' ? (
                                    <STLViewer
                                        url={fileData.url}
                                        geometry={geometry}
                                        color={amsColors[0]}
                                        height={600}
                                        showCrossSection={showCrossSection}
                                        crossSectionHeight={crossSectionHeight}
                                        crossSectionAxis={crossSectionAxis}
                                        autoRotate={autoRotate}
                                        wireframe={showWireframe}
                                        estimatedTime={estimatedTimeStr}
                                        urlResolver={getCustomerSignedModelUrl}
                                    />
                                ) : (
                                    <GCodeViewer
                                        gcodeUrl={fileData.url}
                                        height={600}
                                        urlResolver={getCustomerSignedModelUrl}
                                    />
                                )}
                                <button className={styles.removeBtn} onClick={handleRemove}>
                                    <Trash2 size={20} />
                                </button>
                            </>
                        )}
                    </div>

                    {/* File Info */}
                    {!isUploading && parameters && (
                        <div className={styles.parametersGrid}>
                            <div className={`${styles.paramCard} ${styles.fileInfoCard}`}>
                                <div className={styles.paramLabel}>File Information</div>
                                <div className={styles.fileInfo}>
                                    <div className={styles.fileName}>{fileData.file?.name || 'model.stl'}</div>
                                    <div className={styles.fileSize}>{fileData.file?.size ? formatFileSize(fileData.file.size) : '—'}</div>
                                </div>
                            </div>

                            {/* Dimensions */}
                            <div className={styles.paramCard}>
                                <div className={styles.paramLabel}>Dimensions (mm)</div>
                                <div className={styles.paramValue}>
                                    {parameters.dimensions.x} × {parameters.dimensions.y} × {parameters.dimensions.z}
                                </div>
                            </div>

                            {/* Volume */}
                            <div className={styles.paramCard}>
                                <div className={styles.paramLabel}>Volume</div>
                                <div className={styles.paramValue}>
                                    {parameters.volume}
                                    <span className={styles.paramUnit}>cm³</span>
                                </div>
                            </div>

                            {/* Weight */}
                            <div className={styles.paramCard}>
                                <div className={styles.paramLabel}>Weight ({material})</div>
                                <div className={styles.paramValue}>
                                    {(detailedPrice?.mainWeightGrams || parameters.weight).toFixed(1)}
                                    <span className={styles.paramUnit}>g</span>
                                </div>
                            </div>

                            {/* Layers */}
                            <div className={styles.paramCard}>
                                <div className={styles.paramLabel}>Total Layers</div>
                                <div className={styles.paramValue}>
                                    {Math.ceil(parameters.dimensions.z / 0.2)}
                                    <span className={styles.paramUnit}>Layers</span>
                                </div>
                            </div>

                            {/* Estimated Time */}
                            <div className={styles.paramCard}>
                                <div className={styles.paramLabel}>Estimated Print Time</div>
                                <div className={styles.paramValue}>
                                    {estimatedTimeStr}
                                </div>
                            </div>

                            {/* Estimated Support Material */}
                            {detailedPrice && detailedPrice.supportWeightGrams > 0 && (
                                <div className={styles.paramCard}>
                                    <div className={styles.paramLabel}>Estimated Support Mat.</div>
                                    <div className={styles.paramValue}>
                                        {detailedPrice.supportWeightGrams.toFixed(1)}
                                        <span className={styles.paramUnit}>g</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                </div>

                {/* Right Column - Configuration */}
                <div className={styles.configSection}>
                    {/* Material Selection */}
                    <div className={styles.controlGroup}>
                        <CustomSelect
                            label="Material"
                            value={material}
                            options={materialTypes.map(t => ({ value: t.name, label: t.name }))}
                            onChange={(val) => {
                                const newMaterial = val as FilamentKey;
                                setMaterial(newMaterial);
                                if (!materialTypes.some(mt => mt.name === newMaterial)) {
                                    setMaterial(materialTypes[0]?.name as FilamentKey || 'PLA');
                                }
                            }}
                            disabled={isUploading}
                        />
                        <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                            <button
                                className={`${styles.greenBtn} ${showMaterialDetails ? styles.active : ''}`}
                                onClick={() => setShowMaterialDetails(!showMaterialDetails)}
                                type="button"
                            >
                                {showMaterialDetails ? 'Hide Details' : 'Details'}
                            </button>
                            <button
                                className={`${styles.greenBtn} ${showComparison ? styles.active : ''}`}
                                onClick={() => {
                                    setShowComparison(!showComparison);
                                    if (!showComparison) {
                                        setTimeout(() => {
                                            document.getElementById('comparison-section')?.scrollIntoView({ behavior: 'smooth' });
                                        }, 100);
                                    }
                                }}
                                type="button"
                            >
                                {showComparison ? 'Comparison' : 'Compare'}
                            </button>
                        </div>
                        {!isUploading && !showComparison && showMaterialDetails && (
                            <MaterialChart material={material} showTitle={false} />
                        )}
                    </div>

                    {/* AMS Color Picker */}
                    <div className={styles.categoryTitle}>AMS slots (Max 4)</div>
                    <div className={styles.amsGrid}>
                        {amsColors.map((c, i) => (
                            <div
                                key={i}
                                className={`${styles.amsSlot} ${amsActiveIndex === i ? styles.amsSlotActive : ''}`}
                                onClick={() => setAmsActiveIndex(i)}
                            >
                                <div
                                    className={styles.amsColorDisplay}
                                    style={{ backgroundColor: c }}
                                />
                                {amsColors.length > 1 && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const newColors = amsColors.filter((_, idx) => idx !== i);
                                            setAmsColors(newColors);
                                            if (amsActiveIndex >= newColors.length) setAmsActiveIndex(newColors.length - 1);
                                        }}
                                        className={styles.amsRemove}
                                    >
                                        <Minus size={12} />
                                    </button>
                                )}
                            </div>
                        ))}
                        {amsColors.length < 4 && amsColors.length < availableColorsCount && (
                            <button
                                onClick={() => {
                                    // Find the first color from this brand that isn't already used in any AMS slots
                                    const availableForBrand = activeFilamentData?.availableColors || [];
                                    const nextColor = availableForBrand.find((c: string) => !amsColors.includes(c)) || (availableForBrand[0] || '#ffffff');

                                    const newColors = [...amsColors, nextColor];
                                    setAmsColors(newColors);
                                    setAmsActiveIndex(newColors.length - 1);
                                }}
                                className={styles.amsAdd}
                            >
                                <Plus size={16} />
                            </button>
                        )}
                    </div>


                    <div className={styles.categoryTitle} style={{ marginTop: '16px', marginBottom: '8px' }}>Available spools ({material})</div>

                    {availableBrands.length === 0 ? (
                        <div className={styles.warningBanner}>
                            No filaments available right now for {material}
                        </div>
                    ) : (
                        <div style={{
                            background: 'rgba(255,255,255,0.03)',
                            padding: '8px',
                            borderRadius: '16px',
                            border: '1px solid rgba(255,255,255,0.08)',
                            marginTop: '0px'
                        }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', alignItems: 'start' }}>
                                {/* Shared Header Row for perfect alignment */}
                                <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0px', paddingBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    Brand
                                </div>
                                <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0px', paddingBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    Colors ({displayBrand})
                                </div>

                                <div className={styles.controlGroup} style={{ marginBottom: 0 }}>
                                    <CustomSelect
                                        value={displayBrand}
                                        options={availableBrands.map(b => ({ value: b, label: b }))}
                                        onChange={(val) => {
                                            setSelectedBrand(val)
                                            // Reset AMS slots to single color if multiple were selected
                                            if (amsColors.length > 1) {
                                                setAmsColors([amsColors[0]])
                                                setAmsActiveIndex(0)
                                            }
                                        }}
                                    />
                                </div>
                                <div className={styles.brandGroups} style={{ gridTemplateColumns: '1fr', gap: '0' }}>
                                    {Object.entries(adminFilaments)
                                        .filter(([_, f]) => f.type === material && (f.brand || _) === displayBrand)
                                        .map(([key, f]) => (
                                            <div key={key} className={styles.brandGroup}>
                                                <div className={styles.colorPresets} style={{ marginTop: 0 }}>
                                                    {(f.availableColors || []).map((c) => (
                                                        <button
                                                            key={c}
                                                            className={`${styles.colorChip} ${amsColors[amsActiveIndex] === c ? styles.active : ''}`}
                                                            style={{
                                                                backgroundColor: c,
                                                                width: '32px',
                                                                height: '32px',
                                                                borderRadius: '8px',
                                                                border: amsColors.includes(c) ? '2px solid white' : '1px solid rgba(255,255,255,0.1)',
                                                                boxShadow: amsColors[amsActiveIndex] === c ? '0 0 10px white' : 'none'
                                                            }}
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                const existingSlotIdx = amsColors.findIndex((used, idx) => used === c && idx !== amsActiveIndex);

                                                                const newColors = [...amsColors];
                                                                if (existingSlotIdx !== -1) {
                                                                    // SWAP: Put current slot's color into the other slot
                                                                    const currentColor = amsColors[amsActiveIndex];
                                                                    newColors[existingSlotIdx] = currentColor;
                                                                    addToast('Colors swapped between slots', 'info');
                                                                }

                                                                newColors[amsActiveIndex] = c;
                                                                setAmsColors(newColors);
                                                                if (amsActiveIndex === 0) setColor(c);
                                                                if (existingSlotIdx === 0) {
                                                                    // If we just swapped the "main" color to a different slot, 
                                                                    // the main color state needs to follow the new Slot 0 color.
                                                                    setColor(newColors[0]);
                                                                }
                                                            }}
                                                            title={`${f.brand} - ${c}`}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        </div>
                    )}

                    <div style={{ marginBottom: '16px' }}></div>

                    {/* Cross Section Controls */}
                    <div className={styles.controlGroup}>
                        <div className={styles.categoryTitle} style={{ marginTop: 0 }}>Cross section & visibility</div>
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', width: '100%' }}>
                            <button
                                className={`${styles.toggle} ${showCrossSection ? styles.active : ''}`}
                                onClick={() => setShowCrossSection(!showCrossSection)}
                                style={{ flex: 1, padding: '8px 0', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 600 }}
                            >
                                <Scissors size={14} /> {showCrossSection ? 'Cross' : 'None'}
                            </button>
                            <button
                                className={`${styles.toggle} ${autoRotate ? styles.active : ''}`}
                                onClick={() => setAutoRotate(!autoRotate)}
                                type="button"
                                style={{ flex: 1, padding: '8px 0', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 600 }}
                            >
                                Rotate
                            </button>
                            <button
                                className={`${styles.toggle} ${showWireframe ? styles.active : ''}`}
                                onClick={() => setShowWireframe(!showWireframe)}
                                type="button"
                                style={{ flex: 1, padding: '8px 0', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 600 }}
                            >
                                Mesh
                            </button>
                        </div>
                        {showCrossSection && (
                            <div style={{ marginTop: '12px', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '12px' }}>
                                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                                    {(['x', 'y', 'z'] as const).map(axis => (
                                        <button
                                            key={axis}
                                            type="button"
                                            className={`${styles.toggle} ${crossSectionAxis === axis ? styles.active : ''}`}
                                            onClick={() => setCrossSectionAxis(axis)}
                                            style={{ flex: 1, padding: '6px 0', fontSize: '0.75rem', textTransform: 'uppercase', justifyContent: 'center', letterSpacing: '0.5px' }}
                                        >
                                            {axis}-Axis
                                        </button>
                                    ))}
                                </div>
                                <div className={styles.sliderContainer}>
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={crossSectionHeight}
                                        onChange={(e) => setCrossSectionHeight(parseInt(e.target.value))}
                                        className={styles.slider}
                                    />
                                    <span className={styles.sliderValue}>{crossSectionHeight}%</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className={styles.multiControlRow} style={{ alignItems: 'start' }}>
                        {/* Support Type */}
                        <div>
                            <CustomSelect
                                label="Support"
                                value={supportType}
                                options={supportTypes.map(t => ({ value: t.toLowerCase(), label: t }))}
                                onChange={(val) => setSupportType(val)}
                            />
                        </div>

                        {/* Infill Pattern */}
                        <div>
                            <CustomSelect
                                label="Infill Pattern"
                                value={infillPattern}
                                options={[
                                    { value: 'grid', label: 'Grid' },
                                    { value: 'gyroid', label: 'Gyroid' },
                                    { value: 'cubic', label: 'Cubic' },
                                    { value: 'lines', label: 'Lines' }
                                ]}
                                onChange={(val) => setInfillPattern(val)}
                            />
                        </div>

                        {/* Infill (%) */}
                        <div className={styles.controlGroup}>
                            <label>Infill (%)</label>
                            <div className={styles.quantity}>
                                <button onClick={() => setInfill(Math.max(10, infill - 10))} className={styles.qBtn} type="button">
                                    <Minus size={14} />
                                </button>
                                <span>{infill}%</span>
                                <button onClick={() => setInfill(Math.min(100, infill + 10))} className={styles.qBtn} type="button">
                                    <Plus size={14} />
                                </button>
                            </div>
                        </div>

                        {/* Quantity */}
                        <div className={styles.controlGroup}>
                            <label>Quantity</label>
                            <div className={styles.quantity}>
                                <button onClick={() => setQuantity(Math.max(1, (Number(quantity) || 1) - 1))} className={styles.qBtn} type="button">
                                    <Minus size={14} />
                                </button>
                                <input
                                    type="number"
                                    min="1"
                                    value={quantity}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setQuantity(val === '' ? '' : parseInt(val, 10));
                                    }}
                                    onBlur={() => {
                                        if (quantity === '' || Number(quantity) < 1 || isNaN(Number(quantity))) setQuantity(1);
                                    }}
                                    className={styles.hideArrows}
                                    style={{ width: '46px', textAlign: 'center', background: 'transparent', border: 'none', color: 'white', fontSize: '1rem', outline: 'none' }}
                                />
                                <button onClick={() => setQuantity((Number(quantity) || 1) + 1)} className={styles.qBtn} type="button">
                                    <Plus size={14} />
                                </button>
                            </div>
                        </div>

                    </div>

                    {/* Brim */}
                    <div className={styles.controlGroup}>
                        <label>Brim Support</label>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                            <button
                                onClick={() => setBrim(true)}
                                type="button"
                                className={`${styles.toggle} ${brim ? styles.active : ''}`}
                                style={{ flex: 1, padding: '8px 0', fontSize: '0.85rem', justifyContent: 'center', fontWeight: 600 }}
                            >
                                Yes
                            </button>
                            <button
                                onClick={() => setBrim(false)}
                                type="button"
                                className={`${styles.toggle} ${!brim ? styles.active : ''}`}
                                style={{ flex: 1, padding: '8px 0', fontSize: '0.85rem', justifyContent: 'center', fontWeight: 600 }}
                            >
                                No
                            </button>
                        </div>
                    </div>

                    {/* Price Section */}
                    {!isUploading && detailedPrice && (
                        <div className={styles.priceSection}>
                            <div className={styles.priceRow}>
                                <span>Model:</span>
                                <span>{availableBrands.length === 0 || !color ? '-' : formatCurrency(detailedPrice.mainMaterialCost)}</span>
                            </div>
                            {detailedPrice.supportWeightGrams > 0 && detailedPrice.supportMaterialCost > 0 && (
                                <div className={styles.priceRow}>
                                    <span>Support:</span>
                                    <span>{availableBrands.length === 0 || !color ? '-' : formatCurrency(detailedPrice.supportMaterialCost)}</span>
                                </div>
                            )}
                            <div className={styles.priceRow}>
                                <span>Printing Cost:</span>
                                <span>{availableBrands.length === 0 || !color ? '-' : formatCurrency(detailedPrice.printCost)}</span>
                            </div>
                            <div className={styles.priceRow}>
                                <span>Setup & Misc:</span>
                                <span>{availableBrands.length === 0 || !color ? '-' : formatCurrency(detailedPrice.setupCost)}</span>
                            </div>
                            <div className={styles.priceRow} style={{ marginTop: '16px' }}>
                                <span style={{ fontSize: '18px', fontWeight: '600', color: 'white' }}>Total:</span>
                                <span className={styles.price}>
                                    {quantity > 1 ? (
                                        <span style={{ fontSize: '14px', opacity: 0.8, marginRight: '8px', fontWeight: 'normal' }}>
                                            {formatCurrency(detailedPrice.unitCost)} x {quantity} =
                                        </span>
                                    ) : null}
                                    {availableBrands.length === 0 || !color ? '-' : formatCurrency(detailedPrice.totalCost)}
                                </span>
                            </div>

                            <button
                                className={`btn ${styles.addToCartBtn}`}
                                onClick={handleSave}
                                disabled={isSaving || loading || isUploading || !parameters || availableBrands.length === 0 || !color}
                                style={{
                                    opacity: (availableBrands.length === 0 || !color || loading || isUploading || !parameters) ? 0.5 : 1
                                }}
                            >
                                {isSaving ? (
                                    <>Processing... <Clock size={18} className={styles.spin} style={{ marginLeft: 8 }} /></>
                                ) : source === 'cart' ? (
                                    <>Save Changes <Save size={18} style={{ marginLeft: 8 }} /></>
                                ) : (
                                    <>Add to Cart <ShoppingCart size={18} style={{ marginLeft: 8 }} /></>
                                )}
                            </button>

                            {(availableBrands.length === 0 || !color) && (
                                <p style={{ color: '#ff4444', fontSize: '12px', marginTop: '12px', textAlign: 'center', fontWeight: '500' }}>
                                    Please select available filaments to proceed
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Comparison Chart */}
            {
                showComparison && (
                    <div id="comparison-section" className={styles.largeComparison}>
                        <h2 className={styles.comparisonTitle}>Material properties comparison</h2>
                        <div className={styles.comparisonGrid}>
                            {(materialTypes || []).map((type) => (
                                <div key={type.name} className={styles.comparisonCard}>
                                    <MaterialChart material={type.name as FilamentKey} showTitle={true} />
                                </div>
                            ))}
                        </div>
                    </div>
                )
            }
        </div >
    )

}

export default function ConfigurePage() {
    return (
        <Suspense fallback={<div className={styles.loading}>Loading configuration...</div>}>
            <ConfigureContent />
        </Suspense>
    )
}
