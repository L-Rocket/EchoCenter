import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, Users, LogOut, Terminal } from 'lucide-react';

interface MainLayoutProps {
  children: React.ReactNode;
  view: 'MESSAGES' | 'USERS';
  setView: (view: 'MESSAGES' | 'USERS') => void;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children, view, setView }) => {
  const { logout, isAdmin, user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 shadow-sm">
        <div className="container max-w-5xl mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <div className="bg-indigo-600 p-1.5 rounded-lg shadow-indigo-200 shadow-lg">
                <Terminal className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold tracking-tight text-slate-900">EchoCenter</span>
            </div>
            
            <nav className="hidden md:flex items-center gap-1">
              <Button 
                variant={view === 'MESSAGES' ? 'secondary' : 'ghost'} 
                size="sm"
                className="gap-2"
                onClick={() => setView('MESSAGES')}
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Button>
              {isAdmin && (
                <Button 
                  variant={view === 'USERS' ? 'secondary' : 'ghost'} 
                  size="sm"
                  className="gap-2"
                  onClick={() => setView('USERS')}
                >
                  <Users className="h-4 w-4" />
                  Team
                </Button>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end hidden sm:flex">
              <span className="text-sm font-medium text-slate-900">{user?.username}</span>
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{user?.role}</span>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={logout}
              className="text-slate-500 hover:text-red-600 transition-colors"
              title="Logout"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-grow container max-w-5xl mx-auto py-8 px-4">
        {children}
      </main>

      <footer className="border-t bg-white py-8">
        <div className="container max-w-5xl mx-auto px-4 text-center">
          <p className="text-sm text-slate-500">
            &copy; {new Date().getFullYear()} EchoCenter &bull; <span className="font-medium">Secure Session Active</span>
          </p>
          <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest font-semibold">
            Agent Intelligence Monitoring Hub
          </p>
        </div>
      </footer>
    </div>
  );
};

export default MainLayout;
