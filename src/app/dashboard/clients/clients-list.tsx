"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BarberPage } from "@/components/barber/barber-page";
import { searchClients } from "@/lib/clients";
import { formatMoroccanPhone } from "@/lib/phone";
import { visitsLabel } from "@/lib/visits";

type Row = { id: string; fullName: string; phone: string; visits: number };

// Proposed copy — pending review.
const NO_RESULT = "Ma l9inach 7ta client.";

export function ClientsList({ clients }: { clients: Row[] }) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchClients(clients, query), [clients, query]);

  return (
    <BarberPage>
      <h1 className="text-title font-semibold">Clients</h1>

      <div className="sticky top-0 z-10 -mx-page mt-5 bg-canvas px-page pb-3 pt-1">
        <label htmlFor="client-search" className="sr-only">
          Qelleb 3la client...
        </label>
        <input
          id="client-search"
          type="search"
          inputMode="search"
          autoComplete="off"
          placeholder="Qelleb 3la client..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-control w-full rounded-card border border-line bg-surface px-4 text-body text-fg placeholder:text-subtle transition-colors duration-200 focus:border-gold focus:outline-none"
        />
      </div>

      {results.length === 0 ? (
        <p className="mt-6 text-body text-muted">{NO_RESULT}</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {results.map((c) => (
            <li key={c.id}>
              <Link
                href={`/dashboard/clients/${encodeURIComponent(c.id)}`}
                className="flex items-center justify-between gap-4 rounded-card bg-surface p-card transition-colors duration-200 active:bg-surface-raised"
              >
                <span className="min-w-0">
                  <span className="block truncate text-body font-medium">{c.fullName}</span>
                  <span className="block text-secondary tabular-nums text-muted">{formatMoroccanPhone(c.phone)}</span>
                </span>
                <span className="shrink-0 text-secondary text-muted">{visitsLabel(c.visits)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </BarberPage>
  );
}
