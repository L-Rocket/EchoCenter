import {
  LayoutDashboard,
  Crown,
  Settings,
  Terminal,
  LogOut,
  Bot,
  UserCircle2,
  Radar,
} from "lucide-react"
import { useNavigate, NavLink } from "react-router-dom"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from "@/components/ui/sidebar"
import { useAuth } from "@/context/AuthContext"
import { useI18n } from "@/hooks/useI18n"

const navItems = [
  {
    key: "dashboard",
    path: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    key: "butler",
    path: "/butler",
    icon: Crown,
  },
  {
    key: "agents",
    path: "/agents",
    icon: Bot,
  },
  {
    key: "settings",
    path: "/settings",
    icon: Settings,
    adminOnly: true,
  },
  {
    key: "operations",
    path: "/operations",
    icon: Radar,
    adminOnly: true,
  },
]

export function AppSidebar() {
  const { user, logout, isAdmin } = useAuth()
  const { tx } = useI18n()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate("/login")
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <div className="flex items-center gap-2 px-2">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-lg">
                  <Terminal className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="truncate font-semibold">EchoCenter</span>
                  <span className="truncate text-xs text-muted-foreground italic">{tx('Intelligence Hub', '智能中枢')}</span>
                </div>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">{tx('Navigation', '导航')}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                if (item.adminOnly && !isAdmin) return null
                const title =
                  item.key === 'dashboard'
                    ? tx('Dashboard', '总览')
                    : item.key === 'butler'
                      ? tx('Butler', '管家')
                      : item.key === 'agents'
                        ? tx('Agents', 'agent')
                        : item.key === 'operations'
                          ? tx('Operations', '运维')
                        : tx('Settings', '设置')
                return (
                  <SidebarMenuItem key={item.key}>
                    <SidebarMenuButton asChild tooltip={title}>
                      <NavLink
                        to={item.path}
                        className={({ isActive }) =>
                          isActive ? "text-primary font-medium" : "text-muted-foreground"
                        }
                      >
                        <item.icon className="size-4" />
                        <span className="group-data-[collapsible=icon]:hidden">{title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-3 px-3 py-2 group-data-[collapsible=icon]:px-2">
              <div className="flex aspect-square size-8 items-center justify-center rounded-full bg-muted text-muted-foreground group-data-[collapsible=icon]:mx-auto">
                <UserCircle2 className="size-4" />
              </div>
              <div className="flex flex-col text-left text-xs group-data-[collapsible=icon]:hidden">
                <span className="truncate font-medium">{user?.username}</span>
                <span className="truncate text-muted-foreground uppercase tracking-tighter text-[9px] font-bold">{user?.role}</span>
              </div>
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton 
              onClick={handleLogout}
              className="text-muted-foreground hover:text-destructive transition-colors"
              tooltip={tx('Logout', '退出')}
            >
              <LogOut className="size-4" />
              <span className="group-data-[collapsible=icon]:hidden">{tx('Logout', '退出')}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
