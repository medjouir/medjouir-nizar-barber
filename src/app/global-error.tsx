"use client";

import "./globals.css";

/** Last-resort error screen when the root layout itself fails. */
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="ary-Latn" dir="ltr">
      <body className="grid min-h-dvh place-items-center bg-canvas px-page text-fg">
        <div className="w-full max-w-md">
          <h1 className="text-title font-semibold">Wa9e3 chi mochkil.</h1>
          <p className="mt-3 text-body text-muted">3awed jereb mn ba3d chwiya.</p>
          <button
            type="button"
            onClick={reset}
            className="mt-section h-control w-full rounded-card bg-gold font-semibold text-canvas"
          >
            3awed
          </button>
        </div>
      </body>
    </html>
  );
}
