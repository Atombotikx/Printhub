'use client'

import React from 'react'
import styles from './Background.module.css'

export default function Background() {
    return (
        <div className={styles.wrapper}>
            <video
                autoPlay
                loop
                muted
                playsInline
                className={styles.videoLayer}
            >
                <source src="/videos/background.mp4" type="video/mp4" />
                Your browser does not support the video tag.
            </video>

            {/* Tech overlays */}
            <div className={styles.overlay} />
            <div className={styles.mesh} />
        </div>
    )
}
