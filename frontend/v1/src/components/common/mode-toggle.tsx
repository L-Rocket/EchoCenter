import { Moon, Sun, Monitor } from "lucide-react"
import { useTheme } from "@/hooks/useTheme"
import { useI18n } from "@/hooks/useI18n"
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
  const { tx } = useI18n()

  return (
    <Select value={theme} onValueChange={(value: string) => setTheme(value as Theme)}>
      <SelectTrigger className="w-[110px]" size="sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem value="light">
          <Sun className="h-4 w-4 mr-2" />
          <span>{tx('Light', '浅色')}</span>
        </SelectItem>
        <SelectItem value="dark">
          <Moon className="h-4 w-4 mr-2" />
          <span>{tx('Dark', '深色')}</span>
        </SelectItem>
        <SelectItem value="system">
          <Monitor className="h-4 w-4 mr-2" />
          <span>{tx('System', '系统')}</span>
        </SelectItem>
      </SelectContent>
    </Select>
  )
}
