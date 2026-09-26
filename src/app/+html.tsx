/**
 * Web-only root HTML document (Expo Router).
 *
 * Sets the demo's metadata and locks the page so the browser itself never
 * scrolls — the app scrolls inside its own views (and, on desktop, inside the
 * phone shell). This file only affects the web build; native is untouched.
 */

import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

const BODY_RESET = `
  html, body, #root { height: 100%; }
  body { margin: 0; background-color: #FAFAF8; overflow: hidden; }
  * { -webkit-tap-highlight-color: transparent; }
`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover"
        />
        <title>Ledger — Interactive Demo</title>
        <meta
          name="description"
          content="Interactive demo of Ledger, a React Native personal expense tracker."
        />
        <meta property="og:title" content="Ledger — Interactive Demo" />
        <meta
          property="og:description"
          content="Interactive demo of Ledger, a React Native personal expense tracker."
        />

        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: BODY_RESET }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
