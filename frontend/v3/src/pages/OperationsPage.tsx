import UserManagement from '@/components/admin/UserManagement';

const OperationsPage = () => {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, marginBottom: 24 }}>
        <div style={{ maxWidth: 720 }}>
          <div className="eyebrow">Admin · Operations</div>
          <h1 className="h1-display" style={{ margin: '10px 0 8px' }}>Agent lifecycle &amp; access.</h1>
          <p style={{ margin: 0, color: 'var(--fg-muted)', fontSize: 14 }}>
            Register new agents, rotate API tokens, manage integrations and team members. Raw tokens are never shown — only hints.
          </p>
        </div>
      </div>
      <div className="v3-card" style={{ padding: 0, overflow: 'hidden' }}>
        <UserManagement />
      </div>
    </div>
  );
};

export default OperationsPage;
