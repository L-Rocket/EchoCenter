import FeishuIntegrationSettings from '@/components/admin/FeishuIntegrationSettings'
import { useI18n } from '@/hooks/useI18n'

const SettingsPage = () => {
  const { tx } = useI18n()

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-border/70 bg-gradient-to-br from-muted/30 via-background to-background p-6 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.75)]">
        <div className="space-y-3">
          <div className="text-[11px] font-black uppercase tracking-[0.32em] text-primary/80">
            {tx('Integrations Control', '集成控制')}
          </div>
          <div className="space-y-1">
            <h2 className="text-3xl font-black tracking-tight">
              {tx('Channel Integrations', '渠道集成')}
            </h2>
            <p className="max-w-3xl text-sm text-muted-foreground">
              {tx(
                'Configure external channels and route their messages into Butler with explicit visibility and operational control.',
                '配置外部渠道，并在可观测、可控的前提下将消息路由给 Butler。'
              )}
            </p>
          </div>
        </div>
      </div>

      <FeishuIntegrationSettings />
    </div>
  )
}

export default SettingsPage
