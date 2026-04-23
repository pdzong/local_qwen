import Link from "next/link";

import { BenchmarkPanel } from "@/components/benchmark-panel";

export default function BenchPage() {
  return (
    <div className="flex flex-1 flex-col items-center gap-6 px-4 py-8">
      <nav className="text-muted-foreground flex gap-4 text-sm">
        <Link href="/" className="hover:text-foreground underline-offset-4 hover:underline">
          Chat
        </Link>
        <span className="text-foreground font-medium">Benchmark</span>
      </nav>
      <BenchmarkPanel />
    </div>
  );
}
