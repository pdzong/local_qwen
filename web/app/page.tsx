import Link from "next/link";

import { ChatPanel } from "@/components/chat-panel";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center gap-6 px-4 py-8">
      <nav className="text-muted-foreground flex gap-4 text-sm">
        <span className="text-foreground font-medium">Chat</span>
        <Link
          href="/bench"
          className="hover:text-foreground underline-offset-4 hover:underline"
        >
          Benchmark
        </Link>
      </nav>
      <ChatPanel />
    </div>
  );
}
