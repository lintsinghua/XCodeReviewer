import * as React from "react";

import { cn } from "@/shared/utils/utils";

declare global {
  interface Window {
    __dashscopeProxyPatched__?: boolean;
  }
}

const DASH_SCOPE_ORIGIN = "https://dashscope.aliyuncs.com";
const DASH_SCOPE_PROXY_PREFIX = "/dashscope-proxy";

// Ensure dashscope API traffic is routed through the local proxy during development to avoid browser CORS blocks.
if (typeof window !== "undefined" && import.meta.env.DEV) {
  const globalWindow = window as Window;

  if (!globalWindow.__dashscopeProxyPatched__) {
    const originalFetch = window.fetch.bind(window);

    const rewriteUrl = (url: string): string => {
      if (url.startsWith(DASH_SCOPE_PROXY_PREFIX)) return url;

      if (typeof window !== "undefined") {
        const originPrefixed = `${window.location.origin}${DASH_SCOPE_PROXY_PREFIX}`;
        if (url.startsWith(originPrefixed)) {
          return url.slice(window.location.origin.length);
        }
      }

      if (url.startsWith(DASH_SCOPE_ORIGIN)) {
        return url.replace(DASH_SCOPE_ORIGIN, DASH_SCOPE_PROXY_PREFIX);
      }

      return url;
    };

    const rewriteRequestInfo = (input: RequestInfo | URL): RequestInfo => {
      if (typeof input === "string") {
        return rewriteUrl(input);
      }

      if (input instanceof URL) {
        return rewriteUrl(input.toString());
      }

      const rewrittenUrl = rewriteUrl(input.url);
      if (rewrittenUrl === input.url) {
        return input;
      }

      const cloned = input.clone();
      const init: RequestInit = {
        method: cloned.method,
        headers: cloned.headers,
        body:
          cloned.method && ["GET", "HEAD"].includes(cloned.method.toUpperCase())
            ? undefined
            : cloned.body,
        cache: cloned.cache,
        credentials: cloned.credentials,
        integrity: cloned.integrity,
        keepalive: cloned.keepalive,
        mode: cloned.mode,
        redirect: cloned.redirect,
        referrer: cloned.referrer,
        referrerPolicy: cloned.referrerPolicy,
        signal: cloned.signal,
      };

      return new Request(rewrittenUrl, init);
    };

    window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const proxiedInput = rewriteRequestInfo(input);

      if (proxiedInput instanceof Request) {
        return originalFetch(proxiedInput);
      }

      return originalFetch(proxiedInput, init);
    }) as typeof window.fetch;

    globalWindow.__dashscopeProxyPatched__ = true;
  }
}

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6",
        className
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("leading-none font-semibold", className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-6", className)}
      {...props}
    />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center px-6 [.border-t]:pt-6", className)}
      {...props}
    />
  );
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
};
