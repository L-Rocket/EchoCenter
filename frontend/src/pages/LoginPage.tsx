import LoginForm from '@/components/auth/LoginForm'
import { useAuth } from '@/context/AuthContext'
import { Navigate, useLocation } from 'react-router-dom'

const LoginPage = () => {
  const { isAuthenticated } = useAuth()
  const location = useLocation()
  const from = location.state?.from?.pathname || "/dashboard"

  if (isAuthenticated) {
    return <Navigate to={from} replace />
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950">
      <LoginForm />
    </div>
  )
}

export default LoginPage
