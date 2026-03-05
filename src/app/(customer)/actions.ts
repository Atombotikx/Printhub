'use server'

import { createClient } from '@/utils/supabase/server'

const SIGNED_URL_TIMEOUT = parseInt(process.env.NEXT_PUBLIC_SIGNED_URL_TIMEOUT_SECONDS || '60')

/**
 * Securely generate a signed URL for a customer's own file.
 * Verifies the logged-in user owns the file by checking path or order ownership.
 * Supports both old paths (userId/...) and new paths (models/userId/...).
 */
export async function getCustomerSignedModelUrl(path: string) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return { data: null, error: 'Unauthorized: You must be logged in' }
        }

        // If the path is already a full URL or blob, verify ownership via order_items
        if (path.startsWith('http') || path.startsWith('blob:')) {
            const { data: items } = await supabase
                .from('order_items')
                .select('id, order_id, orders!inner(user_id)')
                .eq('file_url', path)
                .limit(1)

            const ownsFile = items?.some((item: any) => item.orders?.user_id === user.id)

            if (!ownsFile) {
                return { data: null, error: 'Access denied: You do not own this file' }
            }

            return { data: path, error: null }
        }

        // Check if the file belongs to this user via new path prefix
        const isOwnFile = path.startsWith(`models/${user.id}/`)

        if (!isOwnFile) {
            return { data: null, error: 'Access denied: You do not own this file' }
        }

        const { data, error } = await supabase
            .storage
            .from('prints')
            .createSignedUrl(path, SIGNED_URL_TIMEOUT)

        if (error) throw error
        return { data: data.signedUrl, error: null }
    } catch (err: any) {
        console.error('getCustomerSignedModelUrl error:', err)
        return { data: null, error: err.message }
    }
}

/**
 * Generates a download signed URL for a customer's file.
 * Always returns a fresh signed URL with Content-Disposition: attachment
 * so the browser downloads the file with the correct filename and extension.
 */
export async function getCustomerDownloadUrl(filePath: string, fileName: string) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return { data: null, error: 'Unauthorized: You must be logged in' }
        }

        // Extract storage path from full URL if needed
        let storagePath = filePath
        if (storagePath.startsWith('http')) {
            try {
                const parsed = new URL(storagePath)
                const parts = parsed.pathname.split('/')
                const bucketIdx = parts.indexOf('prints')
                if (bucketIdx !== -1) {
                    storagePath = decodeURIComponent(parts.slice(bucketIdx + 1).join('/'))
                }
            } catch (e) {
                return { data: null, error: 'Invalid file URL' }
            }
        }

        if (storagePath.startsWith('blob:')) {
            return { data: null, error: 'Cannot download from blob URL' }
        }

        // Verify ownership.
        // Downloads only serve ORDERED files, which are always at:
        //   models/{userId}/{orderId}/{filename}
        // The {orderId} segment is a UUID, so we verify the path has at least 3 segments
        // after the bucket root and that the userId segment matches.
        const parts = storagePath.split('/')
        // Expected: ["models", "{userId}", "{orderId}", "{filename}"]
        const isOrderedFile =
            parts.length >= 4 &&
            parts[0] === 'models' &&
            parts[1] === user.id  // userId segment must match

        if (!isOrderedFile) {
            return { data: null, error: 'Access denied: File is not in an ordered state' }
        }

        const { data, error } = await supabase
            .storage
            .from('prints')
            .createSignedUrl(storagePath, SIGNED_URL_TIMEOUT, { download: fileName })

        if (error) throw error
        return { data: data.signedUrl, error: null }
    } catch (err: any) {
        console.error('getCustomerDownloadUrl error:', err)
        return { data: null, error: err.message }
    }
}

import { createClient as createSupabaseCore } from '@supabase/supabase-js'

/**
 * Returns a short-lived signed URL for the payment QR stored in the prints bucket.
 * Uses service role to bypass RLS on storage read.
 * Available only to authenticated customers.
 */
export async function getCustomerPaymentQrSignedUrl() {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return { data: null, error: 'Unauthorized: You must be logged in' }
        }

        const serviceDb = createSupabaseCore(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        const { data, error } = await serviceDb.storage
            .from('prints')
            .createSignedUrl('qrs/payment-qr.png', SIGNED_URL_TIMEOUT)

        if (error) throw error
        return { data: data.signedUrl, error: null }
    } catch (err: any) {
        return { data: null, error: err.message }
    }
}

