import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Loader2, Lock, User } from 'lucide-react';
import { authService } from '@/services/authService';

const LoginForm = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const { token, user } = await authService.login(username, password);
      login(token, user);
    } catch (err) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      setError(axiosError.response?.data?.error || 'Login failed. Please check your credentials.');
      console.error('Login error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md border-2 shadow-2xl bg-card/50 backdrop-blur-sm animate-in fade-in zoom-in duration-500">
      <CardHeader className="space-y-1 text-center pb-8">
        <div className="flex justify-center mb-4">
          <div className="bg-primary/10 p-4 rounded-2xl text-primary border border-primary/20 shadow-inner">
            <Lock className="h-8 w-8" />
          </div>
        </div>
        <CardTitle className="text-3xl font-black tracking-tighter uppercase italic">
          Echo<span className="text-primary">Center</span>
        </CardTitle>
        <CardDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
          Neural Interface Authentication
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="relative">
              <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="username"
                placeholder="OPERATOR ID"
                className="pl-10 h-12 bg-muted/50 border-2 focus:border-primary transition-all font-mono text-sm"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                placeholder="ACCESS KEY"
                className="pl-10 h-12 bg-muted/50 border-2 focus:border-primary transition-all font-mono text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>
          {error && (
            <div className="text-[10px] font-bold text-destructive bg-destructive/10 p-3 rounded-lg border border-destructive/20 uppercase tracking-wider text-center animate-shake">
              {error}
            </div>
          )}
        </CardContent>
        <CardFooter className="pt-4">
          <Button 
            type="submit" 
            className="w-full h-12 font-black uppercase tracking-[0.2em] shadow-lg shadow-primary/20 transition-all active:scale-95" 
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              "Establish Link"
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
};

export default LoginForm;
