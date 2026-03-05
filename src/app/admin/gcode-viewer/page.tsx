'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import styles from './AdminGCode.module.css'
import GCodeViewer from '@/components/GCodeViewer'
import { Upload, FileCode } from 'lucide-react'
import { useToastStore } from '@/store/toastStore'
import { createClient } from '@/utils/supabase/client'
import { User } from '@supabase/supabase-js'
import Loader from '@/components/Loader'

export default function AdminGCodePage() {
    const [file, setFile] = useState<File | null>(null)
    const [content, setContent] = useState<string>('')
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

    if (loading) return <Loader text="Checking permissions..." />

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0]
            if (selectedFile.name.endsWith('.gcode')) {
                setFile(selectedFile)
                const text = await selectedFile.text()
                setContent(text)
            } else {
                useToastStore.getState().addToast('Please upload a .gcode file', 'error')
            }
        }
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1 className="title-gradient">View G-Code</h1>
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
                        <h3>Drop G-Code file here</h3>
                        <p>or click to browse</p>
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
