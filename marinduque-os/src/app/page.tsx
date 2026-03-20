import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Activity, Search, Database, LineChart, FileText } from "lucide-react"
import { AgentHarvesterControl } from "@/components/AgentHarvesterControl"
import { HarvesterControl } from "@/components/HarvesterControl"
import { SynthesizerControl } from "@/components/SynthesizerControl"
import { AnalystControl } from "@/components/AnalystControl" // Added this import
import { StrategistControl } from "@/components/StrategistControl"
import { IntelligenceDashboard } from "@/components/IntelligenceDashboard"

export default function AgentOS() {
  return (
    <div className="flex h-screen bg-neutral-950 text-neutral-50 overflow-hidden">
      
      {/* Sidebar / Dock */}
      <div className="w-64 flex-shrink-0 border-r border-neutral-800 bg-neutral-900 flex flex-col p-4">
        <div className="flex items-center gap-2 mb-8 px-2">
          <Activity className="h-6 w-6 text-emerald-500" />
          <span className="font-bold text-lg tracking-tight">Marinduque OS</span>
        </div>
        
        <nav className="flex flex-col gap-2">
          <AgentLink icon={<Search size={18} />} title="Harvester" active />
          <AgentLink icon={<Database size={18} />} title="Synthesizer" />
          <AgentLink icon={<LineChart size={18} />} title="Analyst" />
          <AgentLink icon={<FileText size={18} />} title="Strategist" />
        </nav>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col relative min-w-0">
        <header className="h-14 border-b border-neutral-800 bg-neutral-900/50 flex items-center px-6 backdrop-blur-sm z-10">
          <h1 className="text-sm font-medium text-neutral-400">Workspace / Harvester Agent</h1>
        </header>

        <main className="flex-1 p-6 overflow-y-auto overflow-x-hidden max-w-full">
          <Tabs defaultValue="dashboard" className="w-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-semibold tracking-tight">Harvester Control Panel</h2>
              <TabsList className="bg-neutral-900">
                <TabsTrigger value="dashboard">Intelligence Dashboard</TabsTrigger>
                <TabsTrigger value="agents">AI Agents</TabsTrigger>
                <TabsTrigger value="logs">Live Logs</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="dashboard" className="mt-0 space-y-6">
               <IntelligenceDashboard />
            </TabsContent>

            <TabsContent value="agents" className="mt-0 space-y-6">
              <AgentHarvesterControl />
              <HarvesterControl />
              <SynthesizerControl />
              <AnalystControl />
              <StrategistControl />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  )
}

function AgentLink({ icon, title, active }: { icon: React.ReactNode, title: string, active?: boolean }) {
  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors ${active ? 'bg-neutral-800 text-neutral-50' : 'text-neutral-400 hover:text-neutral-50 hover:bg-neutral-800/50'}`}>
      {icon}
      <span className="text-sm font-medium">{title}</span>
    </div>
  )
}
