import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '강의노트 플랫폼',
  description: '대학원 강의 및 세미나 자료 정리 · 필기 플랫폼',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
