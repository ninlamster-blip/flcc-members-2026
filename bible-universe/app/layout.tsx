import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title:       'Bible Universe — From Creation to Revelation',
  description: 'An immersive 3D knowledge graph of the entire Bible — people, places, events, prophecies, and doctrines in one interconnected universe.',
  keywords:    ['Bible', 'biblical history', 'knowledge graph', '3D', 'theology', 'church'],
};

export const viewport: Viewport = {
  width:        'device-width',
  initialScale: 1,
  themeColor:   '#020510',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-cosmos-950 text-white overflow-hidden antialiased h-full w-full">
        {children}
      </body>
    </html>
  );
}
