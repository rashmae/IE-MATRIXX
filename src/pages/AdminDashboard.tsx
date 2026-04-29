import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  Users, 
  Search, 
  Filter, 
  Download, 
  ArrowLeft,
  Calendar,
  Clock,
  CheckCircle2,
  ShieldCheck,
  User as UserIcon,
  ExternalLink,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import { db } from '@/src/lib/firebase';
import { collection, query, getDocs, orderBy, limit, writeBatch, doc } from 'firebase/firestore';
import { User as UserType } from '@/src/types/index';
import { IE_SUBJECTS } from '@/src/lib/constants';
import Sidebar from '@/src/components/layout/Sidebar';
import BottomNav from '@/src/components/layout/BottomNav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { LiquidButton } from '@/components/ui/liquid-glass';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function AdminDashboard() {
  const { profile, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !profile) {
      navigate('/login');
      return;
    }
    
    if (!authLoading && profile && profile.role !== 'admin') {
      toast.error('Access denied. Admin privileges required.');
      navigate('/dashboard');
      return;
    }
    
    if (profile) {
      fetchUsers();
    }
  }, [profile, authLoading, navigate]);

  const seedSubjects = async () => {
    if (!profile || profile.role !== 'admin') return;
    
    setIsSeeding(true);
    try {
      const batch = writeBatch(db);
      IE_SUBJECTS.forEach((subject) => {
        const docRef = doc(db, 'subjects', subject.id);
        batch.set(docRef, subject, { merge: true });
      });
      await batch.commit();
      toast.success('Successfully seeded curriculum subjects!');
    } catch (error) {
      console.error("Error seeding subjects:", error);
      toast.error('Failed to seed subjects');
    } finally {
      setIsSeeding(false);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'users'), orderBy('lastLogin', sortOrder), limit(100));
      const querySnapshot = await getDocs(q);
      const fetchedUsers = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(fetchedUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error('Failed to fetch user data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile) {
      fetchUsers();
    }
  }, [sortOrder]);

  const toggleSort = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  const filteredUsers = users.filter(u => 
    u.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.idNumber?.includes(searchTerm) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Never';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (authLoading || !profile) return null;

  return (
    <div className="min-h-screen bg-background text-foreground flex transition-colors duration-300">
      <Sidebar user={profile} />
      
      <main className="flex-1 p-6 lg:p-10 pb-32 lg:pb-10 overflow-x-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="text-ctu-gold" size={24} />
              <span className="text-xs font-black text-ctu-gold uppercase tracking-[0.3em]">Command Center</span>
            </div>
            <h1 className="text-7xl md:text-8xl frosted-header font-black tracking-tighter leading-[0.9] py-2">Admin Console</h1>
            <p className="text-foreground/40 mt-3 text-xl font-medium tracking-tight">Monitor all CTU students currently in the Matrix.</p>
          </div>
          
          <div className="flex gap-3">
            <button 
              onClick={() => navigate('/admin/ingest')}
              className="neumorphic-raised hover:neumorphic-pressed px-6 py-3 rounded-2xl text-foreground font-bold text-xs transition-all"
            >
              Syllabus Ingestion
            </button>
            <button 
              onClick={seedSubjects}
              disabled={isSeeding}
              className="neumorphic-raised hover:neumorphic-pressed px-6 py-3 rounded-2xl text-ctu-gold font-bold text-xs transition-all disabled:opacity-50"
            >
              {isSeeding ? 'Seeding...' : 'Seed Subjects'}
            </button>
            <button 
              onClick={fetchUsers}
              className="neumorphic-raised hover:neumorphic-pressed px-6 py-3 rounded-2xl text-foreground font-bold text-xs transition-all"
            >
              Refresh Data
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
          <Card className="neumorphic-card border-none">
            <CardContent className="p-8 flex items-center gap-6">
              <div className="w-14 h-14 rounded-2xl neumorphic-pressed flex items-center justify-center text-ctu-maroon">
                <Users size={28} />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground/40 uppercase tracking-wider">Total Students</p>
                <h3 className="text-3xl font-bold text-foreground mt-1">{users.length}</h3>
              </div>
            </CardContent>
          </Card>
          
          <Card className="neumorphic-card border-none">
            <CardContent className="p-8 flex items-center gap-6">
              <div className="w-14 h-14 rounded-2xl neumorphic-pressed flex items-center justify-center text-ctu-gold">
                <Clock size={28} />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground/40 uppercase tracking-wider">Active Today</p>
                <h3 className="text-3xl font-bold text-foreground mt-1">
                  {users.filter(u => {
                    const lastLogin = u.lastLogin?.toDate ? u.lastLogin.toDate() : new Date(u.lastLogin);
                    return new Date().toDateString() === lastLogin.toDateString();
                  }).length}
                </h3>
              </div>
            </CardContent>
          </Card>

          <Card className="neumorphic-card border-none">
            <CardContent className="p-8 flex items-center gap-6">
              <div className="w-14 h-14 rounded-2xl neumorphic-pressed flex items-center justify-center text-green-500">
                <CheckCircle2 size={28} />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground/40 uppercase tracking-wider">System Status</p>
                <h3 className="text-3xl font-bold text-foreground mt-1">Operational</h3>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* User Table */}
        <Card className="neumorphic-card border-none overflow-hidden">
          <CardHeader className="border-b border-foreground/5 bg-foreground/[0.02] p-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <CardTitle className="text-2xl font-bold">Student Directory</CardTitle>
              <div className="relative w-full md:w-80">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/40" size={18} />
                <Input 
                  placeholder="Search name, ID, or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-12 bg-background border-none neumorphic-pressed text-foreground rounded-2xl h-12 placeholder:text-foreground/30"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-foreground/[0.01] border-b border-foreground/5">
                    <th className="p-6 text-xs font-bold text-foreground/40 uppercase tracking-widest">Student</th>
                    <th className="p-6 text-xs font-bold text-foreground/40 uppercase tracking-widest">ID Number</th>
                    <th className="p-6 text-xs font-bold text-foreground/40 uppercase tracking-widest">Role</th>
                    <th 
                      className="p-6 text-xs font-bold text-foreground/40 uppercase tracking-widest cursor-pointer hover:text-foreground transition-colors group"
                      onClick={toggleSort}
                    >
                      <div className="flex items-center gap-2">
                        Last Login
                        {sortOrder === 'asc' ? (
                          <ArrowUp size={14} className="text-ctu-gold" />
                        ) : (
                          <ArrowDown size={14} className="text-ctu-gold" />
                        )}
                      </div>
                    </th>
                    <th className="p-6 text-xs font-bold text-foreground/40 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-foreground/5">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="p-20 text-center">
                        <div className="flex flex-col items-center gap-4">
                          <div className="w-10 h-10 border-4 border-ctu-gold border-t-transparent rounded-full animate-spin" />
                          <p className="text-sm text-foreground/40 font-bold uppercase tracking-widest">Decrypting user data...</p>
                        </div>
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-20 text-center text-foreground/40 font-bold uppercase tracking-widest">
                        No students found matching your search.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-foreground/[0.02] transition-colors group">
                        <td className="p-6">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full neumorphic-raised flex items-center justify-center text-foreground font-bold text-sm border border-foreground/5">
                              {u.fullName?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                            </div>
                            <div>
                              <p className="text-base font-bold text-foreground">{u.fullName}</p>
                              <p className="text-xs text-foreground/40 font-medium">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-6">
                          <code className="text-xs font-mono text-ctu-gold bg-ctu-gold/10 px-3 py-1.5 rounded-lg font-bold">
                            {u.idNumber}
                          </code>
                        </td>
                        <td className="p-6">
                          <Badge className={cn(
                            "text-[10px] uppercase font-bold border-none px-3 py-1",
                            u.role === 'admin' ? "bg-ctu-maroon text-white" : "neumorphic-pressed text-foreground/40"
                          )}>
                            {u.role}
                          </Badge>
                        </td>
                        <td className="p-6 text-xs text-foreground/60 font-bold">
                          {formatDate(u.lastLogin)}
                        </td>
                        <td className="p-6 text-right">
                          <button className="p-3 neumorphic-raised hover:neumorphic-pressed rounded-xl transition-all text-foreground/40 hover:text-foreground">
                            <ExternalLink size={18} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
}
