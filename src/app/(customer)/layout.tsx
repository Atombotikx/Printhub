import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import DbConnectionGuard from "@/components/DbConnectionGuard";
import { Suspense } from "react";

export default function CustomerLayout({
    children,
}: {
    readonly children: React.ReactNode;
}) {
    return (
        <>
            <Suspense fallback={null}>
                <Navbar />
            </Suspense>
            <DbConnectionGuard>
                <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ flex: 1 }}>{children}</div>
                    <Footer />
                </main>
            </DbConnectionGuard>
        </>
    );
}
