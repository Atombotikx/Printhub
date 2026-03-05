/**
 * ========================================
 * PRICING CONFIGURATION (ADMIN EDITABLE)
 * ========================================
 * 
 * To update filament prices:
 * 1. Modify them in the Admin Panel
 * 2. pricePerGram = Price per gram in INR
 * 3. density = Material density in g/cm³
 * 
 * Current Currency: INR (₹)
 */

export type FilamentKey = string

// Infill Patterns affecting print time/density
export const INFILL_PATTERNS = {
    grid: { name: 'Grid', densityMultiplier: 1.0, timeMultiplier: 1.0 },
    gyroid: { name: 'Gyroid', densityMultiplier: 1.05, timeMultiplier: 1.15 },
    cubic: { name: 'Cubic', densityMultiplier: 1.02, timeMultiplier: 1.05 },
    lines: { name: 'Lines', densityMultiplier: 0.95, timeMultiplier: 0.9 },
}

// Breakdown of accurate pricing
export interface PriceBreakdown {
    mainMaterialCost: number
    supportMaterialCost: number
    materialCost: number
    printCost: number
    setupCost: number // setup + misc (one-time)
    unitCost: number // material + print (per item)
    totalCost: number
    mainWeightGrams: number
    supportWeightGrams: number
    printTimeMinutes: number
}

// Params needed for calculation
export interface PricingParams {
    volumeCm3: number
    material: FilamentKey
    quantity?: number
    layerHeight?: number
    infill?: number
    infillPattern?: string
    brim?: boolean

    // Configurable Rates
    pricePerGram?: number
    electricityRate?: number // INR per hour
    miscFee?: number // One-time fee

    // Support
    supportVolumeCm3?: number
    supportMaterial?: FilamentKey
    supportPricePerGram?: number

    // Dynamic Overrides (from Admin Store)
    mainDensity?: number
    supportDensity?: number
}

export const calculateDetailedPrice = ({
    volumeCm3,
    material,
    quantity = 1,
    layerHeight = 0.2,
    infill = 20,
    infillPattern,
    brim,
    pricePerGram,
    electricityRate = 0,
    miscFee = 0,
    supportVolumeCm3 = 0,
    supportMaterial,
    supportPricePerGram,
    mainDensity,
    supportDensity
}: PricingParams): PriceBreakdown => {
    // 0. Parameter adjusting (Infill Density, Pattern, Brim)
    // Base heuristic: solid object = 100% infill. A 20% infill object isn't actually 20% of the volume, walls take up material.
    // Let's assume bounding volume is reduced. The provided volumeCm3 is usually bounding. 
    // We'll scale volume based on infill deviation from 20% (assuming 20% is baseline 1.0)
    let volumeMultiplier = 1.0 + ((infill - 20) / 100) * 0.8 // Scaling material logic

    // Apply pattern modifiers
    const pattern = INFILL_PATTERNS[infillPattern as keyof typeof INFILL_PATTERNS] || INFILL_PATTERNS.grid
    volumeMultiplier *= pattern.densityMultiplier

    const adjustedMainVolumeCm3 = volumeCm3 * volumeMultiplier

    // 1. Calculate Weights
    // We expect density to be passed in from the DB, otherwise use PLA default
    const actualMainDensity = mainDensity || 1.24
    const actualSupportDensity = supportDensity || actualMainDensity

    // Calculate Brim (1% extra of base volume using main material density)
    const brimGrams = brim ? (volumeCm3 * 0.01) * actualMainDensity : 0

    const mainWeightGrams = adjustedMainVolumeCm3 * actualMainDensity
    const supportWeightGrams = (supportVolumeCm3 * actualSupportDensity) + brimGrams

    // 2. Determine Prices
    const actualMainPricePerGram = pricePerGram || 0
    const actualSupportPricePerGram = supportPricePerGram || 0

    // 3. Material Cost (Per Unit)
    const mainMaterialCost = mainWeightGrams * actualMainPricePerGram
    const supportModelCost = (supportVolumeCm3 * actualSupportDensity) * actualSupportPricePerGram
    const brimCost = brimGrams * actualMainPricePerGram
    const supportMaterialCost = supportModelCost + brimCost
    const totalMaterialCostPerUnit = mainMaterialCost + supportMaterialCost

    // 4. Print Cost (Per Unit) - Electricity
    // Total volume for print time calculation
    const totalVolume = adjustedMainVolumeCm3 + supportVolumeCm3

    // Time scaling matching pattern
    const printTimeMinutes = calculatePrintTime(totalVolume, layerHeight, infill) * pattern.timeMultiplier
    // Add realistic time penalty for brim (approx 1.5 mins)
    const adjustedPrintTimeMinutes = brim ? printTimeMinutes + 1.5 : printTimeMinutes

    const printTimeHours = adjustedPrintTimeMinutes / 60
    const printCostPerUnit = printTimeHours * (electricityRate || 0)

    // 5. Setup Cost (One Time per line item) -> Now requested as Per Item setup
    // Based purely on Global Misc Fee
    const setupCostPerUnit = miscFee || 0

    // Totals
    const unitCost = totalMaterialCostPerUnit + printCostPerUnit + setupCostPerUnit
    const totalCost = unitCost * (quantity || 1)

    return {
        mainMaterialCost: Math.ceil(mainMaterialCost),
        supportMaterialCost: Math.ceil(supportMaterialCost),
        materialCost: Math.ceil(totalMaterialCostPerUnit),
        printCost: Math.ceil(printCostPerUnit),
        setupCost: Math.ceil(setupCostPerUnit),
        unitCost: Math.ceil(unitCost),
        totalCost: Math.ceil(totalCost),
        mainWeightGrams: Number(mainWeightGrams.toFixed(2)),
        supportWeightGrams: Number(supportWeightGrams.toFixed(2)),
        printTimeMinutes: Math.round(adjustedPrintTimeMinutes)
    }
}


export const calculatePrintTime = (
    volumeCm3: number,
    layerHeight: number = 0.2,
    infill: number = 20
) => {
    // Basic heuristic: 1cm3 at 0.2mm takes ~15 mins
    // Adjust by layer height (thinner = slower)
    // Adjust by infill (more = slower)
    const baseMinutesPerCm3 = 15
    const layerFactor = 0.2 / layerHeight
    const infillFactor = (infill / 20) * 0.5 + 0.5

    const minutes = volumeCm3 * baseMinutesPerCm3 * layerFactor * infillFactor
    return Math.round(minutes)
}

export const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
        minimumFractionDigits: 0
    }).format(Math.ceil(amount))
}

export const calculateWeight = (volumeCm3: number, density: number = 1.24): number => {
    return Math.round(volumeCm3 * density * 100) / 100
}
