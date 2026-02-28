import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  UserPlus, 
  Users, 
  Trash2, 
  ShieldAlert, 
  Loader2, 
  UserCheck,
  RefreshCw,
  MoreVertical
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';

interface User {
  id: number;
  username: string;
  role: string;
  created_at: string;
}

const API_BASE_URL = 'http://localhost:8080';

const UserManagement = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [newUsername, setNewUsername] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const { user: currentUser } = useAuth();

  const fetchUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await axios.get<User[]>(`${API_BASE_URL}/api/users`);
      setUsers(Array.isArray(response.data) ? response.data : []);
      setError('');
    } catch (_err) {
      setError('Neural link failure: Could not retrieve personnel data.');
      console.error('Fetch users error:', _err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim()) return;
    
    setIsCreating(true);
    try {
      await axios.post(`${API_BASE_URL}/api/users/agents`, {
        username: newUsername,
      });
      setNewUsername('');
      fetchUsers();
    } catch (_err) {
      const axiosError = _err as { response?: { data?: { error?: string } } };
      setError(axiosError.response?.data?.error || 'Registration failed.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (id === currentUser?.id) {
      alert("Cannot decommission your own active terminal.");
      return;
    }

    if (!confirm('Proceed with unit decommissioning? This action is irreversible.')) return;

    try {
      await axios.delete(`${API_BASE_URL}/api/users/agents/${id}`);
      fetchUsers();
    } catch (_err) {
      setError('Decommissioning protocol failed.');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-black tracking-tighter uppercase italic">Personnel <span className="text-primary">Registry</span></h2>
          <p className="text-sm text-muted-foreground font-medium">Monitoring and deployment of authorized neural entities.</p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => fetchUsers()} 
          disabled={isLoading}
          className="h-9 gap-2 border-2 uppercase font-black tracking-widest text-[10px]"
        >
          <RefreshCw className={cn("h-3 w-3", isLoading && "animate-spin")} />
          Sync Registry
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Registration Form */}
        <Card className="lg:col-span-1 border-2 shadow-xl bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-primary" />
              Deploy Agent
            </CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase tracking-wider">
              Initialize a new autonomous neural unit.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateAgent} className="space-y-4">
              <div className="space-y-2">
                <Input
                  placeholder="AGENT DESIGNATION"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="h-11 bg-muted/50 border-2 focus:border-primary font-mono text-xs"
                />
              </div>
              <Button 
                type="submit" 
                className="w-full h-11 uppercase font-black tracking-widest text-[10px] shadow-lg shadow-primary/20" 
                disabled={isCreating}
              >
                {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Authorize Deployment"}
              </Button>
              {error && <p className="text-[9px] font-bold text-destructive uppercase tracking-widest text-center">{error}</p>}
            </form>
          </CardContent>
        </Card>

        {/* Users List */}
        <Card className="lg:col-span-2 border-2 shadow-xl bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Active Entities
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">ID</th>
                    <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Designation</th>
                    <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Classification</th>
                    <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-10 text-center italic text-xs text-muted-foreground font-medium">
                        Registry empty. No neural signatures detected.
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u.id} className="hover:bg-muted/30 transition-colors group">
                        <td className="px-6 py-4 font-mono text-xs text-muted-foreground/60">{u.id}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
                            <span className="text-sm font-bold tracking-tight">{u.username}</span>
                            {u.id === currentUser?.id && (
                              <Badge variant="secondary" className="text-[8px] h-4 uppercase font-black tracking-tighter">Self</Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <Badge 
                            variant={u.role === 'ADMIN' ? 'default' : 'outline'}
                            className={cn(
                              "text-[8px] h-4 uppercase font-black tracking-widest",
                              u.role === 'ADMIN' ? "bg-indigo-600" : "text-muted-foreground border-2"
                            )}
                          >
                            {u.role === 'ADMIN' ? (
                              <ShieldAlert className="h-2 w-2 mr-1" />
                            ) : (
                              <UserCheck className="h-2 w-2 mr-1" />
                            )}
                            {u.role}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40 uppercase font-black text-[10px]">
                              <DropdownMenuItem 
                                className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                                onClick={() => handleDeleteUser(u.id)}
                                disabled={u.id === currentUser?.id}
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-2" />
                                Decommission
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// Helper for conditional classes
function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export default UserManagement;
