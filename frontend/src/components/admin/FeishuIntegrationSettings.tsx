import { useMemo, useState } from 'react';
import {
  BadgeCheck,
  Check,
  Copy,
  Eye,
  EyeOff,
  Link2,
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

type ConnectorStatus = 'not_connected' | 'connecting' | 'connected' | 'error';

interface ConnectorForm {
  connectorName: string;
  enabled: boolean;
  appId: string;
  appSecret: string;
  verificationToken: string;
  encryptKey: string;
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
  verificationToken: '',
  encryptKey: '',
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
  const [form, setForm] = useState<ConnectorForm>(INITIAL_FORM);
  const [status, setStatus] = useState<ConnectorStatus>('not_connected');
  const [callbackVerified, setCallbackVerified] = useState(false);
  const [lastVerifyAt, setLastVerifyAt] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSecretVisible, setIsSecretVisible] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [logs, setLogs] = useState<IntegrationLog[]>([]);

  const callbackUrl = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
    return `${origin}/api/integrations/feishu/callback`;
  }, []);

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

  const copyText = async (text: string) => {
    if (!text) return false;
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (_err) {
        return false;
      }
    }
    return false;
  };

  const handleCopyCallback = async () => {
    const copied = await copyText(callbackUrl);
    if (!copied) return;
    setIsCopied(true);
    window.setTimeout(() => setIsCopied(false), 1200);
  };

  const handleSaveDraft = async () => {
    setIsSaving(true);
    setError('');
    setNotice('');
    setStatus('connecting');

    await new Promise((resolve) => setTimeout(resolve, 500));

    setStatus(form.enabled ? 'connected' : 'not_connected');
    setNotice('Draft saved. Backend APIs can now persist this connector config.');
    pushLog('success', 'Save Draft', 'Connector draft saved in frontend session.');
    setIsSaving(false);
  };

  const handleSaveAndEnable = async () => {
    if (!callbackVerified) {
      setError('Verify callback first before enabling connector.');
      pushLog('error', 'Save & Enable', 'Rejected because callback has not been verified.');
      return;
    }

    setIsSaving(true);
    setError('');
    setNotice('');
    setStatus('connecting');

    await new Promise((resolve) => setTimeout(resolve, 600));

    setForm((prev) => ({ ...prev, enabled: true }));
    setStatus('connected');
    setNotice('Connector is enabled. Feishu messages can now be routed to Butler after backend wiring.');
    pushLog('success', 'Enable Connector', 'Connector enabled with verified callback.');
    setIsSaving(false);
  };

  const handleVerifyCallback = async () => {
    setIsVerifying(true);
    setError('');
    setNotice('');
    setStatus('connecting');

    await new Promise((resolve) => setTimeout(resolve, 700));

    setCallbackVerified(true);
    const verifiedAt = new Date().toISOString();
    setLastVerifyAt(verifiedAt);
    setStatus(form.enabled ? 'connected' : 'not_connected');
    setNotice('Callback verified. You can now enable connector safely.');
    pushLog('success', 'Verify Callback', 'Callback verification passed.');
    setIsVerifying(false);
  };

  const handleTestMessage = async () => {
    setIsTesting(true);
    setError('');
    setNotice('');

    await new Promise((resolve) => setTimeout(resolve, 650));

    if (!form.appId || !form.appSecret || !form.verificationToken) {
      setError('Fill in App ID, App Secret and Verification Token before sending test message.');
      pushLog('error', 'Test Message', 'Test failed due to missing required credentials.');
      setStatus('error');
      setIsTesting(false);
      return;
    }

    setStatus(form.enabled ? 'connected' : 'not_connected');
    setNotice('Test message request created. Waiting for backend Feishu delivery endpoint.');
    pushLog('info', 'Test Message', 'Test message queued with frontend mock flow.');
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
                Feishu Connector
              </CardTitle>
              <p className="mt-2 text-xs text-muted-foreground">
                Configure Feishu as an external chat entrypoint and route conversations to Butler.
              </p>
            </div>
            <Badge variant={badge.variant} className="h-6 text-[10px] uppercase tracking-wider">
              {badge.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Basic</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                value={form.connectorName}
                onChange={(e) => setForm((prev) => ({ ...prev, connectorName: e.target.value }))}
                placeholder="Connector name"
                className="h-10"
              />
              <label className="h-10 rounded-md border px-3 flex items-center justify-between text-xs font-medium">
                Enable Connector
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
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Feishu Credentials</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                value={form.appId}
                onChange={(e) => setForm((prev) => ({ ...prev, appId: e.target.value }))}
                placeholder="App ID"
                className="h-10"
              />
              <div className="relative">
                <Input
                  value={form.appSecret}
                  type={isSecretVisible ? 'text' : 'password'}
                  onChange={(e) => setForm((prev) => ({ ...prev, appSecret: e.target.value }))}
                  placeholder="App Secret"
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
              <Input
                value={form.verificationToken}
                onChange={(e) => setForm((prev) => ({ ...prev, verificationToken: e.target.value }))}
                placeholder="Verification Token"
                className="h-10"
              />
              <Input
                value={form.encryptKey}
                onChange={(e) => setForm((prev) => ({ ...prev, encryptKey: e.target.value }))}
                placeholder="Encrypt Key (optional)"
                className="h-10"
              />
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Event Callback</h3>
            <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
              <Input value={callbackUrl} readOnly className="h-10 font-mono text-xs" />
              <Button type="button" variant="outline" className="h-10" onClick={handleCopyCallback}>
                {isCopied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                {isCopied ? 'Copied' : 'Copy URL'}
              </Button>
              <Button type="button" variant="outline" className="h-10" onClick={handleVerifyCallback} disabled={isVerifying}>
                {isVerifying ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Link2 className="h-4 w-4 mr-1" />}
                Verify Callback
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Last verified: {lastVerifyAt ? new Date(lastVerifyAt).toLocaleString() : 'Never'}
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Conversation Scope</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="h-10 rounded-md border px-3 flex items-center justify-between text-xs font-medium">
                Allow Direct Messages
                <input
                  type="checkbox"
                  checked={form.allowDm}
                  onChange={(e) => setForm((prev) => ({ ...prev, allowDm: e.target.checked }))}
                  className="h-4 w-4"
                />
              </label>
              <label className="h-10 rounded-md border px-3 flex items-center justify-between text-xs font-medium">
                Allow Group Mentions
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
              placeholder="Allowed chat IDs (comma separated)"
              className="h-10"
            />
            <Input
              value={form.userWhitelist}
              onChange={(e) => setForm((prev) => ({ ...prev, userWhitelist: e.target.value }))}
              placeholder="User whitelist (comma separated)"
              className="h-10"
            />
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Message Behavior</h3>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="h-10 rounded-md border px-3 flex items-center justify-between text-xs font-medium">
                Mention Required
                <input
                  type="checkbox"
                  checked={form.mentionRequired}
                  onChange={(e) => setForm((prev) => ({ ...prev, mentionRequired: e.target.checked }))}
                  className="h-4 w-4"
                />
              </label>
              <label className="h-10 rounded-md border px-3 flex items-center justify-between text-xs font-medium">
                Ignore Bot Messages
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
                placeholder="Prefix command"
                className="h-10"
              />
            </div>
            <Input
              type="number"
              min={1}
              max={300}
              value={form.rateLimitPerMinute}
              onChange={(e) => setForm((prev) => ({ ...prev, rateLimitPerMinute: Number(e.target.value || 1) }))}
              placeholder="Rate limit per minute"
              className="h-10 w-full md:w-64"
            />
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Test & Logs</h3>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={handleTestMessage} disabled={isTesting}>
                {isTesting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                Send Test Message
              </Button>
              <Button type="button" variant="outline" onClick={handleSaveDraft} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                Save Draft
              </Button>
              <Button type="button" onClick={handleSaveAndEnable} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <BadgeCheck className="h-4 w-4 mr-1" />}
                Save & Enable
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
                <span>Time</span>
                <span>Action</span>
                <span>Detail</span>
              </div>
              {logs.length === 0 ? (
                <div className="p-4 text-xs text-muted-foreground text-center">No connector logs yet.</div>
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
              Backend Integration Notes
            </p>
            <p className="inline-flex items-center gap-1.5">
              <Settings2 className="h-3.5 w-3.5" />
              This page is frontend-ready now and expects backend APIs listed in `frontend/BACKEND_PENDING.md`.
            </p>
            <p className="inline-flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" />
              After backend wiring, Feishu messages can be routed directly into Butler dialogue flow.
            </p>
          </section>
        </CardContent>
      </Card>
    </div>
  );
};

export default FeishuIntegrationSettings;
