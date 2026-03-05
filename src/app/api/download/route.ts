import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic';

/**
 * Server-side proxy for downloading files from Supabase Storage.
 * This bypasses CORS restrictions that prevent direct browser fetch.
 * Usage: GET /api/download?url=<encoded-url>&name=<filename>
 */
export async function GET(req: NextRequest) {
    // Auth check
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return new NextResponse('Unauthorized: Please log in to download models', { status: 401 })
    }

    const url = req.nextUrl.searchParams.get('url')
    const name = req.nextUrl.searchParams.get('name') || 'model.stl'

    if (!url) {
        return new NextResponse('Missing url parameter', { status: 400 })
    }

    // Validate the URL is from our Supabase project (allow trailing slash variations)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (supabaseUrl) {
        const normalizedSupabase = supabaseUrl.replace(/\/*$/, '')
        const normalizedUrl = url.replace(/\/*$/, '')
        if (!normalizedUrl.startsWith(normalizedSupabase)) {
            return new NextResponse('Forbidden: URL not from allowed origin', { status: 403 })
        }
    }

    try {
        const response = await fetch(url)

        if (!response.ok) {
            return new NextResponse(`Failed to fetch file: ${response.status} ${response.statusText}`, { status: response.status })
        }

        const buffer = await response.arrayBuffer()
        const contentType = response.headers.get('content-type') || 'application/octet-stream'

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Type': contentType,
                // Replace both spaces and double quotes with underscores to guarantee the file is downloaded with correct extension and no browser parse issues
                'Content-Disposition': `attachment; filename="${name.replace(/[" ]/g, '_')}"`,
                'Content-Length': buffer.byteLength.toString(),
                'Cache-Control': 'no-cache',
            },
        })
    } catch (err: any) {
        console.error('[/api/download] Error:', err)
        return new NextResponse('Download failed: ' + err.message, { status: 500 })
    }
}
