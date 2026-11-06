import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ReachInbox — Email Scheduler',
  description: 'Production-grade email job scheduler powered by BullMQ. Schedule, track and manage email campaigns at scale.',
  keywords: ['email scheduler', 'BullMQ', 'ReachInbox', 'email campaign'],
  authors: [{ name: 'ReachInbox' }],
  openGraph: {
    title: 'ReachInbox — Email Scheduler',
    description: 'Schedule and send emails at scale with real-time queue visibility',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
