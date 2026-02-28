import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserPlus, Shield, User, CheckCircle2, AlertCircle } from 'lucide-react';

const API_BASE_URL = 'http://localhost:8080';

const UserManagement: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('MEMBER');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();

  const handleCreateUser = async (_e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);

    try {
      await axios.post(
        `${API_BASE_URL}/api/users`,
        { username, password, role },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessage(`User ${username} created successfully.`);
      setUsername('');
      setPassword('');
      setRole('MEMBER');
    } catch (_err: any) {
      setError(err.response?.data?.error || 'Failed to create user.');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="bg-primary/10 p-2 rounded-lg text-primary">
              <UserPlus className="h-5 w-5" />
            </div>
            <CardTitle className="text-xl font-bold">Add Team Member</CardTitle>
          </div>
          <CardDescription>
            Invite a new operator to monitor the agent swarm.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleCreateUser}>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold">Username</label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="jdoe"
                    className="pl-10 bg-muted/50 border"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Initial Password</label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  className="bg-muted/50 border"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold">Permission Level</label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="bg-muted/50 border">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <SelectValue placeholder="Select a role" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MEMBER">Member (Read-only status)</SelectItem>
                  <SelectItem value="ADMIN">Admin (User management)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {message && (
              <div className="bg-green-500/10 text-green-600 dark:text-green-400 p-4 rounded-lg border border-green-500/20 flex items-center gap-3 text-sm font-medium">
                <CheckCircle2 className="h-5 w-5" />
                {message}
              </div>
            )}
            {error && (
              <div className="bg-destructive/10 text-destructive p-4 rounded-lg border border-destructive/20 flex items-center gap-3 text-sm font-medium">
                <AlertCircle className="h-5 w-5" />
                {error}
              </div>
            )}
          </CardContent>
          <CardFooter className="border-t px-6 py-4 rounded-b-xl">
            <Button type="submit" className="w-full md:w-auto ml-auto px-8 shadow-md bg-emerald-600 hover:bg-emerald-700 text-white">
              Create Account
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default UserManagement;
