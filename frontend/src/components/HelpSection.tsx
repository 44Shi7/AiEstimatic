import React, { useState } from 'react';
import { 
  BookOpen, 
  FileText, 
  BrainCircuit, 
  Database, 
  ShieldCheck, 
  Download, 
  Zap,
  Search,
  ChevronRight,
  HelpCircle,
  Settings,
  Users,
  Activity,
  FileSpreadsheet
} from 'lucide-react';

interface HelpSectionProps {
  onClose: () => void;
}

export function HelpSection({ onClose }: HelpSectionProps) {
  const [activeTopic, setActiveTopic] = useState<string>('getting-started');

  const topics = [
    { id: 'getting-started', label: 'Getting Started', icon: BookOpen },
    { id: 'planswift', label: 'PlanSwift Integration', icon: FileText },
    { id: 'classification', label: 'AI Classification', icon: BrainCircuit },
    { id: 'pricing', label: 'Pricing Sources', icon: Database },
    { id: 'admin', label: 'Admin Panel', icon: ShieldCheck },
    { id: 'export', label: 'Exporting Data', icon: Download },
  ];

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="bg-zinc-900 text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500 rounded-lg">
            <HelpCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Help & Documentation</h2>
            <p className="text-xs text-zinc-400">Learn how to use IES Estimator</p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-2 hover:bg-zinc-800 rounded-full transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 bg-zinc-50 border-r border-zinc-200 p-4 flex flex-col gap-1">
          {topics.map((topic) => (
            <button
              key={topic.id}
              onClick={() => setActiveTopic(topic.id)}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTopic === topic.id 
                  ? 'bg-emerald-50 text-emerald-700' 
                  : 'text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              <topic.icon className="w-4 h-4" />
              {topic.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          {activeTopic === 'getting-started' && (
            <div className="max-w-3xl space-y-6">
              <h3 className="text-2xl font-bold text-zinc-900">Welcome to IES Estimator</h3>
              <p className="text-zinc-600 leading-relaxed">
                IES Estimator is a powerful tool designed to streamline the electrical estimation process by integrating PlanSwift data with AI-driven classification and multi-source pricing databases.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border border-zinc-200 rounded-xl bg-zinc-50">
                  <Zap className="w-6 h-6 text-emerald-600 mb-2" />
                  <h4 className="font-bold text-zinc-900 mb-1">Fast Processing</h4>
                  <p className="text-xs text-zinc-500">Convert PlanSwift exports into structured estimates in seconds.</p>
                </div>
                <div className="p-4 border border-zinc-200 rounded-xl bg-zinc-50">
                  <BrainCircuit className="w-6 h-6 text-emerald-600 mb-2" />
                  <h4 className="font-bold text-zinc-900 mb-1">AI Powered</h4>
                  <p className="text-xs text-zinc-500">Automatically classify items into systems and sections using Gemini AI.</p>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-bold text-zinc-900">Basic Workflow:</h4>
                <ol className="list-decimal list-inside space-y-2 text-sm text-zinc-600">
                  <li>Create a new project or select an existing one.</li>
                  <li>Upload your PlanSwift CSV export file.</li>
                  <li>Review and adjust the AI-generated classifications.</li>
                  <li>Select a pricing source and update item costs.</li>
                  <li>Export the final estimate to a formatted Excel template.</li>
                </ol>
              </div>
            </div>
          )}

          {activeTopic === 'planswift' && (
            <div className="max-w-3xl space-y-6">
              <h3 className="text-2xl font-bold text-zinc-900">PlanSwift Integration</h3>
              <p className="text-zinc-600 leading-relaxed">
                The system is designed to work seamlessly with CSV exports from PlanSwift.
              </p>
              
              <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl">
                <h4 className="text-sm font-bold text-blue-900 mb-2">Required CSV Format:</h4>
                <ul className="list-disc list-inside text-xs text-blue-800 space-y-1">
                  <li>Column 1: Item Name / Description</li>
                  <li>Column 2: Quantity</li>
                  <li>Column 3: Unit (EA, LF, etc.)</li>
                </ul>
              </div>

              <div className="space-y-4">
                <h4 className="font-bold text-zinc-900">Uploading Files:</h4>
                <p className="text-sm text-zinc-600">
                  Navigate to the "Upload PlanSwift Data" tab. You can drag and drop your CSV file or click to browse. Once uploaded, the system will immediately begin processing the items.
                </p>
              </div>
            </div>
          )}

          {activeTopic === 'classification' && (
            <div className="max-w-3xl space-y-6">
              <h3 className="text-2xl font-bold text-zinc-900">AI Classification</h3>
              <p className="text-zinc-600 leading-relaxed">
                IES Estimator uses a hybrid approach to classify your items:
              </p>

              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center shrink-0">
                    <Settings className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-zinc-900">Rule-Based Engine</h4>
                    <p className="text-sm text-zinc-600">First, the system checks for predefined keywords and tags (e.g., [FA] for Fire Alarm) to ensure 100% accuracy for known items.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center shrink-0">
                    <BrainCircuit className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-zinc-900">Gemini AI Engine</h4>
                    <p className="text-sm text-zinc-600">Items that don't match strict rules are sent to Gemini AI, which analyzes the description to determine the most likely System and Section.</p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl">
                <h4 className="text-sm font-bold text-zinc-900 mb-2">Manual Adjustments:</h4>
                <p className="text-xs text-zinc-500">
                  You can always manually override any classification in the "Review & Finalize" table by clicking the dropdown menus for System or Section.
                </p>
              </div>
            </div>
          )}

          {activeTopic === 'pricing' && (
            <div className="max-w-3xl space-y-6">
              <h3 className="text-2xl font-bold text-zinc-900">Pricing Sources</h3>
              <p className="text-zinc-600 leading-relaxed">
                The system supports multiple pricing sources to give you the most accurate estimates.
              </p>

              <div className="grid grid-cols-1 gap-4">
                <div className="p-4 border border-zinc-200 rounded-xl">
                  <h4 className="font-bold text-zinc-900 flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    Database Pricing (Accubid, Conest, McCormic)
                  </h4>
                  <p className="text-sm text-zinc-600 mt-1">
                    Searches your uploaded Excel databases for exact or fuzzy matches. It pulls both Material Cost and Labor Rates.
                  </p>
                </div>
                <div className="p-4 border border-zinc-200 rounded-xl">
                  <h4 className="font-bold text-zinc-900 flex items-center gap-2">
                    <BrainCircuit className="w-4 h-4 text-emerald-600" />
                    AI Market Rates
                  </h4>
                  <p className="text-sm text-zinc-600 mt-1">
                    Uses Gemini AI to research current market rates based on the project's location.
                  </p>
                </div>
                <div className="p-4 border border-zinc-200 rounded-xl">
                  <h4 className="font-bold text-zinc-900 flex items-center gap-2">
                    <Settings className="w-4 h-4 text-emerald-600" />
                    IES (Manual Entry)
                  </h4>
                  <p className="text-sm text-zinc-600 mt-1">
                    Allows you to manually enter pricing for unique or custom items.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTopic === 'admin' && (
            <div className="max-w-3xl space-y-6">
              <h3 className="text-2xl font-bold text-zinc-900">Admin Panel</h3>
              <p className="text-zinc-600 leading-relaxed">
                The Admin Panel is the control center for system administrators.
              </p>

              <div className="space-y-6">
                <div className="flex gap-4">
                  <Database className="w-6 h-6 text-emerald-600 shrink-0" />
                  <div>
                    <h4 className="font-bold text-zinc-900">Pricing Database Management</h4>
                    <p className="text-sm text-zinc-600">Upload and update the Excel files used for Accubid, Conest, and McCormic pricing. You can see file stats like size and last modified date.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <Users className="w-6 h-6 text-emerald-600 shrink-0" />
                  <div>
                    <h4 className="font-bold text-zinc-900">User Management</h4>
                    <p className="text-sm text-zinc-600">Create, edit, and delete user accounts. Assign roles like ADMIN, POWER_USER, or ESTIMATOR to control access levels.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <Activity className="w-6 h-6 text-emerald-600 shrink-0" />
                  <div>
                    <h4 className="font-bold text-zinc-900">Audit Logs</h4>
                    <p className="text-sm text-zinc-600">Track all major system events, including logins, project creations, and database updates for security and accountability.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <Settings className="w-6 h-6 text-emerald-600 shrink-0" />
                  <div>
                    <h4 className="font-bold text-zinc-900">System Mapping</h4>
                    <p className="text-sm text-zinc-600">View the internal rules used for system and section classification. This helps you understand how the rule-based engine works.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTopic === 'export' && (
            <div className="max-w-3xl space-y-6">
              <h3 className="text-2xl font-bold text-zinc-900">Exporting Data</h3>
              <p className="text-zinc-600 leading-relaxed">
                Once your estimate is complete, you can export it to a professional Excel format.
              </p>

              <div className="p-6 bg-zinc-900 text-white rounded-2xl">
                <h4 className="font-bold mb-4 flex items-center gap-2">
                  <Download className="w-5 h-5 text-emerald-500" />
                  Export Features:
                </h4>
                <ul className="space-y-3 text-sm text-zinc-400">
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-1.5 shrink-0" />
                    <span>Items are automatically grouped by System and Section.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-1.5 shrink-0" />
                    <span>Professional formatting with bold headers and clear columns.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-1.5 shrink-0" />
                    <span>Includes Material Costs, Labor Rates, and Quantities.</span>
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
