import { useCallback, useEffect, useState } from 'react';
import { Bot, Eye, EyeOff, Loader2, RotateCcw, Save, Wifi } from 'lucide-react';
import {
  getButlerConfig,
  updateButlerConfig,
  resetButlerConfig,
  testButlerConnectivity,
  type ButlerConfigDTO,
} from '@/services/butlerConfigService';

interface ConfigForm {
  model_name: string;
  base_url: string;
  api_token: string;
}

const EMPTY_FORM: ConfigForm = { model_name: '', base_url: '', api_token: '' };

const sourceLabel: Record<string, string> = {
  db: 'Database',
  env: 'Environment',
  none: 'Not configured',
};

const ButlerConfigSettings = () => {
  const [config, setConfig] = useState<ButlerConfigDTO | null>(null);
  const [form, setForm] = useState<ConfigForm>(EMPTY_FORM);
  const [isEditing, setIsEditing] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; latency_ms: number } | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const applyConfig = useCallback((data: ButlerConfigDTO) => {
    setConfig(data);
    setForm({ model_name: data.model_name, base_url: data.base_url, api_token: '' });
  }, []);

  const loadConfig = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const { data } = await getButlerConfig();
      applyConfig(data);
    } catch {
      setError('Failed to load Butler configuration.');
    } finally {
      setIsLoading(false);
    }
  }, [applyConfig]);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const handleEdit = () => { setIsEditing(true); setTestResult(null); setError(''); setNotice(''); };
  const handleCancel = () => {
    setIsEditing(false);
    setShowToken(false);
    setTestResult(null);
    setError('');
    setNotice('');
    if (config) setForm({ model_name: config.model_name, base_url: config.base_url, api_token: '' });
  };

  const handleTest = async () => {
    if (!form.model_name.trim() || !form.base_url.trim()) {
      setError('Model name and Base URL are required for connectivity test.');
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    setError('');
    try {
      const { data } = await testButlerConnectivity({
        model_name: form.model_name.trim(),
        base_url: form.base_url.trim(),
        api_token: form.api_token.trim(),
      });
      setTestResult(data);
    } catch {
      setError('Connectivity test request failed.');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    if (!form.model_name.trim() || !form.base_url.trim()) {
      setError('Model name and Base URL are required.');
      return;
    }
    setIsSaving(true);
    setError('');
    setNotice('');
    try {
      await updateButlerConfig({
        model_name: form.model_name.trim(),
        base_url: form.base_url.trim(),
        api_token: form.api_token.trim(),
      });
      setNotice('Configuration saved and applied.');
      setIsEditing(false);
      setShowToken(false);
      setTestResult(null);
      await loadConfig();
    } catch {
      setError('Failed to save configuration.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Reset Butler configuration to environment variable defaults?')) return;
    setIsResetting(true);
    setError('');
    setNotice('');
    try {
      await resetButlerConfig();
      setNotice('Configuration reset to defaults.');
      await loadConfig();
    } catch {
      setError('Failed to reset configuration.');
    } finally {
      setIsResetting(false);
    }
  };

  const field = (label: string, value: string, key: keyof ConfigForm, placeholder?: string, isSecret = false) => (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>
        {label}
      </div>
      {isEditing ? (
        <div style={{ position: 'relative' }}>
          <input
            type={isSecret && !showToken ? 'password' : 'text'}
            value={value}
            placeholder={placeholder}
            onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '8px 36px 8px 10px',
              borderRadius: 8,
              border: '1px solid var(--border-base)',
              background: 'var(--bg-sunken)',
              color: 'var(--fg)',
              fontSize: 13,
              outline: 'none',
            }}
          />
          {isSecret && (
            <button
              type="button"
              onClick={() => setShowToken((v) => !v)}
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-muted)', display: 'grid', placeItems: 'center' }}
            >
              {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          )}
        </div>
      ) : (
        <div style={{ fontSize: 13, color: 'var(--fg)', padding: '8px 10px', borderRadius: 8, background: 'var(--bg-sunken)', border: '1px solid var(--border-faint)', minHeight: 36 }}>
          {value || <span style={{ color: 'var(--fg-faint)' }}>{placeholder || '—'}</span>}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent-soft)', color: 'var(--accent-hue)', display: 'grid', placeItems: 'center', border: '1px solid var(--border-faint)' }}>
          <Bot size={16} />
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Butler Model</div>
          <div style={{ fontSize: 12, color: 'var(--fg-muted)' }}>
            {config ? `Source: ${sourceLabel[config.config_source] ?? config.config_source}` : 'Loading…'}
          </div>
        </div>
        {!isEditing && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button
              onClick={handleReset}
              disabled={isResetting || isLoading}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border-base)', background: 'transparent', cursor: 'pointer', color: 'var(--fg-muted)', fontSize: 12 }}
            >
              {isResetting ? <Loader2 size={12} className="spin" /> : <RotateCcw size={12} />} Reset
            </button>
            <button
              onClick={handleEdit}
              disabled={isLoading}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: '1px solid var(--accent-hue)', background: 'var(--accent-soft)', cursor: 'pointer', color: 'var(--accent-hue)', fontSize: 12, fontWeight: 600 }}
            >
              Edit
            </button>
          </div>
        )}
      </div>

      {isLoading && <div style={{ color: 'var(--fg-muted)', fontSize: 13 }}>Loading…</div>}

      {!isLoading && (
        <>
          {field('Model Name', form.model_name, 'model_name', 'e.g. claude-3-5-sonnet-20241022')}
          {field('Base URL', form.base_url, 'base_url', 'e.g. https://api.anthropic.com/v1')}
          {isEditing
            ? field('API Token', form.api_token, 'api_token', 'Leave blank to keep existing token', true)
            : (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>API Token</div>
                <div style={{ fontSize: 13, color: 'var(--fg)', padding: '8px 10px', borderRadius: 8, background: 'var(--bg-sunken)', border: '1px solid var(--border-faint)', fontFamily: 'monospace' }}>
                  {config?.api_token_hint || <span style={{ color: 'var(--fg-faint)' }}>Not configured</span>}
                </div>
              </div>
            )}

          {config?.updated_by && (
            <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginBottom: 14 }}>
              Last updated by <strong>{config.updated_by}</strong>
              {config.updated_at && <> · {new Date(config.updated_at).toLocaleString()}</>}
            </div>
          )}

          {testResult && (
            <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 8, background: testResult.ok ? 'var(--success-soft, #f0fdf4)' : 'var(--error-soft, #fef2f2)', border: `1px solid ${testResult.ok ? '#86efac' : '#fca5a5'}`, fontSize: 13 }}>
              <span style={{ fontWeight: 600 }}>{testResult.ok ? '✓ Connected' : '✗ Failed'}</span>
              {' · '}{testResult.message}
              {testResult.latency_ms > 0 && <span style={{ color: 'var(--fg-muted)' }}> · {testResult.latency_ms}ms</span>}
            </div>
          )}

          {error && (
            <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 8, background: 'var(--error-soft, #fef2f2)', border: '1px solid #fca5a5', fontSize: 13, color: '#b91c1c' }}>
              {error}
            </div>
          )}

          {notice && !error && (
            <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 8, background: 'var(--success-soft, #f0fdf4)', border: '1px solid #86efac', fontSize: 13 }}>
              {notice}
            </div>
          )}

          {isEditing && (
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <button
                onClick={handleTest}
                disabled={isTesting || isSaving}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border-base)', background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'var(--fg)' }}
              >
                {isTesting ? <Loader2 size={13} className="spin" /> : <Wifi size={13} />} Test
              </button>
              <button
                onClick={handleCancel}
                disabled={isSaving || isTesting}
                style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border-base)', background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'var(--fg-muted)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || isTesting}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 8, border: 'none', background: 'var(--accent-hue)', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#fff', marginLeft: 'auto' }}
              >
                {isSaving ? <Loader2 size={13} className="spin" /> : <Save size={13} />} Save
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ButlerConfigSettings;
