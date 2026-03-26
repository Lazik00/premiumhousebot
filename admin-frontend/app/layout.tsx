import type { Metadata } from 'next';
import './globals.css';
import { AdminAuthProvider } from '../context/AdminAuthContext';

export const metadata: Metadata = {
  title: 'Premium House Admin',
  description: 'Premium House back-office dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz">
      <body>
        <AdminAuthProvider>{children}</AdminAuthProvider>
      </body>
    </html>
  );
}
