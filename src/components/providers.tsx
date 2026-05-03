"use client";

import { Suspense } from "react";

import { PostHogPageView } from "@/components/posthog-pageview";
import { PostHogProvider } from "@/components/posthog-provider";

/**
 * Top-level client providers. Currently wraps the app in PostHog so we can
 * capture pageviews and pageleaves. Server-side data fetching and
 * DrawerProvider stay in the root layout below this boundary.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PostHogProvider>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </PostHogProvider>
  );
}
