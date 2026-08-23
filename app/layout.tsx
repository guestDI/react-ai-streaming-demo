import type { Metadata } from 'next';
import type { ReactNode } from 'react';
// @ts-ignore: allow importing CSS without type declarations in this demo
import './styles.css';

export const metadata: Metadata = {
  title: 'React AI Streaming Demo',
  description: 'Stream an OpenAI response through Next.js into React.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
