import type { Metadata } from "next";
import {
  Geist,
  Geist_Mono,
  Space_Grotesk,
  Bricolage_Grotesque,
} from "next/font/google";
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

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display-alt",
  subsets: ["latin"],
});

const bricolageGrotesque = Bricolage_Grotesque({
  variable: "--font-display",
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
    icon: [
      { url: "/icon.svg?v=2", type: "image/svg+xml" },
    ],
    shortcut: "/icon.svg?v=2",
    apple: "/logo.svg?v=2",
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
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var h=window.location.hash,s=window.location.search;if(h.indexOf("access_token=")!==-1||h.indexOf("error=")!==-1||s.indexOf("code=")!==-1||s.indexOf("token_hash=")!==-1||s.indexOf("error=")!==-1){document.documentElement.setAttribute("data-spar-oauth","1");}document.documentElement.removeAttribute("data-accent");}catch(e){}`,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} ${bricolageGrotesque.variable} antialiased bg-background text-foreground min-h-screen`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
