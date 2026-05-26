"use client";
import { SWRConfig } from "swr";

export function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        // Show cached data immediately, then quietly revalidate in background
        revalidateOnFocus: true,
        // Throttle focus revalidation to once every 10 s — prevents rapid-fire
        // requests when the user repeatedly alt-tabs back to the app
        focusThrottleInterval: 10_000,
        revalidateOnReconnect: true,
        // Deduplicate identical requests made within the same 5 s window
        dedupingInterval: 5_000,
        errorRetryCount: 3,
      }}
    >
      {children}
    </SWRConfig>
  );
}
