import React, { useState, useEffect, useMemo, useRef } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  FileText, 
  Download, 
  Loader2, 
  Settings, 
  BrainCircuit, 
  Zap, 
  Database,
  ArrowRight,
  Upload,
  CheckCircle2,
  LayoutDashboard,
  Users,
  LogOut,
  Shield,
  Eye,
  Lock,
  Search,
  X,
  Calendar,
  Save,
  Trash2,
  HelpCircle
} from 'lucide-react';
import { saveAs } from 'file-saver';
import logo from './aiestimatic.png';
import { FileUploader } from './components/FileUploader';
import { Auth } from './components/Auth';
import { UserManagement } from './components/UserManagement';
import { AuditLogs } from './components/AuditLogs';
import { AdminPanel } from './components/AdminPanel';
import { ChatBot } from './components/ChatBot';
import { HelpSection } from './components/HelpSection';
import { 
  readPlanSwiftFile, 
  ruleBasedClassify, 
  aiClassify, 
  aggregateItems, 
  fillTemplate,
  SYSTEM_MAPPING as DEFAULT_SYSTEM_MAPPING,
  SECTION_RULES as DEFAULT_SECTION_RULES
} from './services/estimator';
import { PlanSwiftItem, AggregatedItem, ClassificationMode, User, UserRole, SystemMapping, SectionRule } from './types';

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

const ALL_SYSTEMS_DEFAULT = Array.from(new Set(Object.values(DEFAULT_SYSTEM_MAPPING))).sort();
const ALL_SECTIONS_DEFAULT = Array.from(new Set(DEFAULT_SECTION_RULES.map(r => r.section))).sort();

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('ies_current_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      console.error('Failed to parse current user:', e);
      localStorage.removeItem('ies_current_user');
      return null;
    }
  });

  const logEvent = async (eventType: string, details?: any) => {
    if (!currentUser) return;
    try {
      await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          userName: currentUser.name,
          userRole: currentUser.role,
          eventType,
          details
        })
      });
    } catch (err) {
      console.error('Failed to log event:', err);
    }
  };

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('ies_current_user', JSON.stringify(user));
    // Log login event
    fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        eventType: 'LOGIN'
      })
    });
  };

  const handleLogout = () => {
    logEvent('LOGOUT');
    setCurrentUser(null);
    localStorage.removeItem('ies_current_user');
  };
  const [activeTab, setActiveTab] = useState<'estimator' | 'admin'>('estimator');
  const [showHelp, setShowHelp] = useState(false);
  const [planSwiftFiles, setPlanSwiftFiles] = useState<File[]>([]);
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [mode, setMode] = useState<ClassificationMode>('RULE_BASED');
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<'upload' | 'review' | 'done'>('upload');
  const [items, setItems] = useState<PlanSwiftItem[]>([]);
  const [summary, setSummary] = useState<AggregatedItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [filterOther, setFilterOther] = useState(false);
  const [systemFilter, setSystemFilter] = useState<string>('ALL');
  const [sectionFilter, setSectionFilter] = useState<string>('ALL');
  const [selectedPricing, setSelectedPricing] = useState<string>('IES');
  const [aiPricingIndex, setAiPricingIndex] = useState<number | null>(null);
  const [magicPricingStatus, setMagicPricingStatus] = useState<string | null>(null);
  
  // Dynamic Mappings
  const [systemMapping, setSystemMapping] = useState<SystemMapping>(DEFAULT_SYSTEM_MAPPING);
  const [sectionRules, setSectionRules] = useState<SectionRule[]>(DEFAULT_SECTION_RULES);

  const allSystems = useMemo(() => {
    return Array.from(new Set(Object.values(systemMapping))).sort();
  }, [systemMapping]);

  const allSections = useMemo(() => {
    return Array.from(new Set(sectionRules.map(r => r.section))).sort();
  }, [sectionRules]);

  const [projectDetails, setProjectDetails] = useState({
    projectId: `PRJ-${new Date().getTime().toString().slice(-6)}`,
    projectName: '',
    address: '',
    rev: '',
    clientName: '',
    clientId: '',
    date: new Date().toISOString().split('T')[0]
  });

  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchFilters, setSearchFilters] = useState({
    projectName: '',
    projectId: '',
    clientName: '',
    clientId: '',
    startDate: '',
    endDate: ''
  });
  const [projectHistory, setProjectHistory] = useState<any[]>([]);
  const templateInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await fetch('/api/projects');
        if (response.ok) {
          const data = await response.json();
          setProjectHistory(data);
        }
      } catch (err) {
        console.error('Failed to fetch projects:', err);
      }
    };

    const fetchMappings = async () => {
      try {
        const sysResponse = await fetch('/api/settings/system_mapping');
        const secResponse = await fetch('/api/settings/section_rules');
        
        if (sysResponse.ok) {
          const data = await sysResponse.json();
          if (data) setSystemMapping(data);
        }
        if (secResponse.ok) {
          const data = await secResponse.json();
          if (data) setSectionRules(data);
        }
      } catch (err) {
        console.error('Failed to fetch mappings:', err);
      }
    };

    fetchProjects();
    fetchMappings();
  }, []);

  const handleProcess = async () => {
    if (planSwiftFiles.length === 0) return;
    
    logEvent('FILES_UPLOADED', { 
      fileCount: planSwiftFiles.length, 
      fileNames: planSwiftFiles.map(f => f.name) 
    });

    setIsProcessing(true);
    setError(null);
    
    try {
      let allRawItems: PlanSwiftItem[] = [];
      
      // Process each file and collect items
      for (const file of planSwiftFiles) {
        const fileItems = await readPlanSwiftFile(file);
        allRawItems = [...allRawItems, ...fileItems];
      }

      if (allRawItems.length === 0) {
        throw new Error("No items found in the uploaded files.");
      }
      
      let aiMapping = undefined;
      if (mode === 'AI_POWERED') {
        const uniqueItems = Array.from(new Set(allRawItems.map(i => i.Item)));
        aiMapping = await aiClassify(uniqueItems, systemMapping);
        logEvent('AI_CLASSIFICATION', { 
          itemCount: uniqueItems.length,
          model: 'gemini-3-flash-preview'
        });
      }
      
      const aggregated = aggregateItems(allRawItems, mode, aiMapping, systemMapping, sectionRules);
      setItems(allRawItems);
      setSummary(aggregated);
      setStep('review');
    } catch (err: any) {
      console.error(err);
      const msg = err.message || 'Unknown error';
      setError(`Processing Error: ${msg}. Please ensure your file is a valid PlanSwift Excel export.`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateItem = (index: number, field: keyof AggregatedItem, value: any) => {
    const newSummary = [...summary];
    if (field === 'Qty' || field === 'unitCost' || field === 'labor') {
      const val = parseFloat(value);
      newSummary[index] = { ...newSummary[index], [field]: isNaN(val) ? 0 : val };
    } else {
      newSummary[index] = { ...newSummary[index], [field]: value };
    }
    setSummary(newSummary);
  };

  const handleMagicPricingAll = async () => {
    if (aiPricingIndex !== null) return;

    if (selectedPricing === 'Ai') {
      const apiKey = "AIzaSyB3BrUH1N4zhPH-96zyyHf8z88Icl3qvj0";
      if (!apiKey) {
        setMagicPricingStatus(`Invalid API Key. Please check your Settings or select a key.`);
        if (window.aistudio) {
          window.aistudio.openSelectKey();
        }
        setTimeout(() => setMagicPricingStatus(null), 5000);
        return;
      }
    }
    
    setMagicPricingStatus(`Starting batch pricing update using ${selectedPricing}...`);
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < summary.length; i++) {
      try {
        setAiPricingIndex(i);
        const item = summary[i];
        
        if (['Accubid', 'Conest', 'McCormic'].includes(selectedPricing)) {
          const response = await fetch(`/api/pricing/${selectedPricing}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item: item.Item })
          });

          if (response.ok) {
            const result = await response.json();
            const newSummary = [...summary];
            newSummary[i] = { 
              ...newSummary[i], 
              unitCost: result.unitCost || 0, 
              labor: result.labor || 0 
            };
            setSummary(newSummary);
            successCount++;
          } else {
            failCount++;
          }
        } else if (selectedPricing === 'Ai') {
          // Re-use logic from handleMagicPricing but simplified for batch
          const apiKey = "AIzaSyB3BrUH1N4zhPH-96zyyHf8z88Icl3qvj0";
          if (!apiKey) throw new Error("API Key missing");
          
          const ai = new GoogleGenAI({ apiKey });
          const state = projectDetails.address.match(/\b([A-Z]{2})\b/)?.[1] || "USA";
          
          const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Find the current average market unit price (material cost) and labor cost (man-hours or cost per unit) for the following electrical construction item in ${state}, USA: "${item.Item}". 
            Return ONLY a JSON object with "unitCost" (number) and "labor" (number) keys.`,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  unitCost: { type: Type.NUMBER },
                  labor: { type: Type.NUMBER }
                },
                required: ["unitCost", "labor"]
              }
            }
          });

          let text = response.text;
          if (text.includes('```json')) text = text.split('```json')[1].split('```')[0].trim();
          const result = JSON.parse(text);
          
          const newSummary = [...summary];
          newSummary[i] = { 
            ...newSummary[i], 
            unitCost: result.unitCost || 0, 
            labor: result.labor || 0 
          };
          setSummary(newSummary);
          successCount++;
        }
        
        setMagicPricingStatus(`Processing batch: ${i + 1}/${summary.length} (${successCount} success, ${failCount} failed)`);
      } catch (err: any) {
        console.error(`Batch Pricing Error at index ${i}:`, err);
        if (err.message?.includes("API key not valid") || err.message?.includes("400") || err.message?.includes("API Key missing")) {
          setMagicPricingStatus(`Invalid API Key. Please check your Settings or select a key.`);
          setAiPricingIndex(null);
          if (window.aistudio) {
            window.aistudio.openSelectKey();
          }
          setTimeout(() => setMagicPricingStatus(null), 5000);
          return; // Stop batch on auth error
        }
        failCount++;
      }
    }

    setMagicPricingStatus(`Batch complete! ${successCount} items updated, ${failCount} failed.`);
    setAiPricingIndex(null);
    setTimeout(() => setMagicPricingStatus(null), 5000);
  };

  const handleMagicPricing = async (index: number) => {
    const item = summary[index];
    
    if (['Accubid', 'Conest', 'McCormic'].includes(selectedPricing)) {
      try {
        setAiPricingIndex(index);
        setMagicPricingStatus(`Searching ${selectedPricing} database for "${item.Item}"...`);
        
        const response = await fetch(`/api/pricing/${selectedPricing}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item: item.Item })
        });

        if (!response.ok) {
          throw new Error(`Item not found in ${selectedPricing} database`);
        }

        const result = await response.json();
        const newSummary = [...summary];
        newSummary[index] = { 
          ...newSummary[index], 
          unitCost: result.unitCost || 0, 
          labor: result.labor || 0 
        };
        setSummary(newSummary);
        setMagicPricingStatus(`Successfully updated pricing from ${selectedPricing} for "${item.Item}"`);
        setTimeout(() => setMagicPricingStatus(null), 3000);
      } catch (err: any) {
        console.error(`${selectedPricing} Pricing Error:`, err);
        setMagicPricingStatus(`Failed to find "${item.Item}" in ${selectedPricing} database.`);
        setTimeout(() => setMagicPricingStatus(null), 5000);
      } finally {
        setAiPricingIndex(null);
      }
      return;
    }

    if (selectedPricing === 'Ai') {
      try {
        setAiPricingIndex(index);
        const item = summary[index];
        const state = projectDetails.address.match(/\b([A-Z]{2})\b/)?.[1] || "USA";
        
        setMagicPricingStatus(`Searching market rates for "${item.Item}" in ${state}...`);
        
        const apiKey = "AIzaSyCA6iA4rttNfvZjfewkHFMrECea2IOqUic";
        if (!apiKey) {
          if (window.aistudio) {
            setMagicPricingStatus("API Key required. Opening selection dialog...");
            await window.aistudio.openSelectKey();
            return;
          }
          throw new Error("Gemini API key is not configured.");
        }

        const ai = new GoogleGenAI({ apiKey });
        
        const generatePricing = async (useSearch: boolean) => {
          return await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Find the current average market unit price (material cost) and labor cost (man-hours or cost per unit) for the following electrical construction item in ${state}, USA: "${item.Item}". 
            Return ONLY a JSON object with "unitCost" (number) and "labor" (number) keys. 
            Use current 2026 market data. If specific data is unavailable, provide a highly accurate professional estimate.`,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  unitCost: { type: Type.NUMBER },
                  labor: { type: Type.NUMBER }
                },
                required: ["unitCost", "labor"]
              },
              ...(useSearch ? { tools: [{ googleSearch: {} }] } : {})
            }
          });
        };

        let response;
        try {
          // Try with search first
          response = await generatePricing(true);
        } catch (searchErr: any) {
          console.warn("Search tool failed, falling back to internal knowledge:", searchErr);
          // If search fails (likely due to API key restrictions), try without search
          if (searchErr.message?.includes("API key not valid") || searchErr.message?.includes("400") || searchErr.message?.includes("permission")) {
            setMagicPricingStatus(`Search restricted. Using AI internal estimates for "${item.Item}"...`);
            response = await generatePricing(false);
          } else {
            throw searchErr;
          }
        }

        let text = response.text;
        // Clean up potential markdown code blocks if the model included them
        if (text.includes('```json')) {
          text = text.split('```json')[1].split('```')[0].trim();
        } else if (text.includes('```')) {
          text = text.split('```')[1].split('```')[0].trim();
        }

        const result = JSON.parse(text);
        const newSummary = [...summary];
        newSummary[index] = { 
          ...newSummary[index], 
          unitCost: result.unitCost || 0, 
          labor: result.labor || 0 
        };
        setSummary(newSummary);
        setMagicPricingStatus(`Successfully updated pricing for "${item.Item}"`);
        setTimeout(() => setMagicPricingStatus(null), 3000);
      } catch (err: any) {
        console.error("AI Pricing Error:", err);
        if (err.message?.includes("API key not valid") || err.message?.includes("400") || err.message?.includes("API Key missing") || err.message?.includes("not configured")) {
          setMagicPricingStatus(`Invalid API Key. Please check your Settings or select a key.`);
          if (window.aistudio) {
            setTimeout(() => window.aistudio.openSelectKey(), 2000);
          }
        } else {
          setMagicPricingStatus(`Failed to fetch AI pricing. Please try again or check your connection.`);
        }
        setTimeout(() => setMagicPricingStatus(null), 5000);
      } finally {
        setAiPricingIndex(null);
      }
      return;
    }

    // Existing logic for other pricing options (to be implemented with DB)
    console.log(`Magic pricing for item: ${summary[index].Item} using ${selectedPricing}`);
    
    const newSummary = [...summary];
    if (newSummary[index].Item.toLowerCase().includes('conduit')) {
      newSummary[index].unitCost = 1.25;
      newSummary[index].labor = 0.15;
    }
    setSummary(newSummary);
  };

  const handleSaveProject = async () => {
    const newRecord = {
      ...projectDetails,
      items,
      summary,
      itemCount: items.length,
    };
    
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRecord)
      });
      
      if (response.ok) {
        // Refresh history
        const historyRes = await fetch('/api/projects');
        if (historyRes.ok) {
          const data = await historyRes.json();
          setProjectHistory(data);
        }
        logEvent('PROJECT_SAVED', { projectId: projectDetails.projectId });
      }
    } catch (err) {
      console.error('Failed to save project:', err);
    }
  };

  const handleDeleteProject = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this project?')) return;
    
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setProjectHistory(prev => prev.filter(p => p.projectId !== projectId));
        logEvent('PROJECT_DELETED', { projectId });
      }
    } catch (err) {
      console.error('Failed to delete project:', err);
    }
  };

  const handleGenerate = async () => {
    if (!templateFile || summary.length === 0) return;
    
    setIsProcessing(true);
    try {
      const blob = await fillTemplate(templateFile, summary, projectDetails);
      saveAs(blob, `Final_Electrical_Estimate_${new Date().toISOString().split('T')[0]}.xlsx`);
      
      // Save to history
      handleSaveProject();

      logEvent('PROJECT_COMPLETE', { 
        files: planSwiftFiles.map(f => f.name),
        itemCount: items.length,
        categoryCount: summary.length
      });
      setStep('done');
    } catch (err: any) {
      console.error(err);
      let msg = err.message || 'Failed to generate estimate.';
      
      if (msg.includes('Shared Formula master must exist')) {
        msg = 'Excel Error: Your template has a "Shared Formula" conflict. \n\n' +
              'To fix this: \n' +
              '1. Open your template in Excel. \n' +
              '2. Select Column E. \n' +
              '3. Press Ctrl+H, replace "=" with "=", and click "Replace All". \n' +
              '4. Save and try again.';
      }
      
      setError(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const reset = () => {
    setPlanSwiftFiles([]);
    setTemplateFile(null);
    setStep('upload');
    setItems([]);
    setSummary([]);
    setError(null);
    setShowAll(false);
    setFilterOther(false);
    setSystemFilter('ALL');
    setSectionFilter('ALL');
    setProjectDetails({
      projectId: `PRJ-${new Date().getTime().toString().slice(-6)}`,
      projectName: '',
      address: '',
      rev: '',
      clientName: '',
      clientId: '',
      date: new Date().toISOString().split('T')[0]
    });
  };

  const otherItemsCount = summary.filter(item => item.System === 'OTHER' || item.Format === 'OTHER').length;
  const filteredSummary = summary.filter(item => {
    const matchesOther = !filterOther || (item.System === 'OTHER' || item.Format === 'OTHER');
    const matchesSystem = systemFilter === 'ALL' || item.System === systemFilter;
    const matchesSection = sectionFilter === 'ALL' || item.Format === sectionFilter;
    return matchesOther && matchesSystem && matchesSection;
  });
  const displayedSummary = showAll ? filteredSummary : filteredSummary.slice(0, 15);

  if (!currentUser) {
    return <Auth onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-zinc-900 font-sans selection:bg-emerald-100 selection:text-emerald-900">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <img 
                src={logo} 
                alt="ai estimatic Logo" 
                className="h-10 w-auto"
              />
            </div>

            <nav className="hidden md:flex items-center gap-1">
              <button
                onClick={() => setActiveTab('estimator')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2 ${
                  activeTab === 'estimator' ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                Estimator
              </button>
              <button
                onClick={() => setShowSearchModal(true)}
                className="px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2 text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50"
              >
                <Search className="w-4 h-4" />
                Search Project
              </button>
              {currentUser.role === 'ADMIN' && (
                <button
                  onClick={() => setActiveTab('admin')}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2 ${
                    activeTab === 'admin' ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50'
                  }`}
                >
                  <Shield className="w-4 h-4" />
                  Admin Panel
                </button>
              )}
            </nav>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center bg-zinc-100 p-1 rounded-lg">
              <button 
                onClick={() => setMode('RULE_BASED')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${mode === 'RULE_BASED' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
              >
                Rule-based
              </button>
              <button 
                onClick={() => {
                  if (['POWER_USER', 'ADMIN'].includes(currentUser.role)) {
                    setMode('AI_POWERED');
                  } else {
                    setError('AI-Powered mode requires Power User or Admin permissions.');
                  }
                }}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${mode === 'AI_POWERED' ? 'bg-white text-emerald-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
              >
                <BrainCircuit className="w-4 h-4" />
                AI Powered
                {!['POWER_USER', 'ADMIN'].includes(currentUser.role) && <Lock className="w-3 h-3 opacity-50 ml-1" />}
              </button>
            </div>

            <div className="h-8 w-px bg-zinc-200"></div>

            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold leading-none">{currentUser.name}</p>
                <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mt-1">{currentUser.role.replace('_', ' ')}</p>
              </div>
              <button 
                onClick={() => setShowHelp(true)}
                className="w-10 h-10 rounded-xl bg-zinc-100 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 transition-all flex items-center justify-center"
                title="Help & Documentation"
              >
                <HelpCircle className="w-5 h-5" />
              </button>
              <button 
                onClick={handleLogout}
                className="w-10 h-10 rounded-xl bg-zinc-100 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 transition-all flex items-center justify-center"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {activeTab === 'admin' && currentUser.role === 'ADMIN' ? (
          <AdminPanel currentUser={currentUser} logEvent={logEvent} />
        ) : (
          <>
        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700">
            <Database className="w-5 h-5" />
            <p className="font-medium">{error}</p>
          </div>
        )}

        {step === 'upload' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div className="lg:col-span-4 space-y-6">
              <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tight text-zinc-900">Start your estimate</h2>
                <p className="text-zinc-500 leading-relaxed">
                  Upload your PlanSwift export and estimate template to automate the classification and aggregation process.
                </p>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-sm font-medium text-zinc-600">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs">1</div>
                  Upload PlanSwift Raw Export
                </div>
                <div className="flex items-center gap-3 text-sm font-medium text-zinc-600">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs">2</div>
                  Review Classification
                </div>
                <div className="flex items-center gap-3 text-sm font-medium text-zinc-600">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs">3</div>
                  Download Final Estimate
                </div>
              </div>
            </div>

            <div className="lg:col-span-8 space-y-8">
              <div className="bg-white border border-zinc-200 rounded-2xl p-8 shadow-sm">
                <div className="space-y-6">
                  <FileUploader 
                    label="PlanSwift Export Files" 
                    onFilesSelect={(files) => setPlanSwiftFiles(prev => [...prev, ...files])} 
                    selectedFiles={planSwiftFiles}
                    accept=".xlsx,.xls"
                    multiple={true}
                    icon={<FileText className="w-6 h-6" />}
                  />
                  
                  {planSwiftFiles.length > 0 && (
                    <div className="flex justify-between items-center">
                      <button 
                        onClick={() => setPlanSwiftFiles([])}
                        className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1"
                      >
                        Clear all files
                      </button>
                      <button
                        disabled={planSwiftFiles.length === 0 || isProcessing || currentUser.role === 'READ_ONLY'}
                        onClick={handleProcess}
                        className="bg-zinc-900 text-white px-8 py-3 rounded-xl font-semibold hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                      >
                        {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : `Process ${planSwiftFiles.length} File${planSwiftFiles.length > 1 ? 's' : ''}`}
                        {!isProcessing && <ArrowRight className="w-5 h-5" />}
                      </button>
                    </div>
                  )}
                  {currentUser.role === 'READ_ONLY' && (
                    <p className="text-xs text-amber-600 font-medium mt-2 flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      Read-only users cannot process files.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'review' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Review & Finalize</h2>
                <p className="text-zinc-500 mt-1">Verify the classifications before generating the final estimate.</p>
              </div>
              <div className="flex items-center gap-3">
                {/* Compact Export to Template Box */}
                <div className="hidden md:flex items-center gap-2 p-1 bg-zinc-50 border border-zinc-200 rounded-xl">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-zinc-200 rounded-lg shadow-sm">
                    <FileText className="w-4 h-4 text-zinc-400" />
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 leading-none">Template</span>
                      <span className="text-[11px] font-medium text-zinc-600 truncate max-w-[100px]" title={templateFile ? templateFile.name : 'No file selected'}>
                        {templateFile ? templateFile.name : 'Select File'}
                      </span>
                    </div>
                    <button 
                      onClick={() => templateInputRef.current?.click()}
                      className="ml-1 p-1 hover:bg-zinc-100 rounded-md transition-colors"
                      title="Upload Template"
                    >
                      <Upload className="w-3.5 h-3.5 text-emerald-600" />
                    </button>
                    <input 
                      type="file" 
                      ref={templateInputRef}
                      onChange={(e) => setTemplateFile(e.target.files?.[0] || null)}
                      accept=".xlsx,.xls"
                      className="hidden"
                    />
                  </div>
                  <button
                    disabled={!templateFile || isProcessing || currentUser.role === 'READ_ONLY'}
                    onClick={handleGenerate}
                    className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 text-xs shadow-sm"
                  >
                    {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                    Generate
                  </button>
                </div>

                <button 
                  onClick={handleSaveProject}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-emerald-600 hover:text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-50 transition-all"
                >
                  <Save className="w-4 h-4" />
                  Save Project
                </button>
                <button 
                  onClick={reset}
                  className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-all"
                >
                  Discard & Restart
                </button>
              </div>
            </div>

            {/* Project Details */}
            <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Project ID</label>
                  <input 
                    type="text" 
                    value={projectDetails.projectId} 
                    readOnly 
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm font-mono font-bold text-zinc-500 cursor-not-allowed"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Project Name</label>
                  <input 
                    type="text" 
                    value={projectDetails.projectName} 
                    onChange={(e) => setProjectDetails(prev => ({ ...prev, projectName: e.target.value }))}
                    placeholder="Enter project name"
                    className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>
                <div className="space-y-1.5 lg:col-span-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Address</label>
                  <input 
                    type="text" 
                    value={projectDetails.address} 
                    onChange={(e) => setProjectDetails(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="Enter project address"
                    className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Revision (Rev)</label>
                  <input 
                    type="text" 
                    value={projectDetails.rev} 
                    onChange={(e) => setProjectDetails(prev => ({ ...prev, rev: e.target.value }))}
                    placeholder="e.g. 01"
                    className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Client Name</label>
                  <input 
                    type="text" 
                    value={projectDetails.clientName} 
                    onChange={(e) => setProjectDetails(prev => ({ ...prev, clientName: e.target.value }))}
                    placeholder="Enter client name"
                    className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Client ID</label>
                  <input 
                    type="text" 
                    value={projectDetails.clientId} 
                    onChange={(e) => setProjectDetails(prev => ({ ...prev, clientId: e.target.value }))}
                    placeholder="Enter client ID"
                    className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Date</label>
                  <input 
                    type="date" 
                    value={projectDetails.date} 
                    onChange={(e) => setProjectDetails(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
              <div className="bg-white border border-zinc-200 p-3 rounded-xl shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Files</p>
                <p className="text-lg font-bold mt-0.5">{planSwiftFiles.length}</p>
              </div>
              <div className="bg-white border border-zinc-200 p-3 rounded-xl shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Items</p>
                <p className="text-lg font-bold mt-0.5">{items.length}</p>
              </div>
              <div className="bg-white border border-zinc-200 p-3 rounded-xl shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Categories</p>
                <p className="text-lg font-bold mt-0.5">{summary.length}</p>
              </div>
              <div className="bg-white border border-zinc-200 p-3 rounded-xl shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Systems</p>
                <p className="text-lg font-bold mt-0.5 text-emerald-600">{new Set(summary.map(s => s.System)).size}</p>
              </div>
              <div className="bg-white border border-zinc-200 p-3 rounded-xl shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Sections</p>
                <p className="text-lg font-bold mt-0.5 text-blue-600">{new Set(summary.map(s => s.Format)).size}</p>
              </div>
              <button 
                onClick={() => setFilterOther(!filterOther)}
                className={`p-3 rounded-xl shadow-sm border transition-all text-left ${
                  filterOther 
                    ? 'bg-amber-50 border-amber-200 ring-2 ring-amber-500/20' 
                    : 'bg-white border-zinc-200 hover:border-amber-200 hover:bg-amber-50/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Other</p>
                  {filterOther && <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></div>}
                </div>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <p className={`text-lg font-bold ${otherItemsCount > 0 ? 'text-amber-600' : 'text-zinc-400'}`}>
                    {otherItemsCount}
                  </p>
                  <span className="text-[9px] font-bold text-amber-500 uppercase tracking-wider">
                    {filterOther ? 'Show All' : 'Filter'}
                  </span>
                </div>
              </button>
              <div className="bg-white border border-zinc-200 p-3 rounded-xl shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Mode</p>
                <p className="text-xs font-bold mt-1 flex items-center gap-1.5">
                  {mode === 'AI_POWERED' ? <BrainCircuit className="w-3 h-3 text-emerald-600" /> : <Settings className="w-3 h-3 text-zinc-400" />}
                  {mode === 'AI_POWERED' ? 'AI' : 'Rule'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Data Table */}
              <div className="lg:col-span-12 space-y-4">
                <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
                  <div className="px-6 py-4 border-b border-zinc-100 bg-zinc-50/50 flex items-center justify-between relative">
                    <div className="flex items-center gap-3">
                      <h3 className="font-bold text-sm uppercase tracking-wider text-zinc-500">Classification Preview</h3>
                      {filterOther && (
                        <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Zap className="w-3 h-3" />
                          Filtering Other
                        </span>
                      )}
                      {(systemFilter !== 'ALL' || sectionFilter !== 'ALL') && (
                        <button 
                          onClick={() => {
                            setSystemFilter('ALL');
                            setSectionFilter('ALL');
                          }}
                          className="bg-zinc-100 text-zinc-600 text-[10px] font-bold px-2 py-0.5 rounded-full hover:bg-zinc-200 transition-colors"
                        >
                          Clear Filters
                        </button>
                      )}
                    </div>

                    {magicPricingStatus && (
                      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 px-4 py-1.5 bg-white border border-zinc-200 rounded-full shadow-sm z-10 whitespace-nowrap">
                        <div className={`w-1.5 h-1.5 rounded-full ${(magicPricingStatus.includes('Failed') || magicPricingStatus.includes('Invalid') || magicPricingStatus.includes('Error')) ? 'bg-red-500' : 'bg-emerald-500 animate-pulse'}`} />
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${(magicPricingStatus.includes('Failed') || magicPricingStatus.includes('Invalid') || magicPricingStatus.includes('Error')) ? 'text-red-600' : 'text-emerald-700'}`}>
                          {magicPricingStatus}
                        </span>
                      </div>
                    )}

                    <span className="text-xs font-medium text-zinc-400">
                      {showAll ? `Showing all ${filteredSummary.length} items` : `Showing first 15 of ${filteredSummary.length} items`}
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        {['POWER_USER', 'ADMIN'].includes(currentUser.role) && (
                          <tr className="border-b border-zinc-100 bg-zinc-50/30">
                            <th colSpan={5}></th>
                            <th colSpan={2} className="px-4 py-2">
                              <div className="flex flex-col gap-1.5">
                                <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider text-left">Select Pricing</label>
                                <div className="flex gap-2">
                                  <select 
                                    value={selectedPricing}
                                    onChange={(e) => setSelectedPricing(e.target.value)}
                                    className="text-[10px] font-bold bg-white border border-zinc-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-zinc-600 flex-1"
                                  >
                                    <option value="IES">IES (Manual Entry)</option>
                                    <option value="Accubid">Accubid (Database)</option>
                                    <option value="Conest">Conest (Database)</option>
                                    <option value="McCormic">McCormic (Database)</option>
                                    <option value="Ai">Ai Market Rates</option>
                                  </select>
                                  <button
                                    onClick={handleMagicPricingAll}
                                    disabled={aiPricingIndex !== null}
                                    className="px-2 py-1 bg-emerald-600 text-white text-[10px] font-bold rounded hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-1"
                                    title="Update all items using selected pricing"
                                  >
                                    {aiPricingIndex !== null ? <Loader2 className="w-3 h-3 animate-spin" /> : '🪄 All'}
                                  </button>
                                </div>
                              </div>
                            </th>
                          </tr>
                        )}
                        <tr className="border-b border-zinc-100">
                          <th className="px-4 py-3 text-xs font-bold text-zinc-400 uppercase tracking-wider">SR</th>
                          <th className="px-4 py-3 text-xs font-bold text-zinc-400 uppercase tracking-wider">
                            <div className="flex flex-col gap-1.5">
                              <span>System</span>
                              <select 
                                value={systemFilter}
                                onChange={(e) => setSystemFilter(e.target.value)}
                                className="text-[9px] font-bold bg-white border border-zinc-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-zinc-600 w-full"
                              >
                                <option value="ALL">ALL SYSTEMS</option>
                                {allSystems.map(s => <option key={s} value={s}>{s}</option>)}
                                <option value="OTHER">OTHER</option>
                              </select>
                            </div>
                          </th>
                          <th className="px-4 py-3 text-xs font-bold text-zinc-400 uppercase tracking-wider">
                            <div className="flex flex-col gap-1.5">
                              <span>Section</span>
                              <select 
                                value={sectionFilter}
                                onChange={(e) => setSectionFilter(e.target.value)}
                                className="text-[9px] font-bold bg-white border border-zinc-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-zinc-600 w-full"
                              >
                                <option value="ALL">ALL SECTIONS</option>
                                {allSections.map(s => <option key={s} value={s}>{s}</option>)}
                                <option value="OTHER">OTHER</option>
                              </select>
                            </div>
                          </th>
                          <th className="px-4 py-3 text-xs font-bold text-zinc-400 uppercase tracking-wider">Description</th>
                          <th className="px-4 py-3 text-xs font-bold text-zinc-400 uppercase tracking-wider text-right">Qty</th>
                          {['POWER_USER', 'ADMIN'].includes(currentUser.role) && (
                            <>
                              <th className="px-4 py-3 text-xs font-bold text-zinc-400 uppercase tracking-wider text-right">Unit Cost</th>
                              <th className="px-4 py-3 text-xs font-bold text-zinc-400 uppercase tracking-wider text-right">Labor</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-50">
                        {displayedSummary.map((item, i) => {
                          const originalIndex = summary.indexOf(item);
                          const isModified = item.Qty !== item.OriginalQty;
                          return (
                            <tr key={originalIndex} className={`hover:bg-zinc-50/30 transition-colors group ${isModified ? 'text-blue-600' : ''}`}>
                              <td className={`px-4 py-4 text-sm font-mono ${isModified ? 'text-blue-400' : 'text-zinc-400'}`}>{i + 1}</td>
                              <td className="px-4 py-4">
                                <select 
                                  value={item.System}
                                  onChange={(e) => handleUpdateItem(originalIndex, 'System', e.target.value)}
                                  className={`text-[10px] font-bold bg-zinc-100 border border-zinc-200 uppercase rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500 ${isModified ? 'text-blue-600' : 'text-zinc-600'}`}
                                >
                                  {allSystems.map(s => <option key={s} value={s}>{s}</option>)}
                                  <option value="OTHER">OTHER</option>
                                </select>
                              </td>
                              <td className="px-4 py-4">
                                <select 
                                  value={item.Format}
                                  onChange={(e) => handleUpdateItem(originalIndex, 'Format', e.target.value)}
                                  className={`text-[10px] font-bold bg-zinc-50 border border-zinc-200 italic rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500 ${isModified ? 'text-blue-500' : 'text-zinc-500'}`}
                                >
                                  {allSections.map(s => <option key={s} value={s}>{s}</option>)}
                                  <option value="OTHER">OTHER</option>
                                </select>
                              </td>
                              <td className={`px-4 py-4 text-sm font-medium transition-colors ${isModified ? 'text-blue-600' : 'text-zinc-900 group-hover:text-emerald-700'}`}>{item.Item}</td>
                              <td className="px-4 py-4 text-right">
                                <input 
                                  type="number"
                                  value={item.Qty}
                                  onChange={(e) => handleUpdateItem(originalIndex, 'Qty', e.target.value)}
                                  className={`w-20 text-sm font-mono font-medium text-right bg-zinc-50 border border-zinc-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500 ${isModified ? 'text-blue-600' : 'text-zinc-600'}`}
                                />
                              </td>
                              {['POWER_USER', 'ADMIN'].includes(currentUser.role) && (
                                <>
                                  <td className="px-4 py-4 text-right">
                                    <input 
                                      type="number"
                                      value={item.unitCost || 0}
                                      onChange={(e) => handleUpdateItem(originalIndex, 'unitCost', e.target.value)}
                                      className="w-20 text-sm font-mono font-medium text-right bg-zinc-50 border border-zinc-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-zinc-600"
                                    />
                                  </td>
                                  <td className="px-4 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      <input 
                                        type="number"
                                        value={item.labor || 0}
                                        onChange={(e) => handleUpdateItem(originalIndex, 'labor', e.target.value)}
                                        className="w-20 text-sm font-mono font-medium text-right bg-zinc-50 border border-zinc-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-zinc-600"
                                      />
                                      <button 
                                        onClick={() => handleMagicPricing(originalIndex)}
                                        disabled={aiPricingIndex !== null}
                                        className={`p-1 hover:bg-zinc-100 rounded transition-colors ${aiPricingIndex === originalIndex ? 'animate-pulse' : ''}`}
                                        title="Match pricing from database"
                                      >
                                        {aiPricingIndex === originalIndex ? (
                                          <Loader2 className="w-3 h-3 animate-spin text-emerald-600" />
                                        ) : (
                                          '🪄'
                                        )}
                                      </button>
                                    </div>
                                  </td>
                                </>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-6 py-3 bg-zinc-50/30 text-center border-t border-zinc-100 flex items-center justify-center gap-4">
                    {!showAll && filteredSummary.length > 15 && (
                      <button 
                        onClick={() => setShowAll(true)}
                        className="text-xs text-emerald-600 font-bold hover:text-emerald-700 transition-colors"
                      >
                        View All {filteredSummary.length} Items
                      </button>
                    )}
                    {showAll && (
                      <button 
                        onClick={() => setShowAll(false)}
                        className="text-xs text-zinc-500 font-bold hover:text-zinc-700 transition-colors"
                      >
                        Show Less
                      </button>
                    )}
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="max-w-2xl mx-auto text-center space-y-8 py-12">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-3xl font-bold tracking-tight">Estimate Generated!</h2>
              <p className="text-zinc-500">Your final electrical estimate has been downloaded successfully.</p>
            </div>
            
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={reset}
                className="bg-zinc-900 text-white px-8 py-3 rounded-xl font-semibold hover:bg-zinc-800 transition-all"
              >
                Create New Estimate
              </button>
              <button
                onClick={() => setStep('review')}
                className="bg-white border border-zinc-200 text-zinc-600 px-8 py-3 rounded-xl font-semibold hover:bg-zinc-50 transition-all"
              >
                Back to Review
              </button>
            </div>
          </div>
        )}
          </>
        )}
      </main>

      {/* Search Project Modal */}
      {showSearchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            <div className="p-6 border-bottom border-zinc-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
                  <Search className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Search Projects</h3>
                  <p className="text-sm text-zinc-500">Find previously generated estimates</p>
                </div>
              </div>
              <button 
                onClick={() => setShowSearchModal(false)}
                className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>

            <div className="p-6 border-b border-zinc-100 bg-zinc-50/50">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Project Name</label>
                  <input 
                    type="text" 
                    value={searchFilters.projectName}
                    onChange={(e) => setSearchFilters(prev => ({ ...prev, projectName: e.target.value }))}
                    placeholder="Search name..."
                    className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Project ID</label>
                  <input 
                    type="text" 
                    value={searchFilters.projectId}
                    onChange={(e) => setSearchFilters(prev => ({ ...prev, projectId: e.target.value }))}
                    placeholder="Search ID..."
                    className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Client Name</label>
                  <input 
                    type="text" 
                    value={searchFilters.clientName}
                    onChange={(e) => setSearchFilters(prev => ({ ...prev, clientName: e.target.value }))}
                    placeholder="Search client..."
                    className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Client ID</label>
                  <input 
                    type="text" 
                    value={searchFilters.clientId}
                    onChange={(e) => setSearchFilters(prev => ({ ...prev, clientId: e.target.value }))}
                    placeholder="Search client ID..."
                    className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Start Date</label>
                  <input 
                    type="date" 
                    value={searchFilters.startDate}
                    onChange={(e) => setSearchFilters(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">End Date</label>
                  <input 
                    type="date" 
                    value={searchFilters.endDate}
                    onChange={(e) => setSearchFilters(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none"
                  />
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <button 
                  onClick={() => setSearchFilters({ projectName: '', projectId: '', clientName: '', clientId: '', startDate: '', endDate: '' })}
                  className="text-xs text-zinc-500 hover:text-zinc-900 font-medium"
                >
                  Clear Filters
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {projectHistory.length === 0 ? (
                <div className="text-center py-12">
                  <Database className="w-12 h-12 text-zinc-200 mx-auto mb-4" />
                  <p className="text-zinc-500">No project history found yet.</p>
                  <p className="text-xs text-zinc-400 mt-1">Generate an estimate to save it to history.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {projectHistory
                    .filter(p => {
                      const matchesName = !searchFilters.projectName || p.projectName.toLowerCase().includes(searchFilters.projectName.toLowerCase());
                      const matchesId = !searchFilters.projectId || p.projectId.toLowerCase().includes(searchFilters.projectId.toLowerCase());
                      const matchesClientName = !searchFilters.clientName || p.clientName.toLowerCase().includes(searchFilters.clientName.toLowerCase());
                      const matchesClientId = !searchFilters.clientId || p.clientId.toLowerCase().includes(searchFilters.clientId.toLowerCase());
                      
                      const projectDate = new Date(p.date);
                      const matchesStartDate = !searchFilters.startDate || projectDate >= new Date(searchFilters.startDate);
                      const matchesEndDate = !searchFilters.endDate || projectDate <= new Date(searchFilters.endDate);
                      
                      return matchesName && matchesId && matchesClientName && matchesClientId && matchesStartDate && matchesEndDate;
                    })
                    .map((project, idx) => (
                      <div 
                        key={idx}
                        className="group bg-white border border-zinc-200 rounded-xl p-4 hover:border-emerald-200 hover:bg-emerald-50/30 transition-all cursor-pointer"
                        onClick={() => {
                          setProjectDetails({
                            projectId: project.projectId,
                            projectName: project.projectName,
                            address: project.address,
                            rev: project.rev,
                            clientName: project.clientName,
                            clientId: project.clientId,
                            date: project.date
                          });
                          if (project.items) setItems(project.items);
                          if (project.summary) setSummary(project.summary);
                          setStep('review');
                          setShowSearchModal(false);
                        }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                                {project.projectId}
                              </span>
                              <h4 className="font-bold text-zinc-900">{project.projectName || 'Untitled Project'}</h4>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-zinc-500">
                              <span className="flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {project.clientName || 'No Client'}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {project.date}
                              </span>
                              <span className="flex items-center gap-1">
                                <FileText className="w-3 h-3" />
                                {project.itemCount} items
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => handleDeleteProject(project.projectId, e)}
                              className="p-2 text-zinc-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                              title="Delete Project"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <ArrowRight className="w-5 h-5 text-zinc-300 group-hover:text-emerald-500 transition-colors" />
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-zinc-200 bg-white py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-zinc-500">© 2026 ai estimatic. Built for efficiency.</p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">Documentation</a>
            <a href="#" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">Support</a>
            <a href="#" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">Privacy</a>
          </div>
        </div>
      </footer>
      {currentUser && ['ADMIN', 'POWER_USER'].includes(currentUser.role) && (
        <ChatBot currentUser={currentUser} estimationData={summary} />
      )}

      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 md:p-12">
          <div className="bg-white w-full max-w-6xl h-full max-h-[800px] rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            <HelpSection onClose={() => setShowHelp(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
