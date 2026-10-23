import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { MotionProvider } from "@/components/app/motion-provider";
import "./globals.css";
import { getI18n } from "@/i18n/server";
import { I18nProvider } from "@/i18n/client";
import { ThemeProvider, THEME_COOKIE, themeScript, type ThemePref } from "@/components/theme/theme";
import { GlassToastProvider } from "@/components/glass/overlays";
import { ConnectivityWatcher } from "@/components/app/connectivity";
import { BRAND } from "@/lib/brand";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin", "latin-ext"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: `${BRAND.name} · ${BRAND.tagline}`, template: `%s · ${BRAND.name}` },
  description: "Conecta futbolistas, clubes, entrenadores, agentes y academias con un matching deportivo transparente.",
  applicationName: BRAND.name,
  appleWebApp: { capable: true, title: BRAND.name, statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }, { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F6F8FA" },
    { media: "(prefers-color-scheme: dark)", color: "#080B10" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { locale, messages } = await getI18n();
  const raw = (await cookies()).get(THEME_COOKIE)?.value;
  const themePref: ThemePref = raw === "light" || raw === "dark" ? raw : "system";

  return (
    <html
      lang={locale}
      data-theme={themePref === "system" ? undefined : themePref}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh">
        <div className="fm-ambient" aria-hidden />
        <div className="fm-grain" aria-hidden />
        <ThemeProvider initial={themePref}>
          <I18nProvider locale={locale} messages={messages}>
            <MotionProvider>
              <GlassToastProvider>
                <ConnectivityWatcher />
                {children}
              </GlassToastProvider>
            </MotionProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
