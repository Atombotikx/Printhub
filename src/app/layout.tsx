import type { Metadata } from "next";
import "./globals.css";
import AnimatedBackground from "@/components/Background";
import ToastContainer from "@/components/Toast";
import ClientInitializer from "@/components/ClientInitializer";
import SessionTimeout from "@/components/SessionTimeout";

// We use system font stack in globals.css for maximum build stability 
const fontSans = { variable: 'font-sans' };
const fontMono = { variable: 'font-mono' };

export const metadata: Metadata = {
  title: "PrintHub - Industrial 3D Printing",
  description: "Upload STL files and get instant quotes for industrial-grade 3D printing.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${fontSans.variable} ${fontMono.variable}`} suppressHydrationWarning>
        <AnimatedBackground />
        <ClientInitializer />
        <SessionTimeout />
        <ToastContainer />
        {children}
      </body>
    </html>
  );
}
