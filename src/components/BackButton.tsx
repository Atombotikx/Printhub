'use client'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface BackButtonProps {
    href?: string;
    fallback?: string;
}

export default function BackButton({ href, fallback = '/' }: BackButtonProps) {
    const router = useRouter();

    const handleClick = (e: React.MouseEvent) => {
        if (href) return;
        e.preventDefault();

        // If we have history, try going back. history.length > 1 indicates there is a previous page in this session.
        if (typeof window !== 'undefined' && window.history.length > 1) {
            router.back();
        } else {
            router.push(fallback);
        }
    }

    const content = (
        <div
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'white',
                cursor: 'pointer',
                transition: 'all 0.2s',
                outline: 'none',
                padding: 0
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.transform = 'none' }}
            title="Go Back"
        >
            <ArrowLeft size={20} />
        </div>
    )

    if (href) {
        return <Link href={href} style={{ textDecoration: 'none' }}>{content}</Link>
    }

    return <div onClick={handleClick} style={{ display: 'inline-block' }}>{content}</div>;
}
