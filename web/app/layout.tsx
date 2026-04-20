import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LinkedIn Poster",
  description: "Queue and manage LinkedIn posts.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}
