import type { Metadata } from "next";
import "./globals.css";
import { JsonLd } from "./json-ld";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata();

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <JsonLd />
        {children}
      </body>
    </html>
  );
}
