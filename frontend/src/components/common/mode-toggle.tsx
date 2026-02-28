import { Moon, Sun, Monitor } from "lucide-react"
import { useTheme } from "@/hooks/useTheme"
import type { Theme } from "@/context/ThemeProvider"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function ModeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <Select value={theme} onValueChange={(value: string) => setTheme(value as Theme)}>
      <SelectTrigger className="w-[110px]" size="sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem value="light">
          <Sun className="h-4 w-4 mr-2" />
          <span>Light</span>
        </SelectItem>
        <SelectItem value="dark">
          <Moon className="h-4 w-4 mr-2" />
          <span>Dark</span>
        </SelectItem>
        <SelectItem value="system">
          <Monitor className="h-4 w-4 mr-2" />
          <span>System</span>
        </SelectItem>
      </SelectContent>
    </Select>
  )
}
