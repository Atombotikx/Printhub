'use client'
import { useState, useRef, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import styles from './AdminSTL.module.css'
import STLViewer from '@/components/STLViewer'
import { Upload, Box } from 'lucide-react'
import { useToastStore } from '@/store/toastStore'
import { getSignedModelUrl } from '@/app/admin/actions'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { User } from '@supabase/supabase-js'
import Loader from '@/components/Loader'

function AdminSTLViewer() {
    const searchParams = useSearchParams()
    const urlParam = searchParams.get('url')
    const nameParam = searchParams.get('name')

    const [fileUrl, setFileUrl] = useState<string | null>(urlParam || null)
    const [fileName, setFileName] = useState<string>(nameParam || (urlParam ? urlParam.split('/').pop() || 'model.stl' : ''))
    const fileInputRef = useRef<HTMLInputElement>(null)
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [user, setUser] = useState<User | null>(null)

    useEffect(() => {
        const checkUser = async () => {
            const { isCurrentUserAdmin } = await import('@/app/admin/actions')
            const isAdmin = await isCurrentUserAdmin()

            if (!isAdmin) {
                router.push('/')
                return
            }

            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            setUser(user)
            setLoading(false)
        }
        checkUser()
    }, [router])

    // If url param changes re-load
    useEffect(() => {
        if (urlParam) {
            setFileUrl(urlParam)
            setFileName(nameParam || urlParam.split('/').pop() || 'model.stl')
        }
    }, [urlParam, nameParam])

    // Viewer Controls
    const [color, setColor] = useState('#ffffff')
    const [wireframe, setWireframe] = useState(false)
    const [opacity, setOpacity] = useState(1)
    const [crossSection, setCrossSection] = useState(false)
    const [crossSectionHeight, setCrossSectionHeight] = useState(50)
    const [crossSectionAxis, setCrossSectionAxis] = useState<'x' | 'y' | 'z'>('y')
    const [autoRotate, setAutoRotate] = useState(true)
    const [showAxes, setShowAxes] = useState(false)

    if (loading) return <Loader text="Checking permissions..." />

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0]
            if (selectedFile.name.toLowerCase().endsWith('.stl')) {
                const url = URL.createObjectURL(selectedFile)
                setFileUrl(url)
                setFileName(selectedFile.name)
            } else {
                useToastStore.getState().addToast('Please upload a .stl file', 'error')
            }
        }
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1 className="title-gradient">Admin STL viewer</h1>
                <p className={styles.subtitle}>Quickly inspect STL files</p>
            </div>

            <div className={`${styles.contentGrid} ${fileUrl ? styles.withSidebar : ''}`}>
                <div className={styles.viewerWrapper}>
                    {!fileUrl ? (
                        <div
                            className={styles.uploadZone}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                accept=".stl"
                                hidden
                            />
                            <Upload size={48} className={styles.uploadIcon} />
                            <h3>Drop STL file here</h3>
                            <p>or click to browse</p>
                        </div>
                    ) : (
                        <div className={styles.viewerContent}>
                            <div className={styles.toolbar}>
                                <div className={styles.fileInfo}>
                                    <Box size={20} />
                                    <span>{fileName}</span>
                                </div>
                                <button
                                    onClick={() => { setFileUrl(null); setFileName(''); }}
                                    className={styles.changeBtn}
                                >
                                    Change file
                                </button>
                            </div>
                            <STLViewer
                                url={fileUrl}
                                height={600}
                                color={color}
                                wireframe={wireframe}
                                opacity={opacity}
                                showCrossSection={crossSection}
                                crossSectionHeight={crossSectionHeight}
                                crossSectionAxis={crossSectionAxis}
                                autoRotate={autoRotate}
                                showAxes={showAxes}
                                showLoader={true}
                                urlResolver={getSignedModelUrl}
                            />
                        </div>
                    )}
                </div>

                {/* Controls Sidebar */}
                {fileUrl && (
                    <div className={styles.controlsSidebar}>
                        <h3>Viewer options</h3>

                        <div className={styles.controlGroup}>
                            <label>Model color</label>
                            <div className={styles.colorPickerWrapper}>
                                <input
                                    type="color"
                                    value={color}
                                    onChange={(e) => setColor(e.target.value)}
                                    className={styles.colorInput}
                                />
                                <span className={styles.colorValue}>{color.toUpperCase()}</span>
                            </div>
                        </div>

                        <div className={styles.controlGroup}>
                            <div className={styles.checkboxWrapper} onClick={() => setWireframe(!wireframe)}>
                                <input
                                    type="checkbox"
                                    id="wireframe"
                                    checked={wireframe}
                                    onChange={(e) => setWireframe(e.target.checked)}
                                    onClick={(e) => e.stopPropagation()}
                                />
                                <div className={styles.customCheckbox} />
                                <label htmlFor="wireframe">Mesh view (wireframe)</label>
                            </div>
                        </div>

                        <div className={styles.controlGroup}>
                            <label>Opacity ({Math.round(opacity * 100)}%)</label>
                            <input
                                type="range"
                                min="0.1"
                                max="1"
                                step="0.1"
                                value={opacity}
                                onChange={(e) => setOpacity(parseFloat(e.target.value))}
                                className={styles.rangeInput}
                            />
                        </div>

                        <div className={styles.divider} />

                        <div className={styles.controlGroup}>
                            <div className={styles.checkboxWrapper} onClick={() => setCrossSection(!crossSection)}>
                                <input
                                    type="checkbox"
                                    id="crossSection"
                                    checked={crossSection}
                                    onChange={(e) => setCrossSection(e.target.checked)}
                                    onClick={(e) => e.stopPropagation()}
                                />
                                <div className={styles.customCheckbox} />
                                <label htmlFor="crossSection">Enable cross-section</label>
                            </div>
                        </div>

                        <div className={styles.controlGroup}>
                            <div className={styles.checkboxWrapper} onClick={() => setAutoRotate(!autoRotate)}>
                                <input
                                    type="checkbox"
                                    id="autoRotate"
                                    checked={autoRotate}
                                    onChange={(e) => setAutoRotate(e.target.checked)}
                                    onClick={(e) => e.stopPropagation()}
                                />
                                <div className={styles.customCheckbox} />
                                <label htmlFor="autoRotate">Auto-rotate view</label>
                            </div>
                        </div>

                        <div className={styles.controlGroup}>
                            <div className={styles.checkboxWrapper} onClick={() => setShowAxes(!showAxes)}>
                                <input
                                    type="checkbox"
                                    id="showAxes"
                                    checked={showAxes}
                                    onChange={(e) => setShowAxes(e.target.checked)}
                                    onClick={(e) => e.stopPropagation()}
                                />
                                <div className={styles.customCheckbox} />
                                <label htmlFor="showAxes">Show 3D axes</label>
                            </div>
                        </div>

                        {crossSection && (
                            <div className={styles.controlGroup}>
                                <label>Cut axis</label>
                                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                                    {(['x', 'y', 'z'] as const).map(axis => (
                                        <button
                                            key={axis}
                                            type="button"
                                            onClick={() => setCrossSectionAxis(axis)}
                                            style={{
                                                flex: 1, padding: '4px 0', fontSize: '0.8rem', textTransform: 'uppercase',
                                                background: crossSectionAxis === axis ? 'var(--primary-color)' : 'rgba(255,255,255,0.05)',
                                                color: crossSectionAxis === axis ? 'black' : 'white',
                                                border: crossSectionAxis === axis ? '1px solid var(--primary-color)' : '1px solid rgba(255,255,255,0.1)',
                                                borderRadius: '6px', cursor: 'pointer'
                                            }}
                                        >
                                            {axis}
                                        </button>
                                    ))}
                                </div>
                                <label>Slice height ({crossSectionHeight}%)</label>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={crossSectionHeight}
                                    onChange={(e) => setCrossSectionHeight(parseInt(e.target.value))}
                                    className={styles.rangeInput}
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

export default function AdminSTLPage() {
    return (
        <Suspense fallback={<Loader text="Loading viewer..." />}>
            <AdminSTLViewer />
        </Suspense>
    )
}
