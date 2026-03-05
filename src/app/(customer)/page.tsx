'use client'
import Hero from '@/components/Hero'
import Loader from '@/components/Loader'
import Link from 'next/link'
import styles from './Home.module.css'
import { Microscope, ShieldCheck, Zap, Globe } from 'lucide-react'

import Testimonials from '@/components/Testimonials'
import AnnouncementBanner from '@/components/AnnouncementBanner'

export default function Home() {
  return (
    <main>
      <AnnouncementBanner />
      <Hero />

      {/* Features Section */}
      <section className={styles.features}>
        <div className="container">
          <div className={styles.grid}>
            <div className={`${styles.card} glass`}>
              <Zap className={styles.icon} />
              <h3>Instant Quoting</h3>
              <p>Our pricing engine calculates exact pricing for your STL files in seconds.</p>
            </div>
            <div className={`${styles.card} glass`}>
              <Microscope className={styles.icon} />
              <h3>Precision Engineering</h3>
              <p>Industrial grade printers with ±0.1mm tolerance for critical parts.</p>
            </div>
            <div className={`${styles.card} glass`}>
              <ShieldCheck className={styles.icon} />
              <h3>Quality Assured</h3>
              <p>Every part goes through manual post-processing and quality inspection before shipping.</p>
            </div>
            <div className={`${styles.card} glass`}>
              <Globe className={styles.icon} />
              <h3>Global Shipping</h3>
              <p>Fast delivery with real-time tracking from our farm to your door.</p>
            </div>
          </div>
        </div>
      </section>

      <Testimonials />
    </main>
  )
}
