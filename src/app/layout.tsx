import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Spar — The sparring room for your next big moment",
  description:
    "Enter a room with AI personas who challenge you, interrupt you, and probe your weak spots. Then get coached — not scored, but developed. Over time, Spar learns your patterns and builds you toward the real room.",
  keywords: [
    "presentation practice",
    "pitch practice",
    "thesis defense",
    "AI coach",
    "sparring",
    "communication training",
  ],
  authors: [{ name: "Spar" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "Spar — The sparring room for your next big moment",
    description:
      "Practice defending your ideas under live AI pressure. Get coached, not scored.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground min-h-screen`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
