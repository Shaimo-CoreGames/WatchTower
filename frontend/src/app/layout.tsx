import type { Metadata } from "next";
import QueryProvider from "@/context/QueryProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "WatchTower | Microservice Performance Hub",
  description: "Production-grade uptime and latency telemetry monitor dashboard.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full antialiased bg-canvas text-text-title">
        <QueryProvider>
          {children}
        </QueryProvider>
      </body>
    </html>
  );
}