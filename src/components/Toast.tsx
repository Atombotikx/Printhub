'use client'
import { useEffect } from 'react'
import { useToastStore } from '@/store/toastStore'
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react'
import styles from './Toast.module.css'

export default function ToastContainer() {
    const { toasts, removeToast } = useToastStore()

    return (
        <div className={styles.container}>
            {toasts.map((toast) => (
                <div key={toast.id} className={`${styles.toast} ${styles[toast.type]}`}>
                    <div className={styles.icon}>
                        {toast.type === 'success' && <CheckCircle size={20} />}
                        {toast.type === 'error' && <XCircle size={20} />}
                        {toast.type === 'info' && <Info size={20} />}
                        {toast.type === 'warning' && <AlertTriangle size={20} />}
                    </div>
                    <div className={styles.message}>{toast.message}</div>
                    <button
                        className={styles.closeBtn}
                        onClick={() => removeToast(toast.id)}
                        aria-label="Close"
                    >
                        <X size={16} />
                    </button>
                </div>
            ))}
        </div>
    )
}
