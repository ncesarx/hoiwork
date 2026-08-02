import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Home & Office Tech Solutions",
    template: "%s | Home & Office"
  },
  description: "Parceria em soluções de infraestrutura, cloud, segurança e suporte para sua empresa.",
  metadataBase: new URL("https://homeoffice.com.br")
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html data-theme="dark" lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
