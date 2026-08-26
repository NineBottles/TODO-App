import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Tika — 티켓 칸반 보드',
  description: '티켓 단위로 할일을 관리하는 칸반 보드 To-do App',
};

const RootLayout = ({ children }: { children: React.ReactNode }) => (
  <html lang="ko">
    <body className="h-full antialiased">{children}</body>
  </html>
);

export default RootLayout;
