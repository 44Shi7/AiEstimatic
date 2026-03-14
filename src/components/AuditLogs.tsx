import React, { useEffect, useState } from 'react';
import { 
  Activity, 
  Clock, 
  User, 
  Calendar, 
  CheckCircle2, 
  LogIn, 
  LogOut, 
  FileText,
  TrendingUp,
  Users,
  Briefcase,
  Search,
  X,
  Download,
  UserPlus,
  UserMinus,
  Upload,
  BrainCircuit
} from 'lucide-react';

interface Log {
  id: number;
  user_id: string;
  user_name: string;
  user_role: string;
  event_type: string;
  details: string;
  timestamp: string;
}

interface Stats {
  projectsDone: number;
  totalLogins: number;
  activeUsers: number;
}

export function AuditLogs() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchData = async () => {
    try {
      const [logsRes, statsRes] = await Promise.all([
        fetch('/api/logs'),
        fetch('/api/stats')
      ]);
      const logsData = await logsRes.json();
      const statsData = await statsRes.json();
      setLogs(logsData);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to fetch audit data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatTimestamp = (ts: string) => {
    // Ensure timestamp is treated as UTC if it doesn't have a timezone indicator
    const date = new Date(ts.endsWith('Z') ? ts : ts + 'Z');
    return {
      date: date.toLocaleDateString(undefined, { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric' 
      }),
      time: date.toLocaleTimeString(undefined, { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        hour12: true
      })
    };
  };

  const filteredLogs = logs.filter(log => {
    const searchLower = searchTerm.toLowerCase();
    const { date, time } = formatTimestamp(log.timestamp);
    
    // Date range check
    const logDate = new Date(log.timestamp).toISOString().split('T')[0];
    const matchesStartDate = !startDate || logDate >= startDate;
    const matchesEndDate = !endDate || logDate <= endDate;
    
    const matchesSearch = (
      log.event_type.toLowerCase().includes(searchLower) ||
      log.user_name.toLowerCase().includes(searchLower) ||
      log.user_role.toLowerCase().includes(searchLower) ||
      (log.details && log.details.toLowerCase().includes(searchLower)) ||
      date.toLowerCase().includes(searchLower) ||
      time.toLowerCase().includes(searchLower)
    );

    return matchesStartDate && matchesEndDate && matchesSearch;
  });

  const exportToCSV = () => {
    if (logs.length === 0) return;

    const headers = ['ID', 'User ID', 'User Name', 'Role', 'Event Type', 'Details', 'Date', 'Time'];
    const csvRows = logs.map(log => {
      const { date, time } = formatTimestamp(log.timestamp);
      return [
        log.id,
        log.user_id,
        log.user_name,
        log.user_role,
        log.event_type,
        `"${(log.details || '').replace(/"/g, '""')}"`,
        date,
        time
      ].join(',');
    });

    const csvContent = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `IES_Audit_Logs_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Audit & Activity Logs</h2>
          <p className="text-zinc-500 mt-1">Monitor system usage, logins, and project completions.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={exportToCSV}
            className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 bg-white border border-zinc-200 rounded-lg transition-all flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button 
            onClick={fetchData}
            className="px-4 py-2 text-sm font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-50 rounded-lg transition-all flex items-center gap-2"
          >
            <Activity className="w-4 h-4" />
            Refresh Data
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-zinc-200 p-6 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
            <Briefcase className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-500">Projects Completed</p>
            <p className="text-2xl font-bold text-zinc-900">{stats?.projectsDone || 0}</p>
          </div>
        </div>
        <div className="bg-white border border-zinc-200 p-6 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
            <LogIn className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-500">Total Logins</p>
            <p className="text-2xl font-bold text-zinc-900">{stats?.totalLogins || 0}</p>
          </div>
        </div>
        <div className="bg-white border border-zinc-200 p-6 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-500">Active Users</p>
            <p className="text-2xl font-bold text-zinc-900">{stats?.activeUsers || 0}</p>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-zinc-100 bg-zinc-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-sm uppercase tracking-wider text-zinc-500">Activity History</h3>
            <span className="text-xs font-medium text-zinc-400">
              {searchTerm ? `Found ${filteredLogs.length} matches` : 'Showing last 500 events'}
            </span>
          </div>
          
          <div className="flex flex-wrap items-center gap-4 flex-1">
            <div className="relative group max-w-sm w-full">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-zinc-400 group-focus-within:text-emerald-500 transition-colors" />
              </div>
              <input
                type="text"
                placeholder="Search logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-10 py-2 border border-zinc-200 rounded-xl text-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-white"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-white border border-zinc-200 rounded-xl px-3 py-1.5">
                <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                <input 
                  type="date" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="text-xs focus:outline-none bg-transparent"
                />
                <span className="text-zinc-300">to</span>
                <input 
                  type="date" 
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="text-xs focus:outline-none bg-transparent"
                />
                {(startDate || endDate) && (
                  <button 
                    onClick={() => { setStartDate(''); setEndDate(''); }}
                    className="ml-1 text-zinc-400 hover:text-zinc-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="px-6 py-3 text-xs font-bold text-zinc-400 uppercase tracking-wider">Event</th>
                <th className="px-6 py-3 text-xs font-bold text-zinc-400 uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-xs font-bold text-zinc-400 uppercase tracking-wider">Role</th>
                <th className="px-6 py-3 text-xs font-bold text-zinc-400 uppercase tracking-wider">Details</th>
                <th className="px-6 py-3 text-xs font-bold text-zinc-400 uppercase tracking-wider">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-zinc-50/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {log.event_type === 'LOGIN' && <LogIn className="w-4 h-4 text-blue-500" />}
                      {log.event_type === 'LOGOUT' && <LogOut className="w-4 h-4 text-zinc-400" />}
                      {log.event_type === 'PROJECT_COMPLETE' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                      {log.event_type === 'USER_CREATED' && <UserPlus className="w-4 h-4 text-indigo-500" />}
                      {log.event_type === 'USER_DELETED' && <UserMinus className="w-4 h-4 text-rose-500" />}
                      {log.event_type === 'FILES_UPLOADED' && <Upload className="w-4 h-4 text-amber-500" />}
                      {log.event_type === 'AI_CLASSIFICATION' && <BrainCircuit className="w-4 h-4 text-purple-500" />}
                      <span className={`text-xs font-bold uppercase tracking-wider ${
                        log.event_type === 'LOGIN' ? 'text-blue-600' : 
                        log.event_type === 'PROJECT_COMPLETE' ? 'text-emerald-600' : 
                        log.event_type === 'USER_CREATED' ? 'text-indigo-600' :
                        log.event_type === 'USER_DELETED' ? 'text-rose-600' :
                        log.event_type === 'FILES_UPLOADED' ? 'text-amber-600' :
                        log.event_type === 'AI_CLASSIFICATION' ? 'text-purple-600' :
                        'text-zinc-500'
                      }`}>
                        {log.event_type.replace('_', ' ')}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-zinc-100 flex items-center justify-center text-[10px] font-bold text-zinc-600">
                        {log.user_name.charAt(0)}
                      </div>
                      <span className="text-sm font-medium text-zinc-900">{log.user_name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[10px] font-bold bg-zinc-100 text-zinc-500 px-2 py-1 rounded uppercase">
                      {log.user_role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-xs text-zinc-500 truncate max-w-xs" title={log.details}>
                      {(() => {
                        if (!log.details || log.details === 'null') return '-';
                        try {
                          const parsed = JSON.parse(log.details);
                          if (typeof parsed === 'object') {
                            return Object.entries(parsed)
                              .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
                              .join(' | ');
                          }
                          return String(parsed);
                        } catch (e) {
                          return log.details;
                        }
                      })()}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-900">
                        <Calendar className="w-3 h-3 text-zinc-400" />
                        {formatTimestamp(log.timestamp).date}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                        <Clock className="w-3 h-3" />
                        {formatTimestamp(log.timestamp).time}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-zinc-400">
                    {searchTerm ? `No logs matching "${searchTerm}"` : 'No activity logs found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
