'use client'
import styles from './MaterialChart.module.css'
import { FilamentKey } from '@/utils/pricingEngine'
import { Shield, Zap, Thermometer, Box } from 'lucide-react'
import { useAdminStore } from '@/store/adminStore'

interface MaterialChartProps {
    material: FilamentKey
    showTitle?: boolean
}

export default function MaterialChart({ material, showTitle = true }: MaterialChartProps) {
    const filaments = useAdminStore((state) => state.filaments)
    const materialTypes = useAdminStore((state) => state.materialTypes)

    // Resolve the display data and properties
    // 1. Try to find generic material type config (PLA, PETG, etc.)
    const materialTypeData = materialTypes.find(t => t.name === material)

    // 2. Try to find a specific filament match (by key)
    const filamentData = filaments[material]

    // 3. Fallback: find any filament of this type to see if it has properties
    const sampleFilament = !filamentData ? Object.values(filaments).find(f => f.type === material) : null

    const data = {
        name: materialTypeData?.name || filamentData?.type || sampleFilament?.type || material.replace(/_/g, ' '),
        properties: materialTypeData?.properties || filamentData?.properties || sampleFilament?.properties
    }

    // Rely on database only: if no properties exist in DB, hide the chart
    if (!data.properties) return null

    const properties = [
        { label: 'Strength', value: data.properties.strength, color: '#ff0055', icon: Shield },
        { label: 'Flexibility', value: data.properties.flexibility, color: '#00f0ff', icon: Zap },
        { label: 'Heat Resistance', value: data.properties.heatRes, color: '#ffae00', icon: Thermometer },
        { label: 'Durability', value: data.properties.durability, color: '#00ff88', icon: Box },
    ]

    return (
        <div className={styles.chartContainer}>
            {showTitle && <h3 className={styles.chartTitle}>{data.name} Properties</h3>}
            <div className={styles.propertyGrid}>
                {properties.map((prop) => (
                    <div key={prop.label} className={styles.propertyCard}>
                        <div className={styles.propertyHeader}>
                            <div className={styles.labelWithIcon}>
                                <prop.icon size={14} style={{ color: prop.color }} />
                                <span className={styles.propertyLabel}>{prop.label}</span>
                            </div>
                            <span className={styles.propertyValue}>{prop.value}/10</span>
                        </div>
                        <div className={styles.barTrack}>
                            <div
                                className={styles.barFill}
                                style={{
                                    width: `${prop.value * 10}%`,
                                    background: `linear-gradient(90deg, ${prop.color}88, ${prop.color})`,
                                    boxShadow: `0 0 15px ${prop.color}44`
                                }}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
