import type { Metadata, Viewport } from 'next';
import './globals.css';
import { I18nProvider } from '@/components/i18n-provider';
import { getLang } from '@/lib/i18n-server';

export const metadata: Metadata = {
  title: 'Arubaito Hours — アルバイト管理',
  description: 'Part-time work hour management for international students at Japanese language schools',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#2563eb' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  return (
    <html lang={lang}>
      <body className="bg-slate-50 font-sans text-slate-900 antialiased">
        <I18nProvider lang={lang}>{children}</I18nProvider>
      </body>
    </html>
  );
}
