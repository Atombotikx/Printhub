import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

// Mock slicing endpoint - simulates backend STL analysis and g-code generation
export async function POST(request: Request) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ success: false, error: 'Unauthorized: Please log in to slice models' }, { status: 401 })
        }

        const formData = await request.formData()
        const file = formData.get('file') as File
        const material = formData.get('material') as string
        const layerHeight = Number.parseFloat(formData.get('layerHeight') as string || '0.2')
        const infill = Number.parseInt(formData.get('infill') as string || '20')

        if (!file) {
            return NextResponse.json(
                { success: false, error: 'No file provided' },
                { status: 400 }
            )
        }

        // ── File size guard (50 MB max) ──
        const MAX_FILE_SIZE = 50 * 1024 * 1024
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(
                { success: false, error: 'File too large. Maximum allowed size is 50 MB.' },
                { status: 413 }
            )
        }

        // ── File type guard ──
        const allowedExtensions = ['.stl', '.3mf', '.obj']
        const fileName = file.name.toLowerCase()
        if (!allowedExtensions.some(ext => fileName.endsWith(ext))) {
            return NextResponse.json(
                { success: false, error: 'Invalid file type. Only .stl, .3mf and .obj files are accepted.' },
                { status: 400 }
            )
        }

        // ── Numeric input validation ──
        const validMaterials = ['PLA', 'ABS', 'PETG', 'TPU', 'Nylon']
        if (!validMaterials.includes(material)) {
            return NextResponse.json(
                { success: false, error: 'Invalid material selection.' },
                { status: 400 }
            )
        }
        if (Number.isNaN(layerHeight) || layerHeight < 0.05 || layerHeight > 0.5) {
            return NextResponse.json(
                { success: false, error: 'Layer height must be between 0.05 mm and 0.5 mm.' },
                { status: 400 }
            )
        }
        if (Number.isNaN(infill) || infill < 5 || infill > 100) {
            return NextResponse.json(
                { success: false, error: 'Infill must be between 5% and 100%.' },
                { status: 400 }
            )
        }

        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 1000))

        // Mock slice results - in reality this would use a slicer like BambuStudio API
        const fileSize = file.size

        // Rough estimates based on file size (this is very simplified)
        const estimatedVolume = Math.max(10, Math.min(500, fileSize / 10000))
        const estimatedWeight = estimatedVolume * getMaterialDensity(material)
        const estimatedPrintTime = calculatePrintTime(estimatedVolume, layerHeight, infill)
        const estimatedFilamentLength = estimatedWeight / getMaterialDensity(material) * 400 // rough meters
        const estimatedLayers = Math.ceil((estimatedVolume * 10) / Math.pow(layerHeight * 10, 2))

        return NextResponse.json({
            success: true,
            sliceData: {
                fileName: file.name,
                material,
                layerHeight,
                infill,
                volume: Math.round(estimatedVolume * 100) / 100,
                weight: Math.round(estimatedWeight * 100) / 100,
                printTime: estimatedPrintTime, // minutes
                filamentLength: Math.round(estimatedFilamentLength * 100) / 100,
                layers: estimatedLayers,
                estimatedCost: calculateCost(estimatedWeight, material)
            },
            timestamp: new Date().toISOString()
        })

    } catch {
        return NextResponse.json(
            { success: false, error: 'Slicing failed' },
            { status: 500 }
        )
    }
}

function getMaterialDensity(material: string): number {
    const densities: { [key: string]: number } = {
        'PLA': 1.24,
        'ABS': 1.04,
        'PETG': 1.27,
        'TPU': 1.21,
        'Nylon': 1.14
    }
    return densities[material] || 1.24
}

function calculatePrintTime(volume: number, layerHeight: number, infill: number): number {
    // Very simplified calculation - in reality depends on many factors
    const baseTime = volume * 2 // 2 minutes per cm³ base
    const layerFactor = (0.3 - layerHeight) * 50 // finer layers take longer
    const infillFactor = infill * 0.5 // more infill takes longer
    return Math.round(baseTime + layerFactor + infillFactor)
}

function calculateCost(weight: number, material: string): number {
    const pricePerGram: { [key: string]: number } = {
        'PLA': 0.02,
        'ABS': 0.025,
        'PETG': 0.03,
        'TPU': 0.05,
        'Nylon': 0.06
    }
    const materialPrice = (pricePerGram[material] || 0.02) * weight
    return Math.round(materialPrice * 100) / 100
}
