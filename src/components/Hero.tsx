'use client'
import { useState } from 'react'
import styles from './Hero.module.css'
import { Upload, Plus } from 'lucide-react'
import Link from 'next/link'
import STLViewer from './STLViewer'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import { useQueueStore } from '@/store/queueStore'

export default function Hero() {
    const router = useRouter()
    const [isDragging, setIsDragging] = useState(false)
    const user = useAuthStore(state => state.user)
    const addToQueue = useQueueStore(state => state.addToQueue)

    const processFiles = (files: FileList | File[]) => {
        const fileArray = Array.from(files)
        let validCount = 0

        fileArray.forEach((selectedFile) => {
            if (selectedFile.name.toLowerCase().endsWith('.stl')) {
                const url = URL.createObjectURL(selectedFile)

                // Add to queue store
                addToQueue({
                    id: Math.random().toString(36).substr(2, 9),
                    file: selectedFile,
                    fileName: selectedFile.name,
                    fileUrl: url,
                    size: selectedFile.size,
                    uploadProgress: 100,
                    status: 'pending'
                })

                validCount++
            }
        })

        if (validCount > 0) {
            // Redirect to upload/queue page
            router.push('/upload')
        } else {
            alert('Please upload valid .stl files')
        }
    }

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (files && files.length > 0) {
            processFiles(files)
        }
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(true)
    }

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        const files = e.dataTransfer.files
        if (files && files.length > 0) {
            processFiles(files)
        }
    }

    return (
        <section className={styles.hero}>
            <div className="container">
                <div className={styles.heroGrid}>
                    {/* Left: Text Content */}
                    <div className={styles.textContent}>
                        <h1 className={styles.title}>
                            Industrial Grade <br />
                            <span className="title-gradient">3D Printing</span>
                        </h1>
                        <p className={styles.description}>
                            Upload your STL, get instant quotes, and track your parts in real-time.
                            Manufactured with precision on our farm.
                        </p>

                        <div className={styles.stats}>
                            <div className={styles.stat}>
                                <h3>24h</h3>
                                <p>Turnaround</p>
                            </div>
                            <div className={styles.stat}>
                                <h3>±0.1mm</h3>
                                <p>Precision</p>
                            </div>
                            <div className={styles.stat}>
                                <h3>50+</h3>
                                <p>Materials</p>
                            </div>
                        </div>

                    </div>

                    {/* Right: Viewer & Configuration */}
                    <div className={styles.viewerContent}>
                        <div
                            className={`${styles.viewerContainer} ${isDragging ? styles.dragging : ''}`}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                        >
                            <div className={styles.dropZone}>
                                <div className={styles.dropZoneContent}>
                                    <div className={styles.iconCircle}>
                                        <Upload size={32} />
                                    </div>
                                    <h3>Drag & Drop STL Files</h3>
                                    <p>or click to browse (multiple files supported)</p>
                                </div>

                                <label htmlFor="stl-upload-hero" className={styles.uploadBtn}>
                                    <Upload size={20} />
                                    <span>Select STL File</span>
                                    <input
                                        id="stl-upload-hero"
                                        type="file"
                                        accept=".stl"
                                        multiple
                                        onChange={handleFileUpload}
                                        style={{ display: 'none' }}
                                    />
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Background Ambience */}
            <div className={styles.glow} />
        </section>
    )
}
