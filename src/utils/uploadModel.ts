import { createClient } from '@/utils/supabase/client'

export const uploadModelToStorage = async (file: File) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return 'unauthenticated'
    }

    // NOTE: We upload the model BEFORE checkout, so we don't have an orderId yet.
    // The link between this file and an order is stored in the database (order_items.file_url).

    // Keep the original filename, just sanitize special characters (spaces → underscores etc.)
    const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')

    // Final path:  models/{userId}/{filename}.stl
    // Example:     models/abc123/Top_Cover.stl
    const filePath = `models/${user.id}/${cleanName}`

    const { data, error } = await supabase
        .storage
        .from('prints')
        .upload(filePath, file, {
            cacheControl: process.env.NEXT_PUBLIC_STORAGE_CACHE_CONTROL_SECONDS || '3600',
            upsert: false // Fails if same filename already exists for this user
        })

    if (error) throw error

    // Return the RELATIVE PATH — signed URLs are generated on-demand in server actions.
    return filePath
}
