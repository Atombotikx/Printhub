'use client'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { Suspense, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { STLLoader } from 'three-stdlib'
import styles from './GCodeViewer.module.css'
import Loader from './Loader'

interface STLViewerProps {
    url: string
    color?: string
    height?: number
    showCrossSection?: boolean
    crossSectionHeight?: number
    crossSectionAxis?: 'x' | 'y' | 'z'
    wireframe?: boolean
    opacity?: number
    autoRotate?: boolean
    showAxes?: boolean
    showLoader?: boolean
    estimatedTime?: string
    geometry?: THREE.BufferGeometry | null
    urlResolver?: (path: string) => Promise<{ data: string | null; error: string | null }>
}

function IsaacSimFloor() {
    return (
        <group>
            {/* Reflective Ground Plane (Isaac Sim Style) */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]} receiveShadow>
                <planeGeometry args={[30000, 30000]} />
                <meshStandardMaterial
                    color="#1a2b3c"
                    metalness={0.8}
                    roughness={0.2}
                />
            </mesh>

            {/* Prominent Grid */}
            <gridHelper
                args={[20000, 40, "#ffffff", "#445566"]}
                position={[0, 0, 0]}
                onUpdate={(self) => {
                    if (self.material instanceof THREE.Material) {
                        self.material.transparent = true;
                        self.material.opacity = 0.35;
                    }
                }}
            />
        </group>
    )
}

function Model({ geom, color = '#ffffff', showCrossSection = false, crossSectionHeight = 50, crossSectionAxis = 'y', wireframe = false, opacity = 1, autoRotate = true }: any) {
    const meshRef = useRef<THREE.Mesh>(null)
    const clippingPlane = useRef(new THREE.Plane(new THREE.Vector3(0, -1, 0), 0))

    useEffect(() => {
        if (!geom) return
        if (showCrossSection) {
            geom.computeBoundingBox()
            const size = new THREE.Vector3()
            geom.boundingBox!.getSize(size)

            if (crossSectionAxis === 'x') {
                clippingPlane.current.normal.set(-1, 0, 0)
                clippingPlane.current.constant = (crossSectionHeight / 100) * size.x - (size.x / 2)
            } else if (crossSectionAxis === 'z') {
                clippingPlane.current.normal.set(0, 0, -1)
                clippingPlane.current.constant = (crossSectionHeight / 100) * size.z - (size.z / 2)
            } else {
                clippingPlane.current.normal.set(0, -1, 0)
                clippingPlane.current.constant = (crossSectionHeight / 100) * size.y
            }
        }
    }, [geom, showCrossSection, crossSectionHeight, crossSectionAxis])

    useFrame(() => {
        if (meshRef.current && autoRotate && !showCrossSection) {
            meshRef.current.rotation.y += 0.01
        }
    })

    return (
        <mesh ref={meshRef} geometry={geom} castShadow receiveShadow>
            <meshStandardMaterial
                color={new THREE.Color(color)}
                roughness={0.4}
                metalness={0.6}
                emissive={new THREE.Color(color)}
                emissiveIntensity={0.1}
                clippingPlanes={showCrossSection ? [clippingPlane.current] : []}
                clipShadows={true}
                side={THREE.DoubleSide}
                wireframe={wireframe}
                transparent={opacity < 1}
                opacity={opacity}
            />
        </mesh>
    )
}

export default function STLViewer({ url, color = '#ffffff', height = 400, showCrossSection, crossSectionHeight, crossSectionAxis = 'y', wireframe, opacity, autoRotate = true, showAxes = false, showLoader = false, estimatedTime, geometry, urlResolver }: STLViewerProps) {
    const [loading, setLoading] = useState(true)
    const [processedGeom, setProcessedGeom] = useState<THREE.BufferGeometry | null>(null)
    const [error, setError] = useState<string | null>(null)
    const resolvingRef = useRef(false)

    useEffect(() => {
        if (geometry) {
            setProcessedGeom(geometry)
            setLoading(false)
            return
        }

        if (!url) {
            setLoading(false)
            return
        }

        const loadModel = (actualUrl: string) => {
            const loader = new STLLoader()
            setLoading(true)
            setError(null)

            const startTime = Date.now()

            loader.load(actualUrl, (geom) => {
                geom.computeBoundingBox()
                const size = new THREE.Vector3()
                geom.boundingBox!.getSize(size)
                geom.center()
                // Don't translate up here, we want rotation to be around the geometric center
                // geom.translate(0, size.y / 2, 0)

                const elapsedTime = Date.now() - startTime
                const minLoadTime = showLoader ? 800 : 0

                setTimeout(() => {
                    setProcessedGeom(geom)
                    setLoading(false)
                }, Math.max(0, minLoadTime - elapsedTime))

            }, (xhr) => {
                // Optional progress logging
            }, (err) => {
                setError('Failed to load 3D model: Connection error')
                setLoading(false)
            })
        }

        const resolveAndLoad = async () => {
            if (resolvingRef.current) return
            resolvingRef.current = true

            try {
                let finalUrl = url
                if (url && !url.startsWith('blob:') && !url.startsWith('http')) {
                    if (urlResolver) {
                        const res = await urlResolver(url)
                        if (res.data) {
                            finalUrl = res.data
                        } else {
                            setError(`Access Denied: ${res.error || 'Private file'}`)
                            setLoading(false)
                            return
                        }
                    } else {
                        setError('No URL resolver provided for storage path')
                        setLoading(false)
                        return
                    }
                }

                if (finalUrl) {
                    loadModel(finalUrl)
                } else {
                    setLoading(false)
                }
            } catch (err) {
                setError('Connection error while fetching model')
                setLoading(false)
            } finally {
                resolvingRef.current = false
            }
        }

        resolveAndLoad()
    }, [url, showLoader, geometry])

    return (
        <div style={{
            width: '100%',
            height: `${height}px`,
            background: '#0a111a',
            borderRadius: '12px',
            overflow: 'hidden',
            position: 'relative'
        }}>
            <Canvas
                shadows
                dpr={[1, 2]}
                gl={{ localClippingEnabled: true, antialias: true, logarithmicDepthBuffer: true }}
                onCreated={({ scene, gl }) => {
                    scene.background = new THREE.Color('#0a111a')
                    scene.fog = new THREE.Fog('#0a111a', 5000, 30000)
                    gl.toneMapping = THREE.ACESFilmicToneMapping
                    gl.toneMappingExposure = 1.4 // Slightly higher for better white visibility
                }}
            >
                <Suspense fallback={null}>
                    {processedGeom && processedGeom.boundingBox && (
                        <group position={[0, -processedGeom.boundingBox.getSize(new THREE.Vector3()).y / 2, 0]}>
                            <IsaacSimFloor />
                        </group>
                    )}
                    {!processedGeom && <IsaacSimFloor />}

                    <ambientLight intensity={0.7} />
                    <hemisphereLight args={[0xabcfff, 0x111111, 0.8]} />

                    <directionalLight position={[500, 3000, 1000]} intensity={1.5} castShadow />
                    <directionalLight position={[-500, 3000, -1000]} intensity={0.8} />
                    <pointLight position={[-800, 1000, 800]} intensity={3.5} distance={4000} />

                    {processedGeom && (
                        <Model
                            geom={processedGeom}
                            color={color}
                            showCrossSection={showCrossSection}
                            crossSectionHeight={crossSectionHeight}
                            crossSectionAxis={crossSectionAxis}
                            wireframe={wireframe}
                            opacity={opacity}
                            autoRotate={autoRotate}
                        />
                    )}

                    {showAxes && <axesHelper args={[200]} />}

                    <OrbitControls
                        makeDefault
                        enableDamping
                        minDistance={0.1}
                        maxDistance={3000}
                    />

                    <PerspectiveCamera
                        makeDefault
                        position={[300, 200, 300]}
                        fov={50}
                        near={1}
                        far={100000}
                    />
                </Suspense>
            </Canvas>

            {loading && showLoader && (
                <div className={styles.overlay} style={{ backgroundColor: '#0a111a' }}>
                    <Loader text="Loading 3D Model..." fullPage={false} />
                </div>
            )}

            {error && (
                <div className={styles.overlay} style={{ backgroundColor: 'rgba(10, 17, 26, 0.9)' }}>
                    <div style={{ color: '#ff4444', fontSize: '24px', marginBottom: '8px' }}>⚠️</div>
                    <p style={{ color: 'white', fontWeight: '500', textAlign: 'center', padding: '0 20px' }}>{error}</p>
                </div>
            )}
        </div>
    )
}
