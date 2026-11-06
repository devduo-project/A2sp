import type React from "react"
import type { Metadata } from "next"
import { Figtree } from "next/font/google"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css"

const figtree = Figtree({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-figtree",
})

export const metadata: Metadata = {
  title: "A2SP · Лиды и сделки",
  description: "CRM рабочего пространства архитектурно-строительной компании A2SP",
  generator: "A2SP CRM",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ru" className={`${figtree.variable} antialiased`}>
      <body className="font-sans">
        {children}
        <Toaster theme="light" position="top-center" />
      </body>
    </html>
  )
}
