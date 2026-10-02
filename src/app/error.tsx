"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/ui/page-shell";

/** Friendly error screen — never a raw technical error. Proposed copy, pending review. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error.digest ?? error.message);
  }, [error]);

  return (
    <PageShell className="justify-center">
      <h1 className="text-title font-semibold">Wa9e3 chi mochkil.</h1>
      <p className="mt-3 text-body text-muted">3awed jereb mn ba3d chwiya.</p>
      <div className="mt-section">
        <Button onClick={reset}>3awed</Button>
      </div>
    </PageShell>
  );
}
