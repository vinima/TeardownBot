"use client";
// Product analytics with PostHog. Does nothing until you add
// NEXT_PUBLIC_POSTHOG_KEY in your Vercel settings (or .env.local locally).

import posthog from "posthog-js";
import { useEffect } from "react";

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;

export function PostHogInit() {
  useEffect(() => {
    if (!KEY) return;
    posthog.init(KEY, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
      person_profiles: "identified_only",
      capture_pageview: true,
    });
  }, []);
  return null;
}

// Send a named event, e.g. track("question_asked", { pages: 3 }).
export function track(event: string, props?: Record<string, unknown>) {
  if (KEY) posthog.capture(event, props);
}
