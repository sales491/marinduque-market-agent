import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Server, Activity, Database, LineChart, FileText, ArrowRight } from "lucide-react"
import Link from "next/link"
import { AgentHarvesterControl } from "@/components/AgentHarvesterControl"
import { HarvesterControl } from "@/components/HarvesterControl"
import { SynthesizerControl } from "@/components/SynthesizerControl"
import { AnalystControl } from "@/components/AnalystControl"
import { StrategistControl } from "@/components/StrategistControl"

export default function AgentOS() {
  return (
    <div className="flex-1 flex flex-col relative min-w-0 h-full">
      <header className="h-14 border-b border-neutral-800 bg-neutral-900/50 flex items-center px-6 backdrop-blur-sm z-10 w-full">
        <h1 className="text-sm font-medium text-neutral-400">Workspace / Agent Control Center</h1>
      </header>

      <main className="flex-1 p-6 overflow-y-auto overflow-x-hidden w-full">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-900/40 via-neutral-900 to-neutral-950 border border-emerald-900/30 p-8 mb-8">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Welcome to Marinduque OS.</h1>
              <p className="text-neutral-400 max-w-xl text-lg mb-6">
                The fully autonomous market intelligence platform. AI Agents are currently on standby to harvest, synthesize, and analyze business profiles across the region.
              </p>
              
              <Link 
                href="/directory" 
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg transition-all shadow-lg shadow-emerald-900/20 group"
              >
                Access Intelligence Directory
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
            
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 gap-4 w-full md:w-auto">
              <div className="flex flex-col bg-neutral-950/50 p-4 rounded-lg border border-neutral-800/50">
                <span className="text-3xl font-medium text-emerald-400">4</span>
                <span className="text-xs text-neutral-500 font-medium uppercase tracking-wider mt-1">Active Agents</span>
              </div>
              <div className="flex flex-col bg-neutral-950/50 p-4 rounded-lg border border-neutral-800/50">
                <span className="text-3xl font-medium text-neutral-300">Live</span>
                <span className="text-xs text-neutral-500 font-medium uppercase tracking-wider mt-1">System Status</span>
              </div>
            </div>
          </div>
        </div>

        {/* AI Agent Execution Panel */}
        <div className="mb-6 mt-12">
          <h2 className="text-xl font-semibold tracking-tight text-white mb-1">Agent Execution</h2>
          <p className="text-sm text-neutral-400">Trigger manual overrides or batch runs for the autonomous agents.</p>
        </div>

        <Tabs defaultValue="harvester" className="w-full flex flex-col">
          <TabsList className="bg-neutral-900 self-start mb-6">
            <TabsTrigger value="harvester" className="flex gap-2"><Server size={14}/> Harvester</TabsTrigger>
            <TabsTrigger value="synthesizer" className="flex gap-2"><Database size={14}/> Synthesizer</TabsTrigger>
            <TabsTrigger value="analyst" className="flex gap-2"><LineChart size={14}/> Analyst</TabsTrigger>
            <TabsTrigger value="strategist" className="flex gap-2"><FileText size={14}/> Strategist</TabsTrigger>
          </TabsList>

          <TabsContent value="harvester" className="mt-0">
            <AgentHarvesterControl />
            <div className="mt-6">
              <HarvesterControl />
            </div>
          </TabsContent>

          <TabsContent value="synthesizer" className="mt-0">
            <SynthesizerControl />
          </TabsContent>

          <TabsContent value="analyst" className="mt-0">
            <AnalystControl />
          </TabsContent>

          <TabsContent value="strategist" className="mt-0">
            <StrategistControl />
          </TabsContent>
        </Tabs>

      </main>
    </div>
  )
}
