import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { inter, playfair } from "@/lib/fonts";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "DevSentinel — AI Code Review & Incident Intelligence",
  description:
    "Catch problems before they ship. Resolve them faster when they do.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
