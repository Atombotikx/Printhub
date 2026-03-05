'use client'
import { useState, useCallback } from 'react'
import { Upload, Trash2, Settings, CheckCircle, Clock, FileUp, ShoppingCart, MinusCircle, ArrowLeft } from 'lucide-react'
import { useQueueStore, QueueItem } from '@/store/queueStore'
import { useCartStore } from '@/store/cartStore'
import styles from './Upload.module.css'
import { useToastStore } from '@/store/toastStore'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import BackButton from '@/components/BackButton'
import { saveFileToDB } from '@/utils/db'

function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID()
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8)
        return v.toString(16)
    })
}

export default function UploadPage() {
    const { items: queueItems, addToQueue, removeFromQueue, updateQueueItem } = useQueueStore()
    const removeItemFromCart = useCartStore((state) => state.removeItem)
    const [isDragging, setIsDragging] = useState(false)
    const router = useRouter()

    const handleFiles = (files: FileList | null) => {
        if (!files) return

        Array.from(files).forEach((file) => {
            const extension = file.name.toLowerCase().split('.').pop()
            if (extension === 'stl') {
                const url = URL.createObjectURL(file)
                const newItem = {
                    id: generateUUID(),
                    file,
                    fileName: file.name,
                    fileUrl: url,
                    size: file.size,
                    uploadProgress: 100,
                    status: 'pending' as const,
                }
                saveFileToDB(newItem.id, file);
                addToQueue(newItem)
            } else {
                useToastStore.getState().addToast(`${file.name} is not a valid 3D file (.stl)`, 'error')
            }
        })
    }

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        handleFiles(e.target.files)
        e.target.value = '' // Reset input
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
        handleFiles(e.dataTransfer.files)
    }

    const handleAddToCart = (id: string) => {
        router.push(`/configure?id=${id}&source=queue`)
    }

    const handleRemoveFromCart = (item: QueueItem) => {
        if (item.configuredId) {
            removeItemFromCart(item.configuredId)
            updateQueueItem(item.id, { status: 'pending', configuredId: undefined })
        }
    }

    const handleRemoveFromQueue = (item: QueueItem) => {
        // If it's in the cart, remove it from there too
        if (item.configuredId) {
            removeItemFromCart(item.configuredId)
        }
        URL.revokeObjectURL(item.fileUrl)
        removeFromQueue(item.id)
    }

    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes'
        const k = 1024
        const sizes = ['Bytes', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
    }

    const pendingCount = queueItems.filter(i => i.status === 'pending').length

    return (
        <div className="container" style={{ paddingTop: '120px', paddingBottom: '60px' }}>
            <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
                <div style={{ position: 'relative', minHeight: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '40px' }}>
                    <div style={{ position: 'absolute', left: 0, top: 0, zIndex: 10 }}>
                        <BackButton />
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <h1 className="title-gradient" style={{ margin: 0 }}>Upload 3D Files</h1>
                        <p style={{ opacity: 0.7, marginTop: '8px' }}>
                            Upload multiple STL files and configure each one individually
                        </p>
                    </div>
                </div>

                {/* Upload Zone */}
                <label
                    className={`${styles.dropzone} ${isDragging ? styles.dragging : ''}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    <input
                        type="file"
                        accept=".stl"
                        onChange={onFileChange}
                        multiple
                        hidden
                    />
                    <FileUp size={48} color="var(--primary-color)" />
                    <p>Click or drag multiple STL files to upload</p>
                    <span>Maximum file size per file: 50MB</span>
                </label>

                {/* Queue List */}
                {queueItems.length > 0 && (
                    <div style={{ marginTop: '40px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2>Upload Queue ({queueItems.length})</h2>
                            {pendingCount > 0 && (
                                <span style={{ color: 'var(--primary-color)', fontSize: '0.9rem' }}>
                                    {pendingCount} pending configuration
                                </span>
                            )}
                        </div>

                        <div className={styles.queueList}>
                            {queueItems.map((item) => (
                                <div key={item.id} className={`${styles.queueItem} glass`}>
                                    <div className={styles.queueItemIcon}>
                                        {item.status === 'pending' ? (
                                            <Clock size={24} color="var(--primary-color)" />
                                        ) : (
                                            <CheckCircle size={24} color="#00ff88" />
                                        )}
                                    </div>

                                    <div className={styles.queueItemInfo}>
                                        <h3>{item.fileName}</h3>
                                        <div className={styles.queueItemMeta}>
                                            <span>{formatFileSize(item.size)}</span>
                                            <span className={styles.dot}>•</span>
                                            <span style={{
                                                color: item.status === 'pending' ? 'var(--primary-color)' : '#00ff88'
                                            }}>
                                                {item.status === 'pending' ? 'Pending' : 'Added to Cart'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className={styles.queueItemActions}>
                                        {/* Add to Cart / Configure Button */}
                                        {item.status === 'pending' ? (
                                            <button
                                                className="btn"
                                                onClick={() => handleAddToCart(item.id)}
                                            >
                                                <ShoppingCart size={18} style={{ marginRight: 8 }} />
                                                Add to Cart
                                            </button>
                                        ) : (
                                            <button
                                                className={styles.removeCartBtn}
                                                onClick={() => handleRemoveFromCart(item)}
                                            >
                                                <MinusCircle size={18} style={{ marginRight: 8 }} />
                                                Remove from Cart
                                            </button>
                                        )}

                                        {/* Remove from Queue Button */}
                                        <button
                                            className={styles.removeBtn}
                                            onClick={() => handleRemoveFromQueue(item)}
                                            title="Remove from Queue"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {queueItems.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '60px 20px', opacity: 0.5 }}>
                        <Upload size={64} style={{ marginBottom: '16px' }} />
                        <p>No files uploaded yet. Upload STL files to get started.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
