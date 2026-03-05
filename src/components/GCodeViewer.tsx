'use client'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls, GCodeLoader } from 'three-stdlib'
import styles from './GCodeViewer.module.css'
import Loader from './Loader'

interface GCodeViewerProps {
    gcodeUrl?: string
    gcodeContent?: string
    height?: number
    urlResolver?: (path: string) => Promise<{ data: string | null; error: string | null }>
}

export default function GCodeViewer({ gcodeUrl, gcodeContent, height = 600, urlResolver }: GCodeViewerProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const [loading, setLoading] = useState(true)
    const [loadingProgress, setLoadingProgress] = useState(0)
    const [error, setError] = useState<string | null>(null)

    // Feature States
    const [progress, setProgress] = useState(100)
    const [showGrid, setShowGrid] = useState(true)
    const [showAxes, setShowAxes] = useState(true)
    const [autoRotate, setAutoRotate] = useState(false)
    const [isPlaying, setIsPlaying] = useState(false)
    const [playbackSpeed, setPlaybackSpeed] = useState(1.0)
    const [detectedColors, setDetectedColors] = useState<string[]>([])
    const [userColors, setUserColors] = useState<Record<string, string>>({}) // Map original hex -> new hex

    // Refs for accessing Three.js objects
    const sceneRef = useRef<THREE.Scene | null>(null)
    const gridRef = useRef<THREE.GridHelper | null>(null)
    const axesRef = useRef<THREE.AxesHelper | null>(null)
    const controlsRef = useRef<OrbitControls | null>(null)
    const initialCameraPosition = useRef<THREE.Vector3 | null>(null)

    // Playback refs
    const nozzleRef = useRef<THREE.Mesh | THREE.Group | null>(null)
    const gantryRef = useRef<THREE.Group | null>(null)
    const mergedLineRef = useRef<THREE.LineSegments | null>(null)
    const totalPointsRef = useRef<number>(0)
    const pointsArrayRef = useRef<Float32Array | null>(null)

    // Data cache to avoid re-parsing G-code when just colors change
    const gcodeDataRef = useRef<{
        positions: Float32Array;
        nativeColors: string[];
    } | null>(null)
    const resolvingRef = useRef(false)

    // EFFECT 1: Base Scene Infrastructure
    useEffect(() => {
        if (!containerRef.current) return
        const container = containerRef.current

        // Cleanup
        while (container.firstChild) container.removeChild(container.firstChild)

        const scene = new THREE.Scene()
        sceneRef.current = scene

        // 1. Isaac Sim Floor-Centric Environment
        scene.background = new THREE.Color('#0a111a') // Dark Navy blue-gray
        scene.fog = new THREE.Fog('#0a111a', 5000, 30000)
        sceneRef.current = scene

        // Reflective Ground Plane
        const groundGeo = new THREE.PlaneGeometry(30000, 30000)
        const groundMat = new THREE.MeshStandardMaterial({
            color: 0x1a2b3c,
            metalness: 0.8,
            roughness: 0.2
        })
        const ground = new THREE.Mesh(groundGeo, groundMat)
        ground.rotation.x = -Math.PI / 2
        ground.position.y = 0
        scene.add(ground)

        // Prominent Grid at Y=0
        const grid = new THREE.GridHelper(20000, 40, 0xffffff, 0x445566)
        grid.position.y = 0.1
        // @ts-ignore
        grid.material.opacity = 0.35
        // @ts-ignore
        grid.material.transparent = true
        scene.add(grid)
        gridRef.current = grid

        // Axes at Y=0
        const axes = new THREE.AxesHelper(1000)
        axes.position.y = 0.2
        scene.add(axes)
        axesRef.current = axes

        // Soft Contact Shadow Mesh at Y=0
        const shadowCanvas = document.createElement('canvas')
        shadowCanvas.width = 512; shadowCanvas.height = 512
        const sCtx = shadowCanvas.getContext('2d')
        if (sCtx) {
            const rad = sCtx.createRadialGradient(256, 256, 0, 256, 256, 256)
            rad.addColorStop(0, 'rgba(0, 0, 0, 0.4)')
            rad.addColorStop(0.5, 'rgba(10, 17, 26, 0.1)')
            rad.addColorStop(1, 'rgba(0, 0, 0, 0)')
            sCtx.fillStyle = rad
            sCtx.fillRect(0, 0, 512, 512)
            const shadowTex = new THREE.CanvasTexture(shadowCanvas)
            const shadowMesh = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true }))
            shadowMesh.rotation.x = -Math.PI / 2
            shadowMesh.position.y = 0.2
            scene.add(shadowMesh)
        }

        const camera = new THREE.PerspectiveCamera(50, container.clientWidth / height, 1, 100000)
        camera.position.set(600, 500, 600)

        const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true })
        renderer.setSize(container.clientWidth, height)
        renderer.setPixelRatio(window.devicePixelRatio)
        renderer.toneMapping = THREE.ACESFilmicToneMapping
        renderer.toneMappingExposure = 1.3
        container.appendChild(renderer.domElement)

        const controls = new OrbitControls(camera, renderer.domElement)
        controlsRef.current = controls
        controls.enableDamping = true
        controls.dampingFactor = 0.05
        controls.minDistance = 0.1 // Allowed extreme zoom-in to see layers
        controls.maxDistance = 3000 // UX: Prevent object from becoming a tiny speck

        // 2. High-Visibility Studio Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
        scene.add(ambientLight)

        const hemiLight = new THREE.HemisphereLight(0xabcfff, 0x111111, 0.8)
        scene.add(hemiLight)

        const topLight = new THREE.DirectionalLight(0xffffff, 1.3)
        topLight.position.set(500, 3000, 1000)
        scene.add(topLight)

        const fillLight = new THREE.DirectionalLight(0xffffff, 0.6)
        fillLight.position.set(-500, 3000, -1000)
        scene.add(fillLight)

        const highlightLight = new THREE.PointLight(0xffffff, 3.0, 4000)
        highlightLight.position.set(-800, 1000, 800)
        scene.add(highlightLight)

        // --- 3. Modernized Printer Head (Sleek & Curved) ---
        const gantry = new THREE.Group()
        scene.add(gantry)
        gantryRef.current = gantry

        const extruderGroup = new THREE.Group()

        // Nozzle & Heater Assembly
        const brassMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 1, roughness: 0.1 })
        const chromeMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, metalness: 1, roughness: 0.05 })

        const nozzleTip = new THREE.Mesh(new THREE.ConeGeometry(0.8, 3, 32), brassMat)
        nozzleTip.rotation.x = Math.PI
        nozzleTip.position.y = 0
        extruderGroup.add(nozzleTip)

        const heater = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 6, 32), chromeMat)
        heater.position.y = 4.5
        extruderGroup.add(heater)

        // Futuristic Curved Housing
        const modernShroudMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.8, roughness: 0.2 })
        const coreHousing = new THREE.Mesh(new THREE.CapsuleGeometry(16, 12, 16, 32), modernShroudMat)
        coreHousing.position.y = 22
        extruderGroup.add(coreHousing)

        // Glowing Teal Status Ring
        const ringGeo = new THREE.TorusGeometry(16, 1.2, 16, 64)
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x00f2ff })
        const glowRing = new THREE.Mesh(ringGeo, ringMat)
        glowRing.rotation.x = Math.PI / 2
        glowRing.position.y = 18
        extruderGroup.add(glowRing)

        const statusLight = new THREE.PointLight(0x00f2ff, 1.5, 40)
        statusLight.position.y = 18
        extruderGroup.add(statusLight)

        // Aerodynamic Red Cover
        const sleekRedMat = new THREE.MeshStandardMaterial({ color: 0xdd0000, metalness: 0.9, roughness: 0.1 })
        const redShell = new THREE.Mesh(new THREE.SphereGeometry(14, 32, 32, 0, Math.PI * 2, 0, Math.PI / 1.5), sleekRedMat)
        redShell.position.y = 38
        redShell.rotation.x = Math.PI
        extruderGroup.add(redShell)

        // Rounded Side Profile
        const sideHull = new THREE.Mesh(new THREE.CapsuleGeometry(8, 12, 16, 20), modernShroudMat)
        sideHull.position.set(-18, 30, 0)
        sideHull.rotation.z = Math.PI / 6
        extruderGroup.add(sideHull)

        // Toolhead Work Light
        const toolLight = new THREE.PointLight(0xffffff, 2, 60)
        toolLight.position.y = 2
        extruderGroup.add(toolLight)

        // Initial Position: Home (Elevated and to the side)
        extruderGroup.position.set(-200, 250, -200)

        gantry.add(extruderGroup)
        nozzleRef.current = extruderGroup

        // Animation
        let animationId: number
        const animate = () => {
            animationId = requestAnimationFrame(animate)
            controls.update()
            renderer.render(scene, camera)
        }
        animate()

        const handleResize = () => {
            camera.aspect = container.clientWidth / height
            camera.updateProjectionMatrix()
            renderer.setSize(container.clientWidth, height)
        }
        window.addEventListener('resize', handleResize)

        return () => {
            window.removeEventListener('resize', handleResize)
            cancelAnimationFrame(animationId)
            if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement)
            controls.dispose()
        }
    }, [height])

    // EFFECT 2: Parsing G-code
    useEffect(() => {
        if (!sceneRef.current) return
        const loader = new GCodeLoader()

        const parseGCode = async () => {
            if (resolvingRef.current) return
            resolvingRef.current = true
            try {
                setLoading(true)
                let object: THREE.Group
                if (gcodeContent) {
                    const blob = new Blob([gcodeContent], { type: 'text/plain' })
                    const url = URL.createObjectURL(blob)
                    object = await new Promise<THREE.Group>((resolve, reject) => {
                        loader.load(url,
                            (obj) => resolve(obj),
                            (xhr) => {
                                if (xhr.lengthComputable) {
                                    setLoadingProgress(Math.round((xhr.loaded / xhr.total) * 100))
                                }
                            },
                            (err) => reject(err)
                        )
                    })
                    URL.revokeObjectURL(url)
                } else if (gcodeUrl) {
                    let finalUrl = gcodeUrl
                    if (!finalUrl.startsWith('blob:') && !finalUrl.startsWith('http')) {
                        if (urlResolver) {
                            const res = await urlResolver(finalUrl)
                            if (res.data) {
                                finalUrl = res.data
                            } else {
                                console.error('GCodeViewer: Resource signing failed:', res.error)
                                setError(`Access Denied: ${res.error || 'Private file'}`)
                                setLoading(false)
                                resolvingRef.current = false
                                return
                            }
                        } else {
                            setError('No URL resolver provided for storage path')
                            setLoading(false)
                            resolvingRef.current = false
                            return
                        }
                    }
                    object = await new Promise<THREE.Group>((resolve, reject) => {
                        loader.load(finalUrl,
                            (obj) => resolve(obj),
                            (xhr) => {
                                if (xhr.lengthComputable) {
                                    setLoadingProgress(Math.round((xhr.loaded / xhr.total) * 100))
                                }
                            },
                            (err) => reject(err)
                        )
                    })
                } else {
                    setLoading(false)
                    resolvingRef.current = false
                    return
                }

                const positions: number[] = []
                const nativeColors: string[] = []
                const uniqueColors = new Set<string>()

                const box = new THREE.Box3().setFromObject(object)
                const center = box.getCenter(new THREE.Vector3())

                object.traverse((child) => {
                    if (child instanceof THREE.Line) {
                        const geometry = child.geometry as THREE.BufferGeometry
                        const pos = geometry.attributes.position
                        const color = (child.material as THREE.LineBasicMaterial).color
                        const hex = `#${color.getHexString()}`
                        uniqueColors.add(hex)

                        for (let i = 0; i < pos.count; i++) {
                            // Map G-code (X, Y, Z) to Three.js (X, Z, Y) 
                            // where Y is UP, and G-code Z is the height.
                            positions.push(
                                pos.getX(i) - center.x,
                                pos.getZ(i),
                                pos.getY(i) - center.y
                            )
                            nativeColors.push(hex)
                        }
                    }
                })

                gcodeDataRef.current = {
                    positions: new Float32Array(positions),
                    nativeColors
                }
                setDetectedColors(Array.from(uniqueColors))

                // Initial camera fit
                const controls = controlsRef.current
                if (controls) {
                    const camera = controls.object as THREE.PerspectiveCamera
                    const size = box.getSize(new THREE.Vector3())
                    const maxDim = Math.max(size.x, size.y, size.z)
                    const fov = camera.fov * (Math.PI / 180)
                    const cameraDistance = Math.abs(maxDim / 2 * Math.tan(fov * 2)) * 1.5
                    camera.position.set(cameraDistance, cameraDistance, cameraDistance)
                    initialCameraPosition.current = camera.position.clone()
                    controls.target.set(0, size.z / 2, 0)
                    controls.update()
                }

                setLoading(false)
            } catch (err) {
                console.error(err); setError('Failed to parse G-code'); setLoading(false)
            }
        }
        parseGCode()
    }, [gcodeUrl, gcodeContent])

    // EFFECT 3: Model Creation & Color Updates
    useEffect(() => {
        if (loading || !gcodeDataRef.current || !sceneRef.current) return
        const { positions, nativeColors } = gcodeDataRef.current
        const scene = sceneRef.current

        if (mergedLineRef.current) {
            scene.remove(mergedLineRef.current)
            mergedLineRef.current.geometry.dispose()
            // @ts-ignore
            mergedLineRef.current.material.dispose()
        }

        const colors = new Float32Array(positions.length)
        for (let i = 0; i < nativeColors.length; i++) {
            const nativeHex = nativeColors[i]
            const color = new THREE.Color()

            if (userColors[nativeHex]) {
                color.set(userColors[nativeHex])
            } else if (new THREE.Color(nativeHex).g > new THREE.Color(nativeHex).r) {
                color.setHex(0x999999)
            } else {
                color.setHex(0xffffff)
            }
            colors[i * 3] = color.r
            colors[i * 3 + 1] = color.g
            colors[i * 3 + 2] = color.b
        }

        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

        const mergedLine = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ vertexColors: true, linewidth: 2 }))
        scene.add(mergedLine)
        mergedLineRef.current = mergedLine
        pointsArrayRef.current = positions
        totalPointsRef.current = positions.length / 3

        if (nozzleRef.current) mergedLine.add(nozzleRef.current)
    }, [loading, userColors])

    // EFFECT 4: Playback logic
    useEffect(() => {
        let frame: number
        const animate = () => {
            if (isPlaying) {
                setProgress(prev => {
                    if (prev >= 100) { setIsPlaying(false); return 100 }
                    return prev + (playbackSpeed * 0.02)
                })
            }
            frame = requestAnimationFrame(animate)
        }
        animate()
        return () => cancelAnimationFrame(frame)
    }, [isPlaying, playbackSpeed])

    // EFFECT 5: UI Visuals
    useEffect(() => {
        if (gridRef.current) gridRef.current.visible = showGrid
        if (axesRef.current) axesRef.current.visible = showAxes
        if (controlsRef.current) controlsRef.current.autoRotate = autoRotate

        if (mergedLineRef.current && pointsArrayRef.current) {
            const drawCount = Math.floor(totalPointsRef.current * (progress / 100))
            mergedLineRef.current.geometry.setDrawRange(0, drawCount)

            if (nozzleRef.current && drawCount > 0) {
                if (progress >= 99.9) {
                    // Home/Park Position: Elevated and to the side
                    nozzleRef.current.position.set(-200, 250, -200)
                } else {
                    const idx = (drawCount - 1) * 3
                    const x = pointsArrayRef.current[idx]
                    const yHeight = pointsArrayRef.current[idx + 1]
                    const zForward = pointsArrayRef.current[idx + 2]

                    nozzleRef.current.position.set(x, yHeight, zForward)
                }
                nozzleRef.current.visible = true
            } else if (nozzleRef.current) {
                // Initial state/Home
                nozzleRef.current.position.set(-200, 250, -200)
                nozzleRef.current.visible = true
            }
        }
    }, [progress, showGrid, showAxes, autoRotate])

    const setView = (view: 'top' | 'front' | 'side') => {
        if (!controlsRef.current || !mergedLineRef.current) return
        const controls = controlsRef.current
        const box = new THREE.Box3().setFromObject(mergedLineRef.current)
        const size = box.getSize(new THREE.Vector3())
        const center = box.getCenter(new THREE.Vector3())
        const maxDim = Math.max(size.x, size.y, size.z)
        const fov = (controls.object as THREE.PerspectiveCamera).fov * (Math.PI / 180)
        const distance = Math.abs(maxDim / 2 * Math.tan(fov * 2)) * 1.5
        controls.target.copy(center)
        if (view === 'top') { controls.object.position.set(center.x, center.y + distance, center.z); controls.object.up.set(0, 0, -1) }
        else if (view === 'front') { controls.object.position.set(center.x, center.y, center.z + distance); controls.object.up.set(0, 1, 0) }
        else { controls.object.position.set(center.x + distance, center.y, center.z); controls.object.up.set(0, 1, 0) }
        controls.update()
    }

    return (
        <div className={styles.container}>
            <div ref={containerRef} className={styles.viewer} style={{ height }} />

            {!loading && !error && (
                <div className={styles.controlsPanel}>
                    <div className={styles.controlGroup}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label>Progress: {Math.round(progress)}%</label>
                            <button onClick={() => { if (progress >= 100) setProgress(0); setIsPlaying(!isPlaying) }} className={styles.playBtn}>
                                {isPlaying ? '⏸️ Pause' : (progress >= 100 ? '↺ Replay' : '▶️ Play')}
                            </button>
                        </div>
                        <input type="range" min="0" max="100" step="0.1" value={progress} onChange={(e) => { setIsPlaying(false); setProgress(Number(e.target.value)) }} className={styles.rangeInput} />
                    </div>

                    <div className={styles.controlGroup}>
                        <label>Speed: {playbackSpeed}x</label>
                        <input type="range" min="0.25" max="5" step="0.25" value={playbackSpeed} onChange={(e) => setPlaybackSpeed(Number(e.target.value))} className={styles.rangeInput} />
                    </div>

                    {detectedColors.length > 0 && (
                        <div className={styles.controlGroup}>
                            <label style={{ marginBottom: '10px', display: 'block' }}>Region Colors</label>
                            <div className={styles.colorRegions}>
                                {detectedColors.map((hex) => (
                                    <div key={hex} className={styles.colorRow}>
                                        <input type="color" value={userColors[hex] || (new THREE.Color(hex).g > 0.8 ? '#444444' : '#ffffff')}
                                            onChange={(e) => setUserColors(prev => ({ ...prev, [hex]: e.target.value }))} className={styles.regionColorInput} />
                                        <span className={styles.hexLabel}>{userColors[hex] || (new THREE.Color(hex).g > 0.8 ? '#444444' : '#ffffff')}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className={styles.viewControls}>
                        <span className={styles.groupLabel}>View: </span>
                        <button className={styles.viewBtn} onClick={() => setView('top')}>Top</button>
                        <button className={styles.viewBtn} onClick={() => setView('front')}>Front</button>
                        <button className={styles.viewBtn} onClick={() => setView('side')}>Side</button>
                        <button className={styles.viewBtn} onClick={() => { if (mergedLineRef.current) mergedLineRef.current.rotation.x += Math.PI / 2 }}>↻ 90°</button>
                    </div>

                    <div className={styles.toggles}>
                        <button className={`${styles.toggleBtn} ${showGrid ? styles.active : ''}`} onClick={() => setShowGrid(!showGrid)}>Grid</button>
                        <button className={`${styles.toggleBtn} ${showAxes ? styles.active : ''}`} onClick={() => setShowAxes(!showAxes)}>Axes</button>
                        <button className={`${styles.toggleBtn} ${autoRotate ? styles.active : ''}`} onClick={() => setAutoRotate(!autoRotate)}>Rotate</button>
                        <button className={styles.resetBtn} onClick={() => { if (controlsRef.current && initialCameraPosition.current) { controlsRef.current.object.position.copy(initialCameraPosition.current); controlsRef.current.target.set(0, 0, 0); controlsRef.current.update() } }}>Reset</button>
                    </div>
                </div>
            )}

            {loading && (
                <div className={styles.overlay}>
                    <div className={styles.printerScene}>
                        <div className={styles.printBed} />
                        <div className={styles.modelGhost} />
                        <div
                            className={styles.modelProgress}
                            style={{ height: `${loadingProgress * 0.8}px` }} // Scaled for 80px max
                        />
                        <div
                            className={styles.nozzleAssembly}
                            style={{ bottom: `${4 + (loadingProgress * 0.8)}px` }}
                        >
                            <div className={styles.gantry} />
                            <div className={styles.nozzleHead} />
                        </div>
                    </div>
                    <div className={styles.loadingStats}>
                        PROCESSING {loadingProgress}%
                    </div>
                </div>
            )}
            {error && <div className={styles.overlay}><div className={styles.errorIcon}>⚠️</div><p>{error}</p></div>}
        </div>
    )
}
