import type { Metadata } from "next";
import { inter, playfair } from "@/lib/fonts";
import { AuthProvider } from "@/components/auth/auth-provider";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "DevSentinel — AI Code Review & Incident Intelligence",
  description:
    "Catch problems before they ship. Resolve them faster when they do.",
  icons: {
    icon: [
      { url: "/devsentinel-favicon-256.png", sizes: "256x256", type: "image/png" },
    ],
    apple: [
      { url: "/devsentinel-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/devsentinel-favicon-256.png",
  },
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
