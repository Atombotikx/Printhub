'use client'
import styles from './Loader.module.css'

interface LoaderProps {
    text?: string
    fullPage?: boolean
}

export default function Loader({ text = 'Loading...', fullPage = true }: LoaderProps) {
    const loaderContent = (
        <div className={fullPage ? styles.overlay : styles.inlineContainer}>
            <div className={styles.spinner}></div>
            {text && <p className={styles.text}>{text}</p>}
        </div>
    )

    return loaderContent
}
