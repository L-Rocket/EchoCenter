import { useCallback, useEffect, useMemo, useState } from 'react';
import { BadgeCheck, Eye, EyeOff, Loader2, Save, Webhook } from 'lucide-react';
import api from '@/services/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/hooks/useI18n';

type ConnectorStatus = 'not_connected' | 'connecting' | 'connected' | 'error';

interface FeishuConnectorDTO {
  id?: number;
  connector_name?: string;
  enabled?: boolean;
  status?: string;
  app_id?: string;
  has_app_secret?: boolean;
  has_verification_token?: boolean;
  has_encrypt_key?: boolean;
  callback_verified?: boolean;
  last_verified_at?: string | null;
}

interface ConnectorForm {
  connectorName: string;
  appId: string;
  appSecret: string;
  verificationToken: string;
  encryptKey: string;
}

const INITIAL_FORM: ConnectorForm = {
  connectorName: 'Feishu Butler Connector',
  appId: '',
  appSecret: '',
  verificationToken: '',
  encryptKey: '',
};

const getStatusBadge = (status: ConnectorStatus) => {
  if (status === 'connected') return { variant: 'default' as const, label: 'Connected' };
  if (status === 'connecting') return { variant: 'secondary' as const, label: 'Connecting' };
  if (status === 'error') return { variant: 'destructive' as const, label: 'Error' };
  return { variant: 'outline' as const, label: 'Not Connected' };
};

const normalizeStatus = (raw: string | undefined): ConnectorStatus => {
  const status = (raw || '').trim().toLowerCase();
  if (status === 'connected') return 'connected';
  if (status === 'connecting') return 'connecting';
  if (status === 'error') return 'error';
  return 'not_connected';
};

const FeishuIntegrationSettings = () => {
  const { tx } = useI18n();
  const [connectorId, setConnectorId] = useState<number | null>(null);
  const [status, setStatus] = useState<ConnectorStatus>('not_connected');
  const [enabled, setEnabled] = useState(false);
  const [callbackVerified, setCallbackVerified] = useState(false);
  const [lastVerifiedAt, setLastVerifiedAt] = useState<string>('');
  const [form, setForm] = useState<ConnectorForm>(INITIAL_FORM);
  const [isSecretVisible, setIsSecretVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const wsURL = useMemo(() => 'wss://open.feishu.cn/open-apis/ws/v2', []);

  const applyConnector = useCallback((data: FeishuConnectorDTO) => {
    const id = typeof data.id === 'number' && data.id > 0 ? data.id : null;
    setConnectorId(id);
    setStatus(normalizeStatus(data.status));
    setEnabled(Boolean(data.enabled));
    setCallbackVerified(Boolean(data.callback_verified));
    setLastVerifiedAt(data.last_verified_at || '');

    setForm((prev) => ({
      connectorName: data.connector_name || prev.connectorName || INITIAL_FORM.connectorName,
      appId: data.app_id || '',
      appSecret: '',
      verificationToken: '',
      encryptKey: '',
    }));
  }, []);

  const loadConnector = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const { data } = await api.get<FeishuConnectorDTO>('/api/integrations/feishu');
      applyConnector(data);
    } catch {
      setError(tx('Failed to load Feishu connector configuration.', '加载飞书连接器配置失败。'));
    } finally {
      setIsLoading(false);
    }
  }, [applyConnector, tx]);

  useEffect(() => {
    loadConnector();
  }, [loadConnector]);

  const validateRequired = () => {
    if (!form.connectorName.trim() || !form.appId.trim()) {
      setError(tx('Connector name and App ID are required.', '连接器名称和 App ID 为必填项。'));
      return false;
    }
    return true;
  };

  const buildPayload = () => ({
    connector_name: form.connectorName.trim(),
    app_id: form.appId.trim(),
    ...(form.appSecret.trim() ? { app_secret: form.appSecret.trim() } : {}),
    ...(form.verificationToken.trim() ? { verification_token: form.verificationToken.trim() } : {}),
    ...(form.encryptKey.trim() ? { encrypt_key: form.encryptKey.trim() } : {}),
  });

  const handleSave = async () => {
    if (!validateRequired()) return;
    setIsSaving(true);
    setError('');
    setNotice('');
    try {
      if (connectorId) {
        const { data } = await api.patch<FeishuConnectorDTO>(`/api/integrations/feishu/${connectorId}`, buildPayload());
        applyConnector(data);
      } else {
        const { data } = await api.post<FeishuConnectorDTO>('/api/integrations/feishu', buildPayload());
        applyConnector(data);
      }
      setNotice(tx('Configuration saved.', '配置已保存。'));
    } catch {
      setError(tx('Failed to save configuration.', '保存配置失败。'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleVerify = async () => {
    if (!connectorId) {
      setError(tx('Save configuration first, then verify.', '请先保存配置，再进行验证。'));
      return;
    }
    setIsVerifying(true);
    setError('');
    setNotice('');
    try {
      const { data } = await api.post<{ ok: boolean; message?: string; connector?: FeishuConnectorDTO }>(
        `/api/integrations/feishu/${connectorId}/verify-callback`,
      );
      if (data.connector) {
        applyConnector(data.connector);
      } else {
        await loadConnector();
      }
      if (data.ok) {
        setNotice(tx('Verification succeeded.', '验证成功。'));
      } else {
        setError(data.message || tx('Verification failed.', '验证失败。'));
      }
    } catch {
      setError(tx('Verification request failed.', '验证请求失败。'));
    } finally {
      setIsVerifying(false);
    }
  };

  const handleToggleEnabled = async () => {
    if (!connectorId) {
      setError(tx('Save configuration first, then enable.', '请先保存配置，再启用。'));
      return;
    }
    setIsToggling(true);
    setError('');
    setNotice('');
    try {
      const { data } = await api.patch<FeishuConnectorDTO>(`/api/integrations/feishu/${connectorId}/enable`, { enabled: !enabled });
      applyConnector(data);
      setNotice(!enabled ? tx('Connector enabled.', '连接器已启用。') : tx('Connector disabled.', '连接器已禁用。'));
    } catch {
      setError(!enabled
        ? tx('Failed to enable connector. Please verify first.', '启用失败，请先完成验证。')
        : tx('Failed to disable connector.', '禁用失败。'));
    } finally {
      setIsToggling(false);
    }
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
                {tx('Configure Feishu long connection and route messages to Butler.', '配置飞书长连接，并将消息路由到 Butler。')}
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
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{tx('Connection Config', '连接配置')}</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                value={form.connectorName}
                onChange={(e) => setForm((prev) => ({ ...prev, connectorName: e.target.value }))}
                placeholder={tx('Connector name', '连接器名称')}
                className="h-10"
              />
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
                  placeholder={tx('App Secret (leave empty to keep unchanged)', 'App Secret（留空表示不修改）')}
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
                placeholder={tx('Verification Token (optional)', 'Verification Token（可选）')}
                className="h-10"
              />
              <Input
                value={form.encryptKey}
                onChange={(e) => setForm((prev) => ({ ...prev, encryptKey: e.target.value }))}
                placeholder={tx('Encrypt Key (optional)', 'Encrypt Key（可选）')}
                className="h-10"
              />
              <Input value={wsURL} readOnly className="h-10 font-mono text-xs md:col-span-2" />
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{tx('Actions', '操作')}</h3>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={handleSave} disabled={isSaving || isLoading}>
                {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                {tx('Save', '保存')}
              </Button>
              <Button type="button" variant="outline" onClick={handleVerify} disabled={isVerifying || isLoading || !connectorId}>
                {isVerifying ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <BadgeCheck className="h-4 w-4 mr-1" />}
                {tx('Verify', '验证')}
              </Button>
              <Button type="button" onClick={handleToggleEnabled} disabled={isToggling || isLoading || !connectorId}>
                {isToggling ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Webhook className="h-4 w-4 mr-1" />}
                {enabled ? tx('Disable', '禁用') : tx('Enable', '启用')}
              </Button>
              <Button type="button" variant="ghost" onClick={loadConnector} disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : tx('Refresh', '刷新')}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {tx('Verification:', '验证状态：')} {callbackVerified ? tx('verified', '已验证') : tx('not verified', '未验证')}
              {lastVerifiedAt ? ` · ${new Date(lastVerifiedAt).toLocaleString()}` : ''}
            </p>
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
          </section>
        </CardContent>
      </Card>
    </div>
  );
};

export default FeishuIntegrationSettings;

