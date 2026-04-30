import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "Slotly — Book local services instantly",
  description:
    "Find barbers, salons, and beauty professionals available now near you. Real-time booking.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
