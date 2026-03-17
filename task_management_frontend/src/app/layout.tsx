import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Task Organizer Pro",
  description:
    "Task management app with authentication, priorities, due dates, status lanes, and search/filtering.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
