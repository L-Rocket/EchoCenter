import UserManagement from '@/components/UserManagement'

const TeamPage = () => {
  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center md:text-left">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Team Management</h2>
        <p className="text-sm text-slate-500">Add and manage operators with access to the EchoCenter.</p>
      </div>
      <UserManagement />
    </div>
  )
}

export default TeamPage
