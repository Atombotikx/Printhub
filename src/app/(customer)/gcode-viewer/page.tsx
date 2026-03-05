'use client'
import { useState, useRef } from 'react'
import styles from './GCodeViewer.module.css'
import GCodeViewer from '@/components/GCodeViewer'
import { Upload, FileCode } from 'lucide-react'
import BackButton from '@/components/BackButton'
import Loader from '@/components/Loader'

export default function GCodePage() {
    const [file, setFile] = useState<File | null>(null)
    const [content, setContent] = useState<string>('')
    const [reading, setReading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0]
            if (selectedFile.name.endsWith('.gcode')) {
                setReading(true)
                setFile(selectedFile)
                const text = await selectedFile.text()
                setContent(text)
                setReading(false)
            } else {
                alert('Please upload a .gcode file')
            }
        }
    }

    return (
        <div className={styles.container}>
            {reading && <Loader text="Reading file..." />}
            <div className={styles.header}>
                <div className={styles.backWrapper}>
                    <BackButton />
                </div>
                <h1 className="title-gradient" style={{ margin: 0 }}>Visualize G-Code</h1>
                <p className={styles.subtitle}>Visualize your print paths layer by layer</p>
            </div>

            <div className={styles.viewerWrapper}>
                {!content ? (
                    <div
                        className={styles.uploadZone}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept=".gcode"
                            hidden
                        />
                        <Upload size={48} className={styles.uploadIcon} />
                        <h3>Drop your G-Code file here</h3>
                        <p>or click to browse</p>
                        <span className={styles.supported}>Supported format: .gcode</span>
                    </div>
                ) : (
                    <div className={styles.viewerContent}>
                        <div className={styles.toolbar}>
                            <div className={styles.fileInfo}>
                                <FileCode size={20} />
                                <span>{file?.name}</span>
                            </div>
                            <button
                                onClick={() => { setFile(null); setContent(''); }}
                                className={styles.changeBtn}
                            >
                                Change File
                            </button>
                        </div>
                        <GCodeViewer
                            gcodeContent={content}
                            height={600}
                        />
                    </div>
                )}
            </div>
        </div>
    )
}
