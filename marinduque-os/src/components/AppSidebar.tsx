"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Activity, LayoutDashboard, FolderSearch, Search, Database, LineChart, FileText } from "lucide-react"

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <div className="w-64 flex-shrink-0 border-r border-neutral-800 bg-neutral-900 flex flex-col p-4">
      <div className="flex items-center gap-2 mb-8 px-2">
        <Activity className="h-6 w-6 text-emerald-500" />
        <span className="font-bold text-lg tracking-tight text-white">Marinduque OS</span>
      </div>
      
      <div className="flex flex-col gap-6">
        <nav className="flex flex-col gap-2">
          <div className="px-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">
            Core Systems
          </div>
          <SidebarLink href="/" icon={<LayoutDashboard size={18} />} title="Agent Control Center" active={pathname === "/"} />
          <SidebarLink href="/directory" icon={<FolderSearch size={18} />} title="Intelligence Directory" active={pathname === "/directory"} />
        </nav>

        <nav className="flex flex-col gap-2">
          <div className="px-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">
            Active Agents
          </div>
          <SidebarLink href="/#harvester" icon={<Search size={18} />} title="Harvester" active={false} />
          <SidebarLink href="/#synthesizer" icon={<Database size={18} />} title="Synthesizer" active={false} />
          <SidebarLink href="/#analyst" icon={<LineChart size={18} />} title="Analyst" active={false} />
          <SidebarLink href="/#strategist" icon={<FileText size={18} />} title="Strategist" active={false} />
        </nav>
      </div>
    </div>
  )
}

function SidebarLink({ href, icon, title, active }: { href: string, icon: React.ReactNode, title: string, active: boolean }) {
  return (
    <Link 
      href={href}
      className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
        active 
          ? 'bg-neutral-800 text-emerald-400 font-medium' 
          : 'text-neutral-400 hover:text-neutral-50 hover:bg-neutral-800/50'
      }`}
    >
      {icon}
      <span className="text-sm">{title}</span>
    </Link>
  )
}
