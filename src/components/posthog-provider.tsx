"use client";

import posthog from "posthog-js";
import { useEffect } from "react";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window !== "undefined" && !posthog.__loaded) {
      const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
      const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
      if (!token) return; // no-op when token is unset (e.g. local dev without analytics)
      posthog.init(token, {
        api_host: host,
        capture_pageview: false,
        capture_pageleave: true,
      });
    }
  }, []);

  return <>{children}</>;
}
