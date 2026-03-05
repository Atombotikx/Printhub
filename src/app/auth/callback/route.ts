import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const redirectTo = searchParams.get('redirectTo') || searchParams.get('callbackUrl') || '/'

    if (code) {
        const supabase = await createClient()
        const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
            return NextResponse.redirect(`${origin}/auth/auth-code-error?error=${encodeURIComponent(error.code || 'auth_error')}&error_description=${encodeURIComponent(error.message)}`)
        } else {
            const forwardedHost = request.headers.get('x-forwarded-host')
            const isLocalEnv = process.env.NODE_ENV === 'development'

            // Check if user is admin to redirect to /admin instead of redirectTo
            const ADMIN_EMAILS_ENV = process.env.ADMIN_EMAILS || process.env.NEXT_PUBLIC_ADMIN_EMAILS || ''
            const ADMINS = ADMIN_EMAILS_ENV.split(',').map(e => e.trim().toLowerCase())
            const userEmail = sessionData.user?.email?.toLowerCase() || ''
            const provider = sessionData.user?.app_metadata?.provider
            const isAdmin = ADMINS.includes(userEmail) && provider === 'email'

            const finalNext = (redirectTo === '/' && isAdmin) ? '/admin' : redirectTo
            const redirectPath = finalNext.startsWith('/') ? finalNext : `/${finalNext}`

            if (isLocalEnv) {
                return NextResponse.redirect(`${origin}${redirectPath}`)
            } else if (forwardedHost) {
                return NextResponse.redirect(`https://${forwardedHost}${redirectPath}`)
            } else {
                return NextResponse.redirect(`${origin}${redirectPath}`)
            }
        }
    }

    const errorCode = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')
    if (errorCode || errorDescription) {
        return NextResponse.redirect(`${origin}/auth/auth-code-error?error=${encodeURIComponent(errorCode || 'unknown')}&error_description=${encodeURIComponent(errorDescription || 'An error occurred')}`)
    }

    // return the user to an error page with instructions
    return NextResponse.redirect(`${origin}/auth/auth-code-error?error=no_code&error_description=No+authorization+code+was+provided`)
}
