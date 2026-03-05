import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const next = searchParams.get('next') ?? '/'

    if (code) {
        const supabase = await createClient()
        const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
            return NextResponse.redirect(`${origin}/auth/auth-code-error?error=${encodeURIComponent(error.code || 'auth_error')}&error_description=${encodeURIComponent(error.message)}`)
        } else {
            const forwardedHost = request.headers.get('x-forwarded-host')
            const isLocalEnv = process.env.NODE_ENV === 'development'
            if (isLocalEnv) {
                return NextResponse.redirect(`${origin}${next}`)
            } else if (forwardedHost) {
                return NextResponse.redirect(`https://${forwardedHost}${next}`)
            } else {
                return NextResponse.redirect(`${origin}${next}`)
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
