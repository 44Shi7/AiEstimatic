import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Activity, 
  Database, 
  Upload, 
  Settings, 
  ShieldCheck, 
  AlertCircle,
  FileSpreadsheet,
  RefreshCw,
  CheckCircle2,
  Clock,
  HardDrive
} from 'lucide-react';
import { UserManagement } from './UserManagement';
import { AuditLogs } from './AuditLogs';
import { User, SystemMapping, SectionRule } from '../types';
import { SYSTEM_MAPPING as DEFAULT_SYSTEM_MAPPING, SECTION_RULES as DEFAULT_SECTION_RULES } from '../services/estimator';
import { Plus, Trash2, Save, X } from 'lucide-react';

interface AdminPanelProps {
  currentUser: User;
  logEvent: (type: string, details?: any) => void;
}

interface DBStats {
  exists: boolean;
  size?: number;
  lastModified?: string;
  name?: string;
}

export function AdminPanel({ currentUser, logEvent }: AdminPanelProps) {
  const [activeSubTab, setActiveSubTab] = useState<'users' | 'audit' | 'database' | 'mapping'>('database');
  const [selectedDb, setSelectedDb] = useState<'Accubid' | 'Conest' | 'McCormic'>('Accubid');
  const [dbStats, setDbStats] = useState<DBStats | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  // Mapping State
  const [systemMapping, setSystemMapping] = useState<SystemMapping>({});
  const [sectionRules, setSectionRules] = useState<SectionRule[]>([]);
  const [isSavingMapping, setIsSavingMapping] = useState(false);
  const [mappingStatus, setMappingStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  // Editing State
  const [newTag, setNewTag] = useState({ tag: '', system: '' });
  const [newRule, setNewRule] = useState<SectionRule>({ section: '', keywords: [], unit: 'EA' });
  const [newKeyword, setNewKeyword] = useState('');

  const fetchMappings = async () => {
    try {
      const sysResponse = await fetch('/api/settings/system_mapping');
      const secResponse = await fetch('/api/settings/section_rules');
      
      if (sysResponse.ok) {
        const data = await sysResponse.json();
        setSystemMapping(data || DEFAULT_SYSTEM_MAPPING);
      } else {
        setSystemMapping(DEFAULT_SYSTEM_MAPPING);
      }

      if (secResponse.ok) {
        const data = await secResponse.json();
        setSectionRules(data || DEFAULT_SECTION_RULES);
      } else {
        setSectionRules(DEFAULT_SECTION_RULES);
      }
    } catch (err) {
      console.error('Failed to fetch mappings:', err);
      setSystemMapping(DEFAULT_SYSTEM_MAPPING);
      setSectionRules(DEFAULT_SECTION_RULES);
    }
  };

  const saveMappings = async (type: 'system' | 'section') => {
    setIsSavingMapping(true);
    setMappingStatus(null);
    try {
      const key = type === 'system' ? 'system_mapping' : 'section_rules';
      const value = type === 'system' ? systemMapping : sectionRules;
      
      const response = await fetch(`/api/settings/${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value })
      });

      if (response.ok) {
        setMappingStatus({ type: 'success', message: `${type === 'system' ? 'System tags' : 'Section rules'} saved successfully!` });
        logEvent('MAPPING_UPDATED', { type });
      } else {
        setMappingStatus({ type: 'error', message: 'Failed to save changes.' });
      }
    } catch (err) {
      setMappingStatus({ type: 'error', message: 'An error occurred while saving.' });
    } finally {
      setIsSavingMapping(false);
      setTimeout(() => setMappingStatus(null), 3000);
    }
  };

  const fetchDbStats = async () => {
    try {
      const response = await fetch(`/api/admin/db-stats?type=${selectedDb}`);
      if (response.ok) {
        const data = await response.json();
        setDbStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch DB stats:', err);
    }
  };

  useEffect(() => {
    fetchDbStats();
    fetchMappings();
  }, [selectedDb]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadStatus(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`/api/admin/upload-db?type=${selectedDb}`, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        setUploadStatus({ type: 'success', message: 'Database file updated successfully!' });
        fetchDbStats();
      } else {
        setUploadStatus({ type: 'error', message: 'Failed to upload database file.' });
      }
    } catch (err) {
      setUploadStatus({ type: 'error', message: 'An error occurred during upload.' });
    } finally {
      setIsUploading(false);
      // Clear status after 5 seconds
      setTimeout(() => setUploadStatus(null), 5000);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="flex flex-col h-full bg-zinc-50">
      {/* Header */}
      <div className="bg-white border-b border-zinc-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 rounded-lg">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900">Admin Panel</h2>
            <p className="text-xs text-zinc-500">System management and configuration</p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 bg-white border-r border-zinc-200 p-4 flex flex-col gap-1">
          <button 
            onClick={() => setActiveSubTab('database')}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              activeSubTab === 'database' 
                ? 'bg-emerald-50 text-emerald-700' 
                : 'text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            <Database className="w-4 h-4" />
            Pricing Database
          </button>
          <button 
            onClick={() => setActiveSubTab('users')}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              activeSubTab === 'users' 
                ? 'bg-emerald-50 text-emerald-700' 
                : 'text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            <Users className="w-4 h-4" />
            User Management
          </button>
          <button 
            onClick={() => setActiveSubTab('audit')}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              activeSubTab === 'audit' 
                ? 'bg-emerald-50 text-emerald-700' 
                : 'text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            <Activity className="w-4 h-4" />
            Audit Logs
          </button>
          <button 
            onClick={() => setActiveSubTab('mapping')}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              activeSubTab === 'mapping' 
                ? 'bg-emerald-50 text-emerald-700' 
                : 'text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            <Settings className="w-4 h-4" />
            System Mapping
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeSubTab === 'database' && (
            <div className="max-w-4xl space-y-6">
              <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                    Pricing Database Management
                  </h3>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-zinc-500">Select Database:</span>
                    <select 
                      value={selectedDb}
                      onChange={(e) => setSelectedDb(e.target.value as any)}
                      className="bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-1.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    >
                      <option value="Accubid">Accubid</option>
                      <option value="Conest">Conest</option>
                      <option value="McCormic">McCormic</option>
                    </select>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                  <div className="bg-zinc-50 border border-zinc-100 p-4 rounded-xl">
                    <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-bold uppercase tracking-wider mb-1">
                      <HardDrive className="w-3 h-3" />
                      File Status
                    </div>
                    <p className={`text-sm font-bold ${dbStats?.exists ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {dbStats?.exists ? 'Active' : 'Missing'}
                    </p>
                  </div>
                  <div className="bg-zinc-50 border border-zinc-100 p-4 rounded-xl">
                    <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-bold uppercase tracking-wider mb-1">
                      <Clock className="w-3 h-3" />
                      Last Updated
                    </div>
                    <p className="text-sm font-bold text-zinc-900">
                      {dbStats?.lastModified ? new Date(dbStats.lastModified).toLocaleString() : 'Never'}
                    </p>
                  </div>
                  <div className="bg-zinc-50 border border-zinc-100 p-4 rounded-xl">
                    <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-bold uppercase tracking-wider mb-1">
                      <RefreshCw className="w-3 h-3" />
                      File Size
                    </div>
                    <p className="text-sm font-bold text-zinc-900">
                      {dbStats?.size ? formatSize(dbStats.size) : '0 KB'}
                    </p>
                  </div>
                </div>

                <div className="border-2 border-dashed border-zinc-200 rounded-2xl p-10 flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
                    <Upload className="w-8 h-8 text-emerald-600" />
                  </div>
                  <h4 className="text-lg font-bold text-zinc-900 mb-2">Update {selectedDb} Database</h4>
                  <p className="text-sm text-zinc-500 mb-6 max-w-md">
                    Upload a new {selectedDb} Excel file to update the system pricing. This will replace the existing {selectedDb} database file.
                  </p>
                  
                  <label className={`relative cursor-pointer px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
                    isUploading 
                      ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed' 
                      : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-600/20'
                  }`}>
                    {isUploading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        Select New Database File
                      </>
                    )}
                    <input 
                      type="file" 
                      className="hidden" 
                      accept=".xlsx" 
                      onChange={handleFileUpload}
                      disabled={isUploading}
                    />
                  </label>
                  
                  {uploadStatus && (
                    <div className={`mt-4 flex items-center gap-2 text-sm font-medium ${
                      uploadStatus.type === 'success' ? 'text-emerald-600' : 'text-red-600'
                    }`}>
                      {uploadStatus.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                      {uploadStatus.message}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                  <div>
                    <h4 className="text-sm font-bold text-amber-900 mb-1">Important Note</h4>
                    <p className="text-xs text-amber-800 leading-relaxed">
                      Ensure the Excel file follows the required format: Column G for Unit Cost and Column K for Labor Rate. The system expects 18 worksheets for different electrical categories.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSubTab === 'users' && (
            <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
              <UserManagement logEvent={logEvent} />
            </div>
          )}

          {activeSubTab === 'audit' && (
            <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
              <AuditLogs />
            </div>
          )}

          {activeSubTab === 'mapping' && (
            <div className="max-w-6xl space-y-6">
              <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-base font-bold text-zinc-900">System & Category Mapping</h3>
                    <p className="text-sm text-zinc-500">
                      Configure how PlanSwift items are mapped to internal systems and sections.
                    </p>
                  </div>
                  {mappingStatus && (
                    <div className={`flex items-center gap-2 text-sm font-medium ${
                      mappingStatus.type === 'success' ? 'text-emerald-600' : 'text-red-600'
                    }`}>
                      {mappingStatus.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                      {mappingStatus.message}
                    </div>
                  )}
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* System Mapping */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-zinc-700 uppercase tracking-wider">System Tags</h4>
                      <button 
                        onClick={() => saveMappings('system')}
                        disabled={isSavingMapping}
                        className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 text-white text-[10px] font-bold rounded hover:bg-emerald-700 transition-all disabled:opacity-50"
                      >
                        <Save className="w-3 h-3" />
                        Save Tags
                      </button>
                    </div>

                    {/* Add New Tag */}
                    <div className="bg-zinc-50 border border-zinc-200 p-3 rounded-xl flex gap-2">
                      <input 
                        type="text"
                        placeholder="Tag (e.g. FA)"
                        value={newTag.tag}
                        onChange={(e) => setNewTag({ ...newTag, tag: e.target.value.toUpperCase() })}
                        className="flex-1 bg-white border border-zinc-200 rounded px-3 py-1.5 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                      <input 
                        type="text"
                        placeholder="System Name"
                        value={newTag.system}
                        onChange={(e) => setNewTag({ ...newTag, system: e.target.value.toUpperCase() })}
                        className="flex-1 bg-white border border-zinc-200 rounded px-3 py-1.5 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                      <button 
                        onClick={() => {
                          if (newTag.tag && newTag.system) {
                            setSystemMapping({ ...systemMapping, [newTag.tag]: newTag.system });
                            setNewTag({ tag: '', system: '' });
                          }
                        }}
                        className="p-1.5 bg-zinc-900 text-white rounded hover:bg-zinc-800 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="bg-zinc-50 border border-zinc-100 rounded-xl overflow-hidden">
                      <div className="max-h-[500px] overflow-y-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-zinc-100 sticky top-0">
                            <tr>
                              <th className="px-4 py-2 font-bold text-zinc-500">Tag</th>
                              <th className="px-4 py-2 font-bold text-zinc-500">System</th>
                              <th className="px-4 py-2 font-bold text-zinc-500 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-200">
                            {Object.entries(systemMapping).sort((a, b) => a[0].localeCompare(b[0])).map(([tag, system]) => (
                              <tr key={tag} className="hover:bg-white transition-colors group">
                                <td className="px-4 py-2 font-mono font-bold text-emerald-600">{tag}</td>
                                <td className="px-4 py-2 text-zinc-600">{system}</td>
                                <td className="px-4 py-2 text-right">
                                  <button 
                                    onClick={() => {
                                      const newMapping = { ...systemMapping };
                                      delete newMapping[tag];
                                      setSystemMapping(newMapping);
                                    }}
                                    className="p-1 text-zinc-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Section Rules */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-zinc-700 uppercase tracking-wider">Section Rules</h4>
                      <button 
                        onClick={() => saveMappings('section')}
                        disabled={isSavingMapping}
                        className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 text-white text-[10px] font-bold rounded hover:bg-emerald-700 transition-all disabled:opacity-50"
                      >
                        <Save className="w-3 h-3" />
                        Save Rules
                      </button>
                    </div>

                    {/* Add New Rule */}
                    <div className="bg-zinc-50 border border-zinc-200 p-4 rounded-xl space-y-3">
                      <div className="flex gap-2">
                        <input 
                          type="text"
                          placeholder="Section Name (e.g. CONDUITS)"
                          value={newRule.section}
                          onChange={(e) => setNewRule({ ...newRule, section: e.target.value.toUpperCase() })}
                          className="flex-1 bg-white border border-zinc-200 rounded px-3 py-1.5 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                        <select 
                          value={newRule.unit}
                          onChange={(e) => setNewRule({ ...newRule, unit: e.target.value })}
                          className="bg-white border border-zinc-200 rounded px-3 py-1.5 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        >
                          <option value="EA">EA</option>
                          <option value="FT">FT</option>
                          <option value="LF">LF</option>
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1 flex flex-wrap gap-1.5 p-2 bg-white border border-zinc-200 rounded min-h-[38px]">
                          {newRule.keywords.map(k => (
                            <span key={k} className="flex items-center gap-1 px-1.5 py-0.5 bg-zinc-100 rounded text-[10px] font-bold text-zinc-600">
                              {k}
                              <button onClick={() => setNewRule({ ...newRule, keywords: newRule.keywords.filter(kw => kw !== k) })}>
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </span>
                          ))}
                          <input 
                            type="text"
                            placeholder="Add keyword..."
                            value={newKeyword}
                            onChange={(e) => setNewKeyword(e.target.value.toUpperCase())}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && newKeyword) {
                                if (!newRule.keywords.includes(newKeyword)) {
                                  setNewRule({ ...newRule, keywords: [...newRule.keywords, newKeyword] });
                                }
                                setNewKeyword('');
                              }
                            }}
                            className="flex-1 outline-none text-xs font-medium min-w-[80px]"
                          />
                        </div>
                        <button 
                          onClick={() => {
                            if (newRule.section && newRule.keywords.length > 0) {
                              setSectionRules([newRule, ...sectionRules]);
                              setNewRule({ section: '', keywords: [], unit: 'EA' });
                            }
                          }}
                          className="px-4 bg-zinc-900 text-white rounded hover:bg-zinc-800 transition-colors flex items-center justify-center"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="bg-zinc-50 border border-zinc-100 rounded-xl overflow-hidden">
                      <div className="max-h-[400px] overflow-y-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-zinc-100 sticky top-0">
                            <tr>
                              <th className="px-4 py-2 font-bold text-zinc-500">Section</th>
                              <th className="px-4 py-2 font-bold text-zinc-500">Keywords</th>
                              <th className="px-4 py-2 font-bold text-zinc-500">Unit</th>
                              <th className="px-4 py-2 font-bold text-zinc-500 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-200">
                            {sectionRules.map((rule, idx) => (
                              <tr key={idx} className="hover:bg-white transition-colors group">
                                <td className="px-4 py-2 font-bold text-zinc-900">{rule.section}</td>
                                <td className="px-4 py-2">
                                  <div className="flex flex-wrap gap-1">
                                    {rule.keywords.map(k => (
                                      <span key={k} className="px-1.5 py-0.5 bg-white border border-zinc-200 rounded text-[9px] text-zinc-500">
                                        {k}
                                      </span>
                                    ))}
                                  </div>
                                </td>
                                <td className="px-4 py-2 font-mono text-zinc-400">{rule.unit}</td>
                                <td className="px-4 py-2 text-right">
                                  <button 
                                    onClick={() => {
                                      setSectionRules(sectionRules.filter((_, i) => i !== idx));
                                    }}
                                    className="p-1 text-zinc-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
