import { Spinner } from "@/components/ui/spinner";

export default function Loading() {
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas">
      <Spinner className="size-6 text-gold" />
    </main>
  );
}
