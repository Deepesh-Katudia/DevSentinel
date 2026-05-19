import type { Metadata } from "next";
import { inter, playfair } from "@/lib/fonts";
import { AuthProvider } from "@/components/auth/auth-provider";
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
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
