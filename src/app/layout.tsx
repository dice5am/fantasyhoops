import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppNav } from "@/components/AppNav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FantasyHoops — Team · Players · Insights",
  description:
    "Mix A+C Team workspace, Players week card, Insights Pulse & Briefs",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const htmlClass =
    process.env.NODE_ENV === "production" ? "prod" : undefined;

  return (
    <html lang="en" className={htmlClass}>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <AppNav />
        {children}
      </body>
    </html>
  );
}
