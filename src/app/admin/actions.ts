'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

const SIGNED_URL_TIMEOUT = parseInt(process.env.NEXT_PUBLIC_SIGNED_URL_TIMEOUT_SECONDS || '60')

async function checkAdmin() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const ADMIN_EMAILS_ENV = process.env.ADMIN_EMAILS || process.env.NEXT_PUBLIC_ADMIN_EMAILS || ''
    const ADMINS = ADMIN_EMAILS_ENV.split(',').map(e => e.trim().toLowerCase())

    if (!user || !ADMINS.includes(user.email?.toLowerCase() || '') || user.app_metadata?.provider !== 'email') {
        throw new Error('Unauthorized: Admin access required via standard login')
    }
    return supabase
}

import { createClient as createSupabaseCore } from '@supabase/supabase-js'

export async function getAdminDb() {
    await checkAdmin()
    return createSupabaseCore(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

/**
 * Utility to get a Supabase client with Service Role.
 * WARNING: This bypasses RLS. Only use this server-side after manual validation.
 */
export async function getServiceDb() {
    return createSupabaseCore(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}


export async function isCurrentUserAdmin() {
    try {
        await checkAdmin()
        return true
    } catch {
        return false
    }
}

export async function getAdminStats() {
    try {
        const supabase = await checkAdmin()
        const { data, error } = await supabase
            .from('orders')
            .select('*, order_items(*)')
            .order('created_at', { ascending: false })

        if (error) throw error
        return { data, error: null }
    } catch (err: any) {
        console.error('getAdminStats error:', err)
        return { data: null, error: err.message === 'Unauthorized: Admin access required' ? 'Unauthorized' : 'Failed to fetch stats' }
    }
}

export async function getAdminOrders() {
    try {
        const supabase = await checkAdmin()
        // Try simple join first, be explicit with columns if needed
        const { data, error } = await supabase
            .from('orders')
            .select('*, order_items(*), user_details(full_name, phone)')
            .order('created_at', { ascending: false })

        if (error) {
            console.error('getAdminOrders query error:', error)
            return { data: null, error: 'Failed to fetch orders' }
        }
        return { data, error: null }
    } catch (err: any) {
        console.error('getAdminOrders catch error:', err)
        return { data: null, error: err.message === 'Unauthorized: Admin access required' ? 'Unauthorized' : 'Failed to fetch orders' }
    }
}

export async function updateOrderAdmin(orderId: string, updates: any) {
    try {
        const supabase = await checkAdmin()
        const { error } = await supabase
            .from('orders')
            .update(updates)
            .eq('id', orderId)

        if (error) throw error
        revalidatePath('/admin/orders')
        revalidatePath('/tracking')
        return { success: true, error: null }
    } catch (err: any) {
        console.error('updateOrderAdmin error:', err)
        return { success: false, error: err.message === 'Unauthorized: Admin access required via standard login' ? 'Unauthorized' : 'Update failed' }
    }
}

export async function addPrinterAdmin(printer: any) {
    try {
        const db = await getAdminDb()
        const { error } = await db.from('printers').insert(printer)
        if (error) throw error
        return { success: true, error: null }
    } catch (err: any) {
        console.error('addPrinterAdmin error:', err)
        return { success: false, error: err.message }
    }
}

export async function updatePrinterAdmin(id: string, updates: any) {
    try {
        const db = await getAdminDb()
        const { error } = await db.from('printers').update(updates).eq('id', id)
        if (error) throw error
        return { success: true, error: null }
    } catch (err: any) {
        console.error('updatePrinterAdmin error:', err)
        return { success: false, error: err.message }
    }
}

export async function deletePrinterAdmin(id: string) {
    try {
        const db = await getAdminDb()
        const { error } = await db.from('printers').delete().eq('id', id)
        if (error) throw error
        return { success: true, error: null }
    } catch (err: any) {
        console.error('deletePrinterAdmin error:', err)
        return { success: false, error: err.message }
    }
}

export async function addMaterialAdmin(material: any) {
    try {
        const db = await getAdminDb()
        const { error } = await db.from('materials').insert(material)
        if (error) throw error
        return { success: true, error: null }
    } catch (err: any) {
        console.error('addMaterialAdmin error:', err)
        return { success: false, error: err.message }
    }
}

export async function updateMaterialAdmin(key: string, updates: any) {
    try {
        const db = await getAdminDb()
        const { error } = await db.from('materials').update(updates).eq('key', key)
        if (error) throw error
        return { success: true, error: null }
    } catch (err: any) {
        console.error('updateMaterialAdmin error:', err)
        return { success: false, error: err.message }
    }
}

export async function deleteMaterialAdmin(key: string) {
    try {
        const db = await getAdminDb()
        const { error } = await db.from('materials').delete().eq('key', key)
        if (error) throw error
        return { success: true, error: null }
    } catch (err: any) {
        console.error('deleteMaterialAdmin error:', err)
        return { success: false, error: err.message }
    }
}

export async function addMaterialTypeAdmin(type: any) {
    try {
        const db = await getAdminDb()
        const { error } = await db.from('material_types').insert(type)
        if (error) throw error
        return { success: true, error: null }
    } catch (err: any) {
        console.error('addMaterialTypeAdmin error:', err)
        return { success: false, error: err.message }
    }
}

export async function deleteMaterialTypeAdmin(name: string) {
    try {
        const db = await getAdminDb()
        const { error } = await db.from('material_types').delete().eq('name', name)
        if (error) throw error
        return { success: true, error: null }
    } catch (err: any) {
        console.error('deleteMaterialTypeAdmin error:', err)
        return { success: false, error: err.message }
    }
}

export async function addSupportTypeAdmin(name: string) {
    try {
        const db = await getAdminDb()
        const { error } = await db.from('support_types').insert({ name })
        if (error) throw error
        return { success: true, error: null }
    } catch (err: any) {
        console.error('addSupportTypeAdmin error:', err)
        return { success: false, error: err.message }
    }
}

export async function deleteSupportTypeAdmin(name: string) {
    try {
        const db = await getAdminDb()
        const { error } = await db.from('support_types').delete().eq('name', name)
        if (error) throw error
        return { success: true, error: null }
    } catch (err: any) {
        console.error('deleteSupportTypeAdmin error:', err)
        return { success: false, error: err.message }
    }
}



export async function getAdminFinancials() {
    try {
        const supabase = await checkAdmin()
        const { data, error } = await supabase
            .from('orders')
            .select('total_amount, shipping_cost, status')

        if (error) throw error

        const completedOrders = data?.filter(o => o.status !== 'cancelled') || []
        const totalRevenue = completedOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0)

        // Simple heuristic for profit if not explicitly tracked
        const estimatedProfit = totalRevenue * 0.4

        return { data: { totalRevenue, estimatedProfit }, error: null }
    } catch (err: any) {
        console.error('getAdminFinancials error:', err)
        return { data: null, error: err.message === 'Unauthorized: Admin access required' ? 'Unauthorized' : 'Failed to fetch financials' }
    }
}

export async function getAdminOrderById(orderId: string) {
    try {
        const supabase = await checkAdmin()
        // Removed profiles(*) join temporarily to diagnose loading failures
        const { data, error } = await supabase
            .from('orders')
            .select('*, order_items(*), user_details(full_name, phone)')
            .eq('id', orderId)
            .single()

        if (error) {
            console.error('getAdminOrderById query error:', error)
            return { data: null, error: 'Order not found' }
        }
        return { data, error: null }
    } catch (err: any) {
        console.error('getAdminOrderById catch error:', err)
        return { data: null, error: err.message === 'Unauthorized: Admin access required' ? 'Unauthorized' : 'Fetch failed' }
    }
}

export async function adminHandleReturnRequest(orderId: string, status: string, note: string) {
    try {
        const supabase = await checkAdmin()
        const { error } = await supabase
            .from('orders')
            .update({
                status: status, // 'returned' or 'return_refused'
                admin_return_note: note
            })
            .eq('id', orderId)

        if (error) throw error
        revalidatePath(`/admin/orders/${orderId}`)
        revalidatePath('/tracking')
        return { success: true, error: null }
    } catch (err: any) {
        console.error('adminHandleReturnRequest error:', err)
        return { success: false, error: err.message === 'Unauthorized: Admin access required' ? 'Unauthorized' : 'Request failed' }
    }
}


export async function getSiteConfig(key: string) {
    try {
        const supabase = await createClient()
        const { data, error } = await supabase
            .from('site_config')
            .select('value')
            .eq('key', key)
            .single()

        if (error) {
            if (error.code === 'PGRST116') return { data: null, error: null }
            throw error
        }

        let parsed = data.value
        if (typeof data.value === 'string') {
            try {
                parsed = JSON.parse(data.value)
            } catch {
                parsed = data.value
            }
        }

        return { data: parsed, error: null }
    } catch (err: any) {
        return { data: null, error: err.message }
    }
}

export async function updateSiteConfig(key: string, value: any) {
    try {
        const supabase = await checkAdmin()
        const { error } = await supabase
            .from('site_config')
            .upsert({
                key,
                value: typeof value === 'object' ? JSON.stringify(value) : value,
                updated_at: new Date().toISOString()
            }, { onConflict: 'key' })

        if (error) throw error
        revalidatePath('/')
        return { success: true, error: null }
    } catch (err: any) {
        console.error('updateSiteConfig error:', err)
        return { success: false, error: err.message === 'Unauthorized: Admin access required' ? 'Unauthorized' : 'Update failed' }
    }
}

export async function getSignedModelUrl(path: string) {
    try {
        // Use admin client (service role) to bypass storage RLS
        const supabase = await getAdminDb()

        // Check if path is already a full URL
        if (path.startsWith('http')) {
            return { data: path, error: null }
        }

        const { data, error } = await supabase
            .storage
            .from('prints')
            .createSignedUrl(path, SIGNED_URL_TIMEOUT)

        if (error) throw error
        return { data: data.signedUrl, error: null }
    } catch (err: any) {
        console.error('getSignedModelUrl error for path:', path, err)
        return { data: null, error: err.message }
    }
}

/**
 * Generates a short-lived signed URL for admin file download.
 * Always creates a fresh signed URL with Content-Disposition: attachment
 * so the browser downloads the file with the correct filename and extension.
 * Handles both storage paths and full HTTP URLs.
 */
export async function getAdminDownloadUrl(filePath: string, fileName: string) {
    try {
        const supabase = await getAdminDb()

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

        // Generate signed URL with Content-Disposition: attachment; filename="..."
        // This forces the browser to save the file with the correct filename
        const { data, error } = await supabase
            .storage
            .from('prints')
            .createSignedUrl(storagePath, SIGNED_URL_TIMEOUT, { download: fileName })

        if (error) throw error
        return { data: data.signedUrl, error: null }
    } catch (err: any) {
        console.error('getAdminDownloadUrl error for path:', filePath, err)
        return { data: null, error: err.message }
    }
}


export async function getAdminTestimonials() {
    try {
        const supabase = await checkAdmin()
        const { data, error } = await supabase
            .from('testimonials')
            .select('*')
            .order('created_at', { ascending: false })

        if (error) throw error
        return { data, error: null }
    } catch (err: any) {
        return { data: null, error: err.message }
    }
}

export async function getApprovedTestimonials() {
    try {
        const supabase = await createClient()
        const { data, error } = await supabase
            .from('testimonials')
            .select('*')
            .eq('is_approved', true)
            .order('created_at', { ascending: false })

        if (error) throw error
        return { data, error: null }
    } catch (err: any) {
        return { data: null, error: err.message }
    }
}

export async function updateTestimonialAdmin(id: string, updates: any) {
    try {
        const supabase = await checkAdmin()
        const { error } = await supabase
            .from('testimonials')
            .update(updates)
            .eq('id', id)

        if (error) throw error
        revalidatePath('/')
        return { success: true, error: null }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function deleteTestimonialAdmin(id: string) {
    try {
        const supabase = await checkAdmin()
        const { error } = await supabase
            .from('testimonials')
            .delete()
            .eq('id', id)

        if (error) throw error
        revalidatePath('/')
        return { success: true, error: null }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function submitUserTestimonial(testimonial: any) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) throw new Error('You must be logged in to submit a review')

        // Basic validation
        if (!testimonial.quote || testimonial.quote.length > 500) {
            throw new Error('Review must be between 1 and 500 characters')
        }

        // ── Spam guard: one pending/approved review per user ──
        const { data: existing } = await supabase
            .from('testimonials')
            .select('id')
            .eq('user_id', user.id)
            .limit(1)
        if (existing && existing.length > 0) {
            throw new Error('You have already submitted a review. Please contact support to update it.')
        }

        const { data, error } = await supabase
            .from('testimonials')
            .insert({
                user_id: user.id,
                name: testimonial.name,
                role: testimonial.role || 'Customer',
                quote: testimonial.quote,
                rating: testimonial.rating || 5,
                initials: testimonial.initials,
                is_approved: false // Requires admin moderation
            })
            .select()

        if (error) throw error
        return { success: true, data, error: null }
    } catch (err: any) {
        return { success: false, data: null, error: err.message }
    }
}

export async function cancelUserOrder(orderId: string) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) throw new Error('Unauthorized')

        const { error } = await supabase
            .from('orders')
            .update({ status: 'cancelled' })
            .eq('id', orderId)
            .eq('user_id', user.id) // Ensure ownership

        if (error) throw error
        revalidatePath('/tracking')
        revalidatePath('/orders')
        return { success: true, error: null }
    } catch (err: any) {
        console.error('cancelUserOrder error:', err)
        return { success: false, error: 'Failed to cancel order' }
    }
}

export async function submitReturnRequest(orderId: string, reason: string, urls: string[]) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) throw new Error('Unauthorized')

        const { error } = await supabase
            .from('orders')
            .update({
                status: 'return_requested',
                return_reason: reason,
                return_evidence_urls: urls
            })
            .eq('id', orderId)
            .eq('user_id', user.id) // Ensure ownership

        if (error) throw error
        revalidatePath('/tracking')
        return { success: true, error: null }
    } catch (err: any) {
        console.error('submitReturnRequest error:', err)
        return { success: false, error: 'Failed to submit return request' }
    }
}




export async function getAdminPaymentProofUrl(orderId: string, userId: string) {
    try {
        const supabase = await getAdminDb()
        // New path: payments/{userId}/{orderId}/proof.{ext}
        const folder = `payments/${userId}/${orderId}`

        const { data: files, error } = await supabase.storage
            .from('prints')
            .list(folder)

        if (error) throw error

        if (files && files.length > 0) {
            const proofFile = files[0] // There's always one proof per order folder
            const { data, error: signedError } = await supabase.storage
                .from('prints')
                .createSignedUrl(`${folder}/${proofFile.name}`, SIGNED_URL_TIMEOUT)

            if (signedError) throw signedError
            return { data: `${data.signedUrl}&t=${Date.now()}`, error: null }
        }
        return { data: null, error: 'No proof found' }
    } catch (err: any) {
        console.error('getAdminPaymentProofUrl error:', err)
        return { data: null, error: err.message }
    }
}

export async function getAdminReturnEvidenceUrls(orderId: string, userId: string) {
    try {
        const supabase = await getAdminDb()
        // New path: returns/{userId}/{orderId}/
        const folder = `returns/${userId}/${orderId}`

        const { data: files, error } = await supabase.storage
            .from('prints')
            .list(folder)

        if (error) throw error

        if (files && files.length > 0) {
            const signedUrlPromises = files.map(async (file) => {
                const { data, error: signedError } = await supabase.storage
                    .from('prints')
                    .createSignedUrl(`${folder}/${file.name}`, SIGNED_URL_TIMEOUT)

                if (signedError) throw signedError
                return data.signedUrl
            })

            const signedUrls = await Promise.all(signedUrlPromises)
            return { data: signedUrls, error: null }
        }

        return { data: [], error: null }
    } catch (err: any) {
        console.error('getAdminReturnEvidenceUrls error:', err)
        return { data: null, error: err.message }
    }
}

/**
 * Uploads the global Payment QR image using the service role key.
 * The anon client cannot write to this path due to RLS — must use service role.
 * Stored at: prints/payments/payment-qr.png
 */
export async function uploadPaymentQrAdmin(formData: FormData) {
    try {
        const supabase = await getAdminDb() // Service role — bypasses RLS
        const file = formData.get('file') as File
        if (!file) throw new Error('No file provided')

        if (file.size > 5 * 1024 * 1024) throw new Error('File too large (max 5MB)')

        const filePath = 'qrs/payment-qr.png'

        // Delete existing first to avoid upsert flakes
        await supabase.storage.from('prints').remove([filePath])

        const arrayBuffer = await file.arrayBuffer()
        const { error: uploadError } = await supabase.storage
            .from('prints')
            .upload(filePath, arrayBuffer, {
                contentType: file.type || 'image/png',
                cacheControl: '0',
                upsert: true
            })

        if (uploadError) throw uploadError
        return { success: true, error: null }
    } catch (err: any) {
        console.error('uploadPaymentQrAdmin error:', err)
        return { success: false, error: err.message }
    }
}

/**
 * Returns a short-lived signed URL for the payment QR stored in the prints bucket.
 * Uses service role to bypass RLS on storage read.
 */
export async function getPaymentQrSignedUrl() {
    try {
        const supabase = await getAdminDb()
        const { data, error } = await supabase.storage
            .from('prints')
            .createSignedUrl('qrs/payment-qr.png', SIGNED_URL_TIMEOUT)
        if (error) throw error
        return { data: data.signedUrl, error: null }
    } catch (err: any) {
        return { data: null, error: err.message }
    }
}

