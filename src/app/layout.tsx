import type { Metadata } from 'next';
import { Inspector } from 'react-dev-inspector';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Gemini API 中转站',
    template: '%s | Gemini API 中转站',
  },
  description:
    'Gemini API 中转站聚合管理系统，支持多站点账号聚合、余额监控、智能调度和用户 Key 分发。',
  keywords: [
    'Gemini API',
    'API 中转站',
    '余额监控',
    '智能调度',
    'Key 分发',
    'API 代理',
  ],
  authors: [{ name: 'Gemini Proxy Team' }],
  openGraph: {
    title: 'Gemini API 中转站',
    description:
      'Gemini API 中转站聚合管理系统，支持多站点账号聚合、余额监控、智能调度和用户 Key 分发。',
    siteName: 'Gemini API 中转站',
    locale: 'zh_CN',
    type: 'website',
  },
  // twitter: {
  //   card: 'summary_large_image',
  //   title: 'Coze Code | Your AI Engineer is Here',
  //   description:
  //     'Build and deploy full-stack applications through AI conversation. No env setup, just flow.',
  //   // images: [''],
  // },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDev = process.env.COZE_PROJECT_ENV === 'DEV';

  return (
    <html lang="en">
      <body className={`antialiased`}>
        {isDev && <Inspector />}
        {children}
      </body>
    </html>
  );
}
