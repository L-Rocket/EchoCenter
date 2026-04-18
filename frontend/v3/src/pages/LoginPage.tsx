import LoginForm from '@/components/auth/LoginForm';
import { useAuth } from '@/context/AuthContext';
import { Navigate, useLocation } from 'react-router-dom';

const LoginPage = () => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const state = location.state as { from?: { pathname?: string } } | null;
  const from = state?.from?.pathname || '/dashboard';

  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  // LoginForm owns its own full-screen shell with the v3 ambient gradient background.
  return <LoginForm />;
};

export default LoginPage;
