"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Activity, Flame, Compass, ListChecks, Map, LogOut } from "lucide-react"

export function AppSidebar() {
  const pathname = usePathname()
  const router   = useRouter()

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="w-64 flex-shrink-0 border-r border-neutral-800 bg-neutral-900 flex flex-col p-4">
      <div className="flex items-center gap-2 mb-8 px-2">
        <Activity className="h-6 w-6 text-emerald-500" />
        <span className="font-bold text-lg tracking-tight text-white">Marinduque OS</span>
      </div>
      
      <div className="flex flex-col gap-6 flex-1">
        <nav className="flex flex-col gap-1">
          <div className="px-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
            Intelligence
          </div>
          <SidebarLink href="/" icon={<Flame size={18} />} title="Lead Board" active={pathname === "/"} />
          <SidebarLink href="/hub" icon={<Compass size={18} />} title="Intelligence Hub" active={pathname === "/hub"} />
          <SidebarLink href="/actions" icon={<ListChecks size={18} />} title="Action Queue" active={pathname.startsWith("/actions") || pathname.startsWith("/report/")} />
          <SidebarLink href="/map" icon={<Map size={18} />} title="Map View" active={pathname === "/map"} />
        </nav>

        <nav className="flex flex-col gap-2">
          <div className="px-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">
            Pipeline
          </div>
          <div className="px-3 py-2 text-xs text-neutral-600 italic leading-relaxed">
            Harvester → Synthesizer → Analyst → Strategist. Trigger from the Lead Board.
          </div>
        </nav>
      </div>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="flex items-center gap-3 px-3 py-2 rounded-md text-neutral-600 hover:text-neutral-300 hover:bg-neutral-800/50 transition-colors w-full mt-4 border-t border-neutral-800 pt-4"
      >
        <LogOut size={16} />
        <span className="text-sm">Sign out</span>
      </button>
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
