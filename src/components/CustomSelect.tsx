'use client'
import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import styles from './CustomSelect.module.css'

interface Option {
    value: string
    label: string
}

interface CustomSelectProps {
    value: string
    options: Option[]
    onChange: (value: string) => void
    label?: string
    disabled?: boolean
}

const CustomSelect: React.FC<CustomSelectProps> = ({ value, options, onChange, label, disabled }) => {
    const [isOpen, setIsOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    const selectedOption = options.find(opt => opt.value === value) || options[0]

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    return (
        <div className={`${styles.container} ${disabled ? styles.disabled : ''}`} ref={containerRef}>
            {label && <label className={styles.label}>{label}</label>}
            <div
                className={`${styles.trigger} ${isOpen ? styles.triggerOpen : ''}`}
                onClick={() => !disabled && setIsOpen(!isOpen)}
            >
                <span className={styles.value}>{selectedOption?.label}</span>
                <ChevronDown className={`${styles.icon} ${isOpen ? styles.iconOpen : ''}`} size={18} />
            </div>

            <div className={`${styles.dropdown} ${isOpen ? styles.dropdownVisible : ''}`}>
                {options.map((option) => (
                    <div
                        key={option.value}
                        className={`${styles.option} ${option.value === value ? styles.optionSelected : ''}`}
                        onClick={() => {
                            onChange(option.value)
                            setIsOpen(false)
                        }}
                    >
                        {option.label}
                    </div>
                ))}
            </div>
        </div>
    )
}

export default CustomSelect
