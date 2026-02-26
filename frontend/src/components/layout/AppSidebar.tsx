import {
  LayoutDashboard,
  Users,
  Terminal,
  LogOut,
  Bot,
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

const navItems = [
  {
    title: "Dashboard",
    path: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Agents",
    path: "/agents",
    icon: Bot,
  },
  {
    title: "Team",
    path: "/team",
    icon: Users,
    adminOnly: true,
  },
]

export function AppSidebar() {
  const { user, logout, isAdmin } = useAuth()
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
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-indigo-600 text-sidebar-primary-foreground shadow-lg shadow-indigo-200">
                  <Terminal className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="truncate font-semibold text-slate-900">EchoCenter</span>
                  <span className="truncate text-xs text-slate-500 italic">Intelligence Hub</span>
                </div>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                if (item.adminOnly && !isAdmin) return null
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild tooltip={item.title}>
                      <NavLink
                        to={item.path}
                        className={({ isActive }) =>
                          isActive ? "text-indigo-600 font-medium" : "text-slate-600"
                        }
                      >
                        <item.icon className="size-4" />
                        <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
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
              <div className="flex aspect-square size-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 group-data-[collapsible=icon]:mx-auto">
                <Users className="size-4" />
              </div>
              <div className="flex flex-col text-left text-xs group-data-[collapsible=icon]:hidden">
                <span className="truncate font-medium text-slate-900">{user?.username}</span>
                <span className="truncate text-slate-500 uppercase tracking-tighter text-[9px] font-bold">{user?.role}</span>
              </div>
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton 
              onClick={handleLogout}
              className="text-slate-500 hover:text-red-600 transition-colors"
              tooltip="Logout"
            >
              <LogOut className="size-4" />
              <span className="group-data-[collapsible=icon]:hidden">Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
