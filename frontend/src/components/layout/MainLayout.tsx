import * as React from "react"
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "./AppSidebar"
import { Outlet } from "react-router-dom"
import { TooltipProvider } from "@/components/ui/tooltip"

export const MainLayout: React.FC = () => {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="bg-slate-50">
          <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 px-4 shadow-sm">
            <SidebarTrigger className="-ml-1" />
            <div className="h-4 w-px bg-slate-200 mx-2" />
            <div className="flex-1 flex items-center justify-between">
               <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Autonomous Swarm Monitor</span>
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <div className="container max-w-5xl mx-auto py-8 px-4">
              <Outlet />
            </div>
          </main>
          <footer className="border-t bg-white py-6">
            <div className="container max-w-5xl mx-auto px-4 text-center">
              <p className="text-xs text-slate-400">
                &copy; {new Date().getFullYear()} EchoCenter &bull; Intelligence Monitoring Hub
              </p>
            </div>
          </footer>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
