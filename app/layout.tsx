import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GetDeck - Master Duel 卡组识别",
  description: "上传Master Duel卡组截图，自动识别卡组内容",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

import { modelPath } from './config';
import { I18nProvider } from './i18n';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <head>
        {/* 预加载 ONNX 模型，加速首次加载 */}
        <link
          rel="preload"
          href={modelPath}
          as="fetch"
          crossOrigin="anonymous"
        />
      </head>
      <body
        className={`${inter.variable} ${geistMono.variable} antialiased`}
      >
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            var l=localStorage.getItem('getdeck-locale');
            if(l&&l!=='zh'){
              var m={'ja':'ja','en':'en'};
              if(m[l])document.documentElement.lang=m[l];
              document.body.style.opacity='0';
              document.body.dataset.i18nHide='1';
            }
          })();
        `}} />
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
