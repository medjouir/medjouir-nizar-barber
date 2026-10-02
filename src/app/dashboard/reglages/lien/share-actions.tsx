"use client";

import { useState } from "react";
import { WhatsApp } from "@/components/icons";
import { Button, buttonClasses } from "@/components/ui/button";

// Proposed copy — pending review.
const COPIED = "Tcopia.";

export function ShareActions({ url, message }: { url: string; message: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <Button
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            window.prompt("", url);
          }
        }}
      >
        {copied ? COPIED : "Copier"}
      </Button>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(message)}`}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClasses("secondary")}
      >
        <WhatsApp width={18} height={18} />
        Partager f WhatsApp
      </a>
      <p role="status" className="sr-only">
        {copied ? COPIED : ""}
      </p>
    </div>
  );
}
