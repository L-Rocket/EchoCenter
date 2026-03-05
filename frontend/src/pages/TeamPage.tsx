import UserManagement from '@/components/admin/UserManagement'

const TeamPage = () => {
  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center md:text-left">
        <h2 className="text-2xl font-bold tracking-tight">Agent Operations</h2>
        <p className="text-sm text-muted-foreground">Create agents, manage tokens, and verify connectivity.</p>
      </div>
      <UserManagement />
    </div>
  )
}

export default TeamPage
