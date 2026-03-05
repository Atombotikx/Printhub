import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, {
                            ...options,
                            // ── Security hardening for auth cookies ──
                            secure: process.env.NODE_ENV === 'production',
                            sameSite: 'lax',
                        })
                    )
                },
            },
        }
    )

    // IMPORTANT: Avoid writing any logic between createServerClient and
    // supabase.auth.getUser(). A simple mistake could make it very hard to debug
    // issues with users being randomly logged out.

    // Refresh session if expired - required for Server Components
    const { data: { user } } = await supabase.auth.getUser()

    // 1. Protected Routes handling
    const isProtected = ['/admin', '/orders', '/tracking', '/payment', '/settings'].some(path =>
        request.nextUrl.pathname.startsWith(path)
    )

    if (isProtected && !user) {
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        url.searchParams.set('callbackUrl', request.nextUrl.pathname)
        return NextResponse.redirect(url)
    }

    // 2. Admin Only security & Redirects
    const ADMIN_EMAILS_ENV = process.env.NEXT_PUBLIC_ADMIN_EMAILS || process.env.ADMIN_EMAILS || ''
    const ADMINS = ADMIN_EMAILS_ENV.split(',').map(e => e.trim().toLowerCase())
    const isAdmin = user &&
        ADMINS.includes(user.email?.toLowerCase() || '') &&
        user.app_metadata?.provider === 'email'

    // If admin visits Home page, redirect to Admin dashboard immediately (prevent flicker)
    if (request.nextUrl.pathname === '/' && isAdmin) {
        const url = request.nextUrl.clone()
        url.pathname = '/admin'
        return NextResponse.redirect(url)
    }

    if (request.nextUrl.pathname.startsWith('/admin')) {
        if (!isAdmin) {
            const url = request.nextUrl.clone()
            url.pathname = '/'
            return NextResponse.redirect(url)
        }
    }

    return supabaseResponse
}
