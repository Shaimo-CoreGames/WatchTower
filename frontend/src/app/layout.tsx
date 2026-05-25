import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WatchTower | Microservice Performance Hub",
  description: "Production-grade, enterprise-scale uptime and latency telemetry monitor dashboard.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full antialiased">
        {children}
      </body>
    </html>
  );
}