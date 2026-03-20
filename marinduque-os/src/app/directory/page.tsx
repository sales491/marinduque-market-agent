import { IntelligenceDashboard } from "@/components/IntelligenceDashboard"

export default function DirectoryPage() {
  return (
    <div className="flex-1 flex flex-col relative min-w-0">
      <header className="h-14 border-b border-neutral-800 bg-neutral-900/50 flex items-center px-6 backdrop-blur-sm z-10">
        <h1 className="text-sm font-medium text-neutral-400">Workspace / Intelligence Directory</h1>
      </header>
      <main className="flex-1 p-6 overflow-y-auto overflow-x-hidden max-w-full">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold tracking-tight text-white mb-1">Intelligence Directory</h2>
          <p className="text-sm text-neutral-400">Browse fully synthesized business profiles and access AI-generated market gap reports and pitch decks.</p>
        </div>
        <IntelligenceDashboard />
      </main>
    </div>
  )
}
