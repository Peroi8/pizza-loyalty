import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Neapolitan Pizza Club | Ciao Napoli",
  description: "Sammle Punkte bei jedem Einkauf und sichere dir tolle Praemien!",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
