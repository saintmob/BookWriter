import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig, loadEnv, type Plugin } from 'vite';

/**
 * Adds a browser-side guard for Google AI Studio Build preview sessions.
 *
 * Detection:
 * - Auto-enables when both signals are present:
 *   1. GEMINI_API_KEY exists
 *   2. DISABLE_HMR=true
 *
 * Why both:
 * - GEMINI_API_KEY alone is common in local Gemini projects.
 * - DISABLE_HMR=true alone may be used by hosted preview systems.
 * - Together they are a more specific signal for the AI Studio Build template.
 *
 * What it does:
 * - Keeps the real Vite dev client available so AI Studio startup is not broken.
 * - Prevents Vite's reconnect polling endpoint (`/__vite_ping`) from succeeding
 *   in the browser, so a temporary server disconnect does not turn into a
 *   Vite-driven page reload.
 * - Leaves normal local HMR untouched when the AI Studio signals are absent.
 */
function aiStudioNoAutoreloadGuard(): Plugin {
  const guardScript = `
    (() => {
      if (window.__AI_STUDIO_NO_AUTORELOAD_GUARD__) return;
      window.__AI_STUDIO_NO_AUTORELOAD_GUARD__ = true;

      // 1. Patched fetch for /__vite_ping
      const originalFetch = window.fetch ? window.fetch.bind(window) : null;

      function isVitePing(input) {
        try {
          const rawUrl =
            typeof input === 'string'
              ? input
              : input && typeof input === 'object' && 'url' in input
                ? input.url
                : '';

          const url = new URL(rawUrl, window.location.href);
          return url.pathname.endsWith('/__vite_ping');
        } catch {
          return false;
        }
      }

      const patchedFetch = function patchedFetch(input, init) {
        if (isVitePing(input)) {
          // Keep it pending forever to block reconnect logic
          return new Promise(() => {});
        }
        if (originalFetch) {
          return originalFetch(input, init);
        }
        return Promise.reject(new Error('Fetch not available'));
      };

      try {
        if (window.fetch) {
          window.fetch = patchedFetch;
        } else {
          Object.defineProperty(window, 'fetch', {
            value: patchedFetch,
            configurable: true,
            writable: true
          });
        }
      } catch (e) {
        console.warn('Could not patch window.fetch:', e);
      }

      // 2. Patched WebSocket to swallow HMR protocol and keep connection in virtual OPEN state
      const NativeWebSocket = window.WebSocket;
      if (NativeWebSocket) {
        class MockViteWebSocket {
          constructor(url, protocols) {
            this.url = url;
            this.protocols = protocols;
            this.readyState = 1; // OPEN
            this.binaryType = 'blob';
            this.bufferedAmount = 0;
            this.extensions = '';
            this.protocol = typeof protocols === 'string' ? protocols : (Array.isArray(protocols) ? protocols[0] : '');

            this.onopen = null;
            this.onclose = null;
            this.onerror = null;
            this.onmessage = null;

            this._listeners = {};

            // Dispatch open event after a very short delay to let callers attach listeners
            setTimeout(() => {
              let ev;
              try {
                ev = new Event('open');
              } catch (e) {
                ev = { type: 'open', target: this, currentTarget: this };
              }
              if (typeof this.onopen === 'function') {
                try {
                  this.onopen(ev);
                } catch (err) {
                  console.error('[AI Studio Guard] onopen error:', err);
                }
              }
              this.dispatchEvent(ev);
            }, 10);
          }

          addEventListener(type, listener) {
            if (!this._listeners[type]) {
              this._listeners[type] = [];
            }
            if (this._listeners[type].indexOf(listener) === -1) {
              this._listeners[type].push(listener);
            }
          }

          removeEventListener(type, listener) {
            if (!this._listeners[type]) return;
            this._listeners[type] = this._listeners[type].filter(l => l !== listener);
          }

          dispatchEvent(event) {
            const type = event.type;
            const listeners = this._listeners[type] || [];
            for (const listener of listeners) {
              try {
                if (typeof listener === 'function') {
                  listener.call(this, event);
                } else if (listener && typeof listener.handleEvent === 'function') {
                  listener.handleEvent(event);
                }
              } catch (e) {
                console.error('[AI Studio Guard] listener dispatch error:', e);
              }
            }
            return true;
          }

          send(data) {
            // No-op
          }

          close(code, reason) {
            console.log('[AI Studio Guard] Blocked WebSocket close request:', code, reason);
          }
        }

        try {
          Object.setPrototypeOf(MockViteWebSocket.prototype, NativeWebSocket.prototype);
        } catch (e) {}

        const patchedWebSocket = new Proxy(NativeWebSocket, {
          construct(target, args, newTarget) {
            const [url, protocols] = args;
            const hasViteProtocol = typeof protocols === 'string'
              ? protocols === 'vite-hmr'
              : Array.isArray(protocols)
                ? protocols.includes('vite-hmr')
                : false;

            if (hasViteProtocol) {
              console.log('[AI Studio Guard] Intercepted HMR WebSocket connection for:', url);
              return new MockViteWebSocket(url, protocols);
            }
            return Reflect.construct(target, args, newTarget);
          }
        });

        window.WebSocket = patchedWebSocket;
      }
    })();
  `;

  return {
    name: 'ai-studio-no-autoreload-guard',
    apply: 'serve',
    enforce: 'pre',

    transformIndexHtml: {
      order: 'pre',
      handler() {
        return [
          {
            tag: 'script',
            children: guardScript,
            injectTo: 'head-prepend',
          },
        ];
      },
    },
  };
}

function isTrue(value: unknown): boolean {
  return value === 'true' || value === '1';
}

function isFalse(value: unknown): boolean {
  return value === 'false' || value === '0';
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  const hasGeminiApiKey = Boolean(
    env.GEMINI_API_KEY || process.env.GEMINI_API_KEY,
  );

  const disableHmrRequested =
    isTrue(env.DISABLE_HMR) || isTrue(process.env.DISABLE_HMR);

  const explicitNoAutoreloadEnabled =
    isTrue(env.AI_STUDIO_NO_AUTORELOAD) ||
    isTrue(process.env.AI_STUDIO_NO_AUTORELOAD);

  const explicitNoAutoreloadDisabled =
    isFalse(env.AI_STUDIO_NO_AUTORELOAD) ||
    isFalse(process.env.AI_STUDIO_NO_AUTORELOAD);

  const autoDetectedAiStudioBuild = hasGeminiApiKey && disableHmrRequested;

  const enableAiStudioNoAutoreloadGuard =
    (autoDetectedAiStudioBuild || explicitNoAutoreloadEnabled) &&
    !explicitNoAutoreloadDisabled;

  const disableHmr = disableHmrRequested || enableAiStudioNoAutoreloadGuard;

  return {
    plugins: [
      ...(enableAiStudioNoAutoreloadGuard ? [aiStudioNoAutoreloadGuard()] : []),
      react(),
      tailwindcss(),
    ],

    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY ?? ''),
    },

    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },

    server: {
      host: '0.0.0.0',
      port: 3000,
      strictPort: true,

      ...(disableHmr ? { hmr: false } : {}),

      ...(enableAiStudioNoAutoreloadGuard
        ? {
            watch: {
              ignored: [
                '**/.git/**',
                '**/node_modules/**',
                '**/dist/**',
                '**/.vite/**',
                '**/.cache/**',
                '**/*.log',
                '**/.aistudio/**',
                '**/.gemini/**',
              ],
            },
          }
        : {}),
    },
  };
});