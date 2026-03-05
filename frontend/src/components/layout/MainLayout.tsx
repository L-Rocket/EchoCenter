import * as React from "react"
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "./AppSidebar"
import { Outlet } from "react-router-dom"
import { TooltipProvider } from "@/components/ui/tooltip"
import { LanguageToggle } from "../common/language-toggle"
import { ModeToggle } from "../common/mode-toggle"
import { useI18n } from "@/hooks/useI18n"

export const MainLayout: React.FC = () => {
  const { tx } = useI18n()

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 shadow-sm">
            <SidebarTrigger className="-ml-1" />
            <div className="h-4 w-px bg-border mx-2" />
            <div className="flex-1 flex items-center justify-between">
               <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                 {tx('Autonomous Swarm Monitor', '自治集群监控台')}
               </span>
               <div className="flex items-center gap-2">
                 <LanguageToggle />
                 <ModeToggle />
               </div>
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <div className="container max-w-5xl mx-auto py-8 px-4">
              <Outlet />
            </div>
          </main>
          <footer className="border-t bg-card py-3">
            <div className="container max-w-5xl mx-auto px-4 text-center">
              <p className="text-[11px] text-muted-foreground">
                &copy; {new Date().getFullYear()} EchoCenter &bull; {tx('Intelligence Monitoring Hub', '智能监控中枢')}
              </p>
            </div>
          </footer>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
