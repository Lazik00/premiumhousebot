import type { Metadata, Viewport } from 'next';
import { AuthProvider } from '@/context/AuthContext';
import './globals.css';

export const metadata: Metadata = {
    title: 'Premium House — Ijaraga Uylar',
    description: "O'zbekistondagi eng yaxshi uylar va villalarni toping. Premium House bilan ijaraga uy topish oson!",
    robots: 'noindex, nofollow',
};

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: 'cover',
    themeColor: '#0f0f14',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="uz" suppressHydrationWarning>
            <head>
                <script src="https://telegram.org/js/telegram-web-app.js" defer />
            </head>
            <body>
                <AuthProvider>
                    {children}
                </AuthProvider>
            </body>
        </html>
    );
}
