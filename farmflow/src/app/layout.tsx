import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FarmFlow — Multi-Branch Chicken Shop Management",
  description:
    "Simple, reliable multi-branch chicken retail shop management system for tracking dispatches, retail sales, expenses, stock, and profit.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className="min-h-full bg-[#F7F9FA] text-[#17212B] flex flex-col font-sans"
      >
        {children}
      </body>
    </html>
  );
}
