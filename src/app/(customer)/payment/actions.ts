'use server'

import { createClient } from '@/utils/supabase/server'

export async function submitPaymentProof(orderId: string) {
    try {
        const supabase = await createClient()

        const { error } = await supabase
            .from('orders')
            .update({ status: 'pending_confirmation' })
            .eq('id', orderId)

        if (error) {
            console.error('Database update error:', error)
            return { error: error.message }
        }

        return { success: true }
    } catch (err: any) {
        console.error('Server Action Crash:', err)
        return { error: 'Internal Server Error: ' + err.message }
    }
}
