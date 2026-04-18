import { Languages } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useI18n } from '@/hooks/useI18n';
import type { Locale } from '@/context/I18nContext';

export function LanguageToggle() {
  const { locale, setLocale, tx } = useI18n();

  return (
    <Select value={locale} onValueChange={(value: string) => setLocale(value as Locale)}>
      <SelectTrigger className="w-[116px]" size="sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem value="en">
          <Languages className="h-4 w-4 mr-2" />
          <span>{tx('English', '英文')}</span>
        </SelectItem>
        <SelectItem value="zh-CN">
          <Languages className="h-4 w-4 mr-2" />
          <span>{tx('Chinese', '中文')}</span>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
