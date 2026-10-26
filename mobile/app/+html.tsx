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
        <meta name="theme-color" content="#0b0716" />
        <meta name="color-scheme" content="dark" />
        {/* Telegram WebApp JavaScript SDK */}
        <script src="https://telegram.org/js/telegram-web-app.js"></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
          try {
            if (window.Telegram && window.Telegram.WebApp) {
              window.Telegram.WebApp.ready();
              window.Telegram.WebApp.expand();
              window.Telegram.WebApp.setHeaderColor('#0b0716');
              window.Telegram.WebApp.setBackgroundColor('#0b0716');
            }
          } catch (e) {}
        `,
          }}
        />
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
          html, body, #root {
            height: 100%;
            background-color: #0b0716 !important;
            user-select: none;
            -webkit-user-select: none;
            -webkit-touch-callout: none;
            overscroll-behavior: none;
          }
          .arena-loader-wrap {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: #0b0716;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 999999;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            box-sizing: border-box;
          }
          .arena-loader-halo {
            position: absolute;
            width: 260px;
            height: 260px;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(16, 185, 129, 0.22) 0%, rgba(139, 92, 246, 0.14) 45%, transparent 70%);
            animation: arenaHaloPulse 2s ease-in-out infinite;
          }
          .arena-bottle-box {
            position: relative;
            width: 140px;
            height: 140px;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: arenaBottleSpin 1.8s linear infinite;
            transform-origin: center center;
          }
          .arena-bottle {
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
          }
          .arena-pointer-tip {
            width: 0;
            height: 0;
            border-left: 6px solid transparent;
            border-right: 6px solid transparent;
            border-bottom: 9px solid #F59E0B;
            margin-bottom: 2px;
          }
          .arena-foil-cap {
            width: 14px;
            height: 16px;
            background-color: #D97706;
            border-top-left-radius: 4px;
            border-top-right-radius: 4px;
            border: 1px solid #F59E0B;
            position: relative;
            box-sizing: border-box;
          }
          .arena-foil-ring {
            position: absolute;
            top: 4px;
            left: 0;
            right: 0;
            height: 3px;
            background-color: #FEF08A;
          }
          .arena-neck {
            width: 13px;
            height: 18px;
            background-color: #064e3b;
            border: 0.8px solid rgba(16, 185, 129, 0.45);
            box-sizing: border-box;
          }
          .arena-shoulders {
            width: 36px;
            height: 12px;
            border-top-left-radius: 12px;
            border-top-right-radius: 12px;
            background-color: #04382a;
            border: 0.8px solid rgba(16, 185, 129, 0.35);
            box-sizing: border-box;
          }
          .arena-body {
            width: 42px;
            height: 56px;
            background-color: #022c22;
            border-bottom-left-radius: 10px;
            border-bottom-right-radius: 10px;
            border: 1.2px solid rgba(16, 185, 129, 0.4);
            position: relative;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.6);
            box-sizing: border-box;
          }
          .arena-glass-sheen {
            position: absolute;
            left: 4px;
            top: 0;
            bottom: 0;
            width: 3.5px;
            background: rgba(255, 255, 255, 0.4);
            border-radius: 2px;
          }
          .arena-glass-secondary {
            position: absolute;
            right: 4px;
            top: 0;
            bottom: 0;
            width: 2px;
            background: rgba(255, 255, 255, 0.18);
            border-radius: 1px;
          }
          .arena-label {
            width: 30px;
            padding: 2.5px 0;
            background-color: #18181b;
            border-radius: 3px;
            border: 1px solid #D97706;
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
            box-sizing: border-box;
          }
          .arena-label-brand {
            font-size: 7px;
            font-weight: 900;
            color: #F59E0B;
            letter-spacing: 0.8px;
            line-height: 8px;
          }
          .arena-label-divider {
            width: 18px;
            height: 0.8px;
            background-color: #D97706;
            margin: 1px 0;
          }
          .arena-label-vip {
            font-size: 6px;
            font-weight: 800;
            color: #FEF08A;
            letter-spacing: 0.5px;
            line-height: 7px;
          }
          .arena-loader-text {
            margin-top: 24px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
          }
          .arena-brand-text {
            font-size: 24px;
            font-weight: 900;
            color: #F59E0B;
            letter-spacing: 5px;
            text-shadow: 0 2px 10px rgba(245, 158, 11, 0.4);
          }
          .arena-status-text {
            font-size: 14px;
            font-weight: 600;
            color: #DDD6FE;
            letter-spacing: 0.5px;
            animation: arenaTextPulse 1.6s ease-in-out infinite;
          }
          @keyframes arenaBottleSpin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes arenaHaloPulse {
            0%, 100% { transform: scale(0.92); opacity: 0.45; }
            50% { transform: scale(1.1); opacity: 0.95; }
          }
          @keyframes arenaTextPulse {
            0%, 100% { opacity: 0.6; }
            50% { opacity: 1; }
          }
        `,
          }}
        />
      </head>
      <body style={{ backgroundColor: '#0b0716', margin: 0 }}>{children}</body>
    </html>
  );
}
