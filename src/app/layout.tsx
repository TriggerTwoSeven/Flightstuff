import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/archivo/wdth.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'ReadyRoute: check a shipment before it ships',
  description:
    'Describe a shipment or upload a spreadsheet. ReadyRoute runs ten customs and carrier checks, explains every problem in plain English and picks the right carrier.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#edeff2' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0e12' },
  ],
};

// Runs before first paint so a saved theme never flashes the wrong colours.
const themeInit = `try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>
        <a className="skip-link" href="#main">Skip to content</a>
        {children}
      </body>
    </html>
  );
}
