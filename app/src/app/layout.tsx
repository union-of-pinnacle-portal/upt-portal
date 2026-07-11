import type { Metadata } from "next";
import { Inter, Bricolage_Grotesque, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SuperTokensProvider } from "@/components/supertokens-provider";

// Body: Inter — clean, highly legible workhorse.
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

// Headings: Bricolage Grotesque — warm, characterful civic display face.
const bricolage = Bricolage_Grotesque({
  variable: "--font-heading",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "UPT Portal",
  description: "Union of Pinnacle Tenants member portal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${bricolage.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SuperTokensProvider>{children}</SuperTokensProvider>
      </body>
    </html>
  );
}
