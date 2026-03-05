import { createBrowserClient } from '@supabase/ssr'

let client: any = null

export function createClient() {
    // Return existing client if in browser to prevent multiple instances
    if (typeof window !== 'undefined' && client) return client

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
        console.warn('Supabase env variables are missing. Initialization might fail.');
    }

    const newClient = createBrowserClient(
        url || '',
        key || ''
    )

    if (typeof window !== 'undefined') client = newClient
    return newClient
}
