import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * Root HTML template for Expo Router Web / Telegram Mini App
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="ka">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover, maximum-scale=1, user-scalable=no"
        />
        <title>ARENA</title>
        {/* Telegram WebApp JavaScript SDK */}
        <script src="https://telegram.org/js/telegram-web-app.js"></script>
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
          html, body, #root {
            height: 100%;
            background-color: #120E1C;
            user-select: none;
            -webkit-user-select: none;
            -webkit-touch-callout: none;
            overscroll-behavior: none;
          }
        `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
