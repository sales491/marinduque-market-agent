import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Activity, Search, Database, LineChart, FileText } from "lucide-react"
import { AgentHarvesterControl } from "@/components/AgentHarvesterControl"
import { HarvesterControl } from "@/components/HarvesterControl"
import { SynthesizerControl } from "@/components/SynthesizerControl"
import { AnalystControl } from "@/components/AnalystControl" // Added this import
import { StrategistControl } from "@/components/StrategistControl"

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
          <Tabs defaultValue="overview" className="w-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-semibold tracking-tight">Harvester Control Panel</h2>
              <TabsList className="bg-neutral-900">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="logs">Live Logs</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="overview" className="mt-0 space-y-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 z-0">
                <Card className="bg-neutral-900 border-neutral-800">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Scraped Profiles</CardTitle>
                    <Database className="h-4 w-4 text-neutral-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">1,240</div>
                    <p className="text-xs text-neutral-500">+180 since last run</p>
                  </CardContent>
                </Card>
                <Card className="bg-neutral-900 border-neutral-800">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Sources</CardTitle>
                    <Search className="h-4 w-4 text-neutral-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">12</div>
                    <p className="text-xs text-neutral-500">FB Groups & Pages active</p>
                  </CardContent>
                </Card>
              </div>
              
              {/* Added the Control Panel below the overview stats */}
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
