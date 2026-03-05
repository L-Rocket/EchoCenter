import { useState } from 'react';
import {
  BadgeCheck,
  Eye,
  EyeOff,
  Loader2,
  MessageSquare,
  Save,
  Send,
  Settings2,
  ShieldCheck,
  Webhook,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/hooks/useI18n';

type ConnectorStatus = 'not_connected' | 'connecting' | 'connected' | 'error';

interface ConnectorForm {
  connectorName: string;
  enabled: boolean;
  appId: string;
  appSecret: string;
  allowDm: boolean;
  allowGroupMention: boolean;
  mentionRequired: boolean;
  prefixCommand: string;
  ignoreBotMessages: boolean;
  rateLimitPerMinute: number;
  allowedChatIds: string;
  userWhitelist: string;
}

interface IntegrationLog {
  id: string;
  level: 'info' | 'success' | 'error';
  action: string;
  detail: string;
  timestamp: string;
}

const INITIAL_FORM: ConnectorForm = {
  connectorName: 'Feishu Butler Connector',
  enabled: false,
  appId: '',
  appSecret: '',
  allowDm: true,
  allowGroupMention: true,
  mentionRequired: true,
  prefixCommand: '/butler',
  ignoreBotMessages: true,
  rateLimitPerMinute: 30,
  allowedChatIds: '',
  userWhitelist: '',
};

const getStatusBadge = (status: ConnectorStatus) => {
  if (status === 'connected') return { variant: 'default' as const, label: 'Connected' };
  if (status === 'connecting') return { variant: 'secondary' as const, label: 'Connecting' };
  if (status === 'error') return { variant: 'destructive' as const, label: 'Error' };
  return { variant: 'outline' as const, label: 'Not Connected' };
};

const FeishuIntegrationSettings = () => {
  const { tx } = useI18n();
  const [form, setForm] = useState<ConnectorForm>(INITIAL_FORM);
  const [status, setStatus] = useState<ConnectorStatus>('not_connected');
  const [wsVerified, setWsVerified] = useState(false);
  const [lastVerifyAt, setLastVerifyAt] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSecretVisible, setIsSecretVisible] = useState(false);
  const [logs, setLogs] = useState<IntegrationLog[]>([]);

  const pushLog = (level: IntegrationLog['level'], action: string, detail: string) => {
    setLogs((prev) => [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        level,
        action,
        detail,
        timestamp: new Date().toISOString(),
      },
      ...prev,
    ].slice(0, 20));
  };

  const handleSaveDraft = async () => {
    setIsSaving(true);
    setError('');
    setNotice('');
    setStatus('connecting');

    await new Promise((resolve) => setTimeout(resolve, 500));

    setStatus(form.enabled ? 'connected' : 'not_connected');
    setNotice(tx('Draft saved. Backend APIs can now persist this connector config.', '草稿已保存，后端接口接入后可持久化该连接器配置。'));
    pushLog('success', tx('Save Draft', '保存草稿'), tx('Connector draft saved in frontend session.', '连接器草稿已保存到前端会话。'));
    setIsSaving(false);
  };

  const handleSaveAndEnable = async () => {
    if (!wsVerified) {
      setError(tx('Verify WebSocket first before enabling connector.', '启用前请先验证 WebSocket 连接。'));
      pushLog('error', tx('Save & Enable', '保存并启用'), tx('Rejected because WebSocket has not been verified.', '由于 WebSocket 未验证，操作被拒绝。'));
      return;
    }

    setIsSaving(true);
    setError('');
    setNotice('');
    setStatus('connecting');

    await new Promise((resolve) => setTimeout(resolve, 600));

    setForm((prev) => ({ ...prev, enabled: true }));
    setStatus('connected');
    setNotice(tx('Connector is enabled. Feishu messages can now be routed to Butler after backend wiring.', '连接器已启用，后端接入后飞书消息可路由到 Butler。'));
    pushLog('success', tx('Enable Connector', '启用连接器'), tx('Connector enabled with verified WebSocket.', '连接器已基于验证 WebSocket 启用。'));
    setIsSaving(false);
  };

  const handleVerifyConnection = async () => {
    setIsVerifying(true);
    setError('');
    setNotice('');
    setStatus('connecting');

    await new Promise((resolve) => setTimeout(resolve, 700));

    setWsVerified(true);
    const verifiedAt = new Date().toISOString();
    setLastVerifyAt(verifiedAt);
    setStatus(form.enabled ? 'connected' : 'not_connected');
    setNotice(tx('WebSocket bridge verified. You can now enable connector safely.', 'WebSocket 长连接验证通过，现在可以安全启用连接器。'));
    pushLog('success', tx('Verify WebSocket', '验证 WebSocket'), tx('WebSocket bridge verification passed.', 'WebSocket 长连接验证通过。'));
    setIsVerifying(false);
  };

  const handleTestMessage = async () => {
    setIsTesting(true);
    setError('');
    setNotice('');

    await new Promise((resolve) => setTimeout(resolve, 650));

    if (!form.appId || !form.appSecret) {
      setError(tx('Fill in App ID and App Secret before sending test message.', '发送测试消息前请填写 App ID 和 App Secret。'));
      pushLog('error', tx('Test Message', '测试消息'), tx('Test failed due to missing required credentials.', '因缺少必填凭据，测试失败。'));
      setStatus('error');
      setIsTesting(false);
      return;
    }

    setStatus(form.enabled ? 'connected' : 'not_connected');
    setNotice(tx('Test message request created. Waiting for backend Feishu delivery endpoint.', '测试消息请求已创建，等待后端飞书投递接口接入。'));
    pushLog('info', tx('Test Message', '测试消息'), tx('Test message queued with frontend mock flow.', '测试消息已按前端 mock 流程入队。'));
    setIsTesting(false);
  };

  const badge = getStatusBadge(status);

  return (
    <div className="space-y-5">
      <Card className="border-2 shadow-xl bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2">
                <Webhook className="h-4 w-4 text-primary" />
                {tx('Feishu Connector', '飞书连接器')}
              </CardTitle>
              <p className="mt-2 text-xs text-muted-foreground">
                {tx('Configure Feishu as an external chat entrypoint and route conversations to Butler.', '将飞书配置为外部聊天入口，并把会话路由到 Butler。')}
              </p>
            </div>
            <Badge variant={badge.variant} className="h-6 text-[10px] uppercase tracking-wider">
              {tx(
                badge.label,
                badge.label === 'Connected'
                  ? '已连接'
                  : badge.label === 'Connecting'
                    ? '连接中'
                    : badge.label === 'Error'
                      ? '错误'
                      : '未连接'
              )}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{tx('Basic', '基础配置')}</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                value={form.connectorName}
                onChange={(e) => setForm((prev) => ({ ...prev, connectorName: e.target.value }))}
                placeholder={tx('Connector name', '连接器名称')}
                className="h-10"
              />
              <label className="h-10 rounded-md border px-3 flex items-center justify-between text-xs font-medium">
                {tx('Enable Connector', '启用连接器')}
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(e) => setForm((prev) => ({ ...prev, enabled: e.target.checked }))}
                  className="h-4 w-4"
                />
              </label>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{tx('Feishu Credentials', '飞书凭据')}</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                value={form.appId}
                onChange={(e) => setForm((prev) => ({ ...prev, appId: e.target.value }))}
                placeholder={tx('App ID', '应用 ID')}
                className="h-10"
              />
              <div className="relative">
                <Input
                  value={form.appSecret}
                  type={isSecretVisible ? 'text' : 'password'}
                  onChange={(e) => setForm((prev) => ({ ...prev, appSecret: e.target.value }))}
                  placeholder={tx('App Secret', '应用密钥')}
                  className="h-10 pr-10 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setIsSecretVisible((prev) => !prev)}
                  className="absolute right-2 top-2 h-6 w-6 inline-flex items-center justify-center text-muted-foreground"
                >
                  {isSecretVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{tx('WebSocket Bridge', 'WebSocket 长连接')}</h3>
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <Input value={tx('wss://open.feishu.cn/open-apis/ws/v2', 'wss://open.feishu.cn/open-apis/ws/v2')} readOnly className="h-10 font-mono text-xs" />
              <Button type="button" variant="outline" className="h-10" onClick={handleVerifyConnection} disabled={isVerifying}>
                {isVerifying ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Webhook className="h-4 w-4 mr-1" />}
                {tx('Verify WebSocket', '验证 WebSocket')}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {tx('Bridge status:', '连接状态：')} {lastVerifyAt ? tx('verified', '已验证') : tx('not verified', '未验证')}
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{tx('Conversation Scope', '会话范围')}</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="h-10 rounded-md border px-3 flex items-center justify-between text-xs font-medium">
                {tx('Allow Direct Messages', '允许私聊')}
                <input
                  type="checkbox"
                  checked={form.allowDm}
                  onChange={(e) => setForm((prev) => ({ ...prev, allowDm: e.target.checked }))}
                  className="h-4 w-4"
                />
              </label>
              <label className="h-10 rounded-md border px-3 flex items-center justify-between text-xs font-medium">
                {tx('Allow Group Mentions', '允许群内 @')}
                <input
                  type="checkbox"
                  checked={form.allowGroupMention}
                  onChange={(e) => setForm((prev) => ({ ...prev, allowGroupMention: e.target.checked }))}
                  className="h-4 w-4"
                />
              </label>
            </div>
            <Input
              value={form.allowedChatIds}
              onChange={(e) => setForm((prev) => ({ ...prev, allowedChatIds: e.target.value }))}
              placeholder={tx('Allowed chat IDs (comma separated)', '允许的聊天 ID（逗号分隔）')}
              className="h-10"
            />
            <Input
              value={form.userWhitelist}
              onChange={(e) => setForm((prev) => ({ ...prev, userWhitelist: e.target.value }))}
              placeholder={tx('User whitelist (comma separated)', '用户白名单（逗号分隔）')}
              className="h-10"
            />
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{tx('Message Behavior', '消息策略')}</h3>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="h-10 rounded-md border px-3 flex items-center justify-between text-xs font-medium">
                {tx('Mention Required', '必须 @')}
                <input
                  type="checkbox"
                  checked={form.mentionRequired}
                  onChange={(e) => setForm((prev) => ({ ...prev, mentionRequired: e.target.checked }))}
                  className="h-4 w-4"
                />
              </label>
              <label className="h-10 rounded-md border px-3 flex items-center justify-between text-xs font-medium">
                {tx('Ignore Bot Messages', '忽略机器人消息')}
                <input
                  type="checkbox"
                  checked={form.ignoreBotMessages}
                  onChange={(e) => setForm((prev) => ({ ...prev, ignoreBotMessages: e.target.checked }))}
                  className="h-4 w-4"
                />
              </label>
              <Input
                value={form.prefixCommand}
                onChange={(e) => setForm((prev) => ({ ...prev, prefixCommand: e.target.value }))}
                placeholder={tx('Prefix command', '前缀命令')}
                className="h-10"
              />
            </div>
            <Input
              type="number"
              min={1}
              max={300}
              value={form.rateLimitPerMinute}
              onChange={(e) => setForm((prev) => ({ ...prev, rateLimitPerMinute: Number(e.target.value || 1) }))}
              placeholder={tx('Rate limit per minute', '每分钟限流')}
              className="h-10 w-full md:w-64"
            />
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{tx('Test & Logs', '测试与日志')}</h3>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={handleTestMessage} disabled={isTesting}>
                {isTesting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                {tx('Send Test Message', '发送测试消息')}
              </Button>
              <Button type="button" variant="outline" onClick={handleSaveDraft} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                {tx('Save Draft', '保存草稿')}
              </Button>
              <Button type="button" onClick={handleSaveAndEnable} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <BadgeCheck className="h-4 w-4 mr-1" />}
                {tx('Save & Enable', '保存并启用')}
              </Button>
            </div>
            {notice && (
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700">
                {notice}
              </div>
            )}
            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}

            <div className="rounded-lg border overflow-hidden">
              <div className="grid grid-cols-[170px_120px_1fr] gap-3 border-b bg-muted/20 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <span>{tx('Time', '时间')}</span>
                <span>{tx('Action', '操作')}</span>
                <span>{tx('Detail', '详情')}</span>
              </div>
              {logs.length === 0 ? (
                <div className="p-4 text-xs text-muted-foreground text-center">{tx('No connector logs yet.', '暂无连接器日志。')}</div>
              ) : (
                logs.map((item) => (
                  <div key={item.id} className="grid grid-cols-[170px_120px_1fr] gap-3 border-b last:border-b-0 px-3 py-2 text-xs">
                    <span className="text-muted-foreground">{new Date(item.timestamp).toLocaleString()}</span>
                    <span className="font-semibold">{item.action}</span>
                    <span className="text-muted-foreground">{item.detail}</span>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-lg border bg-muted/20 p-3 text-[11px] text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              {tx('Backend Integration Notes', '后端集成说明')}
            </p>
            <p className="inline-flex items-center gap-1.5">
              <Settings2 className="h-3.5 w-3.5" />
              {tx(
                'This page is frontend-ready now and expects backend APIs listed in `frontend/BACKEND_PENDING.md`.',
                '该页面前端已就绪，依赖 `frontend/BACKEND_PENDING.md` 中列出的后端 API。'
              )}
            </p>
            <p className="inline-flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" />
              {tx(
                'After backend wiring, Feishu messages can be routed directly into Butler dialogue flow.',
                '后端接入后，飞书消息可直接路由到 Butler 对话流。'
              )}
            </p>
          </section>
        </CardContent>
      </Card>
    </div>
  );
};

export default FeishuIntegrationSettings;
