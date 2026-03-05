import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

// Mock data for Bambu Lab printers
const mockPrinters = [
    {
        id: 'printer-001',
        name: 'Bambu X1 Carbon #1',
        type: 'FDM',
        status: 'available',
        materials: ['PLA', 'PETG', 'ABS', 'TPU'],
        buildVolume: { x: 256, y: 256, z: 256 },
        amsEnabled: true
    },
    {
        id: 'printer-002',
        name: 'Bambu X1 Carbon #2',
        type: 'FDM',
        status: 'busy',
        materials: ['PLA', 'PETG', 'ABS'],
        buildVolume: { x: 256, y: 256, z: 256 },
        amsEnabled: true,
        currentJob: {
            fileName: 'bracket.stl',
            progress: 45,
            timeRemaining: 120 // minutes
        }
    },
    {
        id: 'printer-003',
        name: 'Bambu P1S #1',
        type: 'FDM',
        status: 'available',
        materials: ['PLA', 'PETG', 'ABS'],
        buildVolume: { x: 256, y: 256, z: 256 },
        amsEnabled: true
    },
    {
        id: 'printer-004',
        name: 'Bambu P1S #2',
        type: 'FDM',
        status: 'error',
        materials: ['PLA', 'PETG'],
        buildVolume: { x: 256, y: 256, z: 256 },
        amsEnabled: false,
        error: 'Filament jam detected'
    },
    {
        id: 'printer-005',
        name: 'Bambu A1 Mini #1',
        type: 'FDM',
        status: 'available',
        materials: ['PLA', 'PETG'],
        buildVolume: { x: 180, y: 180, z: 180 },
        amsEnabled: false
    }
]

export async function GET(request: Request) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const ADMIN_EMAILS_ENV = process.env.NEXT_PUBLIC_ADMIN_EMAILS || ''
    const ADMINS = ADMIN_EMAILS_ENV.split(',').map(e => e.trim().toLowerCase())
    const isAdmin = user && ADMINS.includes(user.email?.toLowerCase() || '') && user.app_metadata?.provider === 'email'

    if (!isAdmin) {
        return NextResponse.json({ success: false, error: 'Unauthorized: Admin access required to view printers' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const material = searchParams.get('material')

    let printers = mockPrinters

    // Filter by status
    if (status) {
        printers = printers.filter(p => p.status === status)
    }

    // Filter by material support
    if (material) {
        printers = printers.filter(p => p.materials.includes(material))
    }

    return NextResponse.json({
        success: true,
        printers,
        timestamp: new Date().toISOString()
    })
}

export async function POST(request: Request) {
    // Auth Check
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const ADMIN_EMAILS_ENV = process.env.NEXT_PUBLIC_ADMIN_EMAILS || ''
    const ADMINS = ADMIN_EMAILS_ENV.split(',').map(e => e.trim().toLowerCase())
    const isAdmin = user && ADMINS.includes(user.email?.toLowerCase() || '') && user.app_metadata?.provider === 'email'

    if (!isAdmin) {
        return NextResponse.json({ success: false, error: 'Unauthorized: Admin access required' }, { status: 403 })
    }

    // Mock endpoint for adding a print job to the queue
    const body = await request.json()
    const { printerId, fileName, material, quantity } = body

    // ── Input validation ──
    if (!printerId || typeof printerId !== 'string') {
        return NextResponse.json({ success: false, error: 'Invalid or missing printerId' }, { status: 400 })
    }
    if (!fileName || typeof fileName !== 'string' || fileName.length > 255) {
        return NextResponse.json({ success: false, error: 'Invalid or missing fileName' }, { status: 400 })
    }
    const validMaterials = ['PLA', 'ABS', 'PETG', 'TPU', 'Nylon']
    if (!material || !validMaterials.includes(material)) {
        return NextResponse.json({ success: false, error: 'Invalid material. Must be one of: PLA, ABS, PETG, TPU, Nylon' }, { status: 400 })
    }
    if (quantity === undefined || typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
        return NextResponse.json({ success: false, error: 'Quantity must be a whole number between 1 and 100' }, { status: 400 })
    }

    const printer = mockPrinters.find(p => p.id === printerId)

    if (!printer) {
        return NextResponse.json(
            { success: false, error: 'Printer not found' },
            { status: 404 }
        )
    }

    if (printer.status !== 'available') {
        return NextResponse.json(
            { success: false, error: 'Printer is not available' },
            { status: 400 }
        )
    }

    // Mock successful queue addition
    return NextResponse.json({
        success: true,
        jobId: Math.random().toString(36).slice(2, 11),
        printerId,
        fileName,
        material,
        quantity,
        queuePosition: Math.floor(Math.random() * 5) + 1,
        estimatedStartTime: new Date(Date.now() + Math.random() * 3600000).toISOString()
    })
}
