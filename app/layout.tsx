import type { Metadata } from "next";
import "./globals.css";
import { PostHogInit } from "./posthog";

export const metadata: Metadata = {
  title: "Teardown Bot",
  description: "Ask positioning questions about any developer tool, answered from its own pages.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PostHogInit />
        {children}
      </body>
    </html>
  );
}
