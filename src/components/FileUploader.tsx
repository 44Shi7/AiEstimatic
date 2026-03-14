import React, { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle, Download, Loader2, AlertCircle, Settings, BrainCircuit } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface FileUploaderProps {
  label: string;
  onFilesSelect: (files: File[]) => void;
  selectedFiles: File[];
  accept?: string;
  icon?: React.ReactNode;
  multiple?: boolean;
}

export function FileUploader({ label, onFilesSelect, selectedFiles, accept, icon, multiple }: FileUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer.files || []) as File[];
    if (files.length > 0) {
      if (multiple) {
        onFilesSelect(files);
      } else {
        onFilesSelect([files[0]]);
      }
    }
  };

  const hasFiles = selectedFiles.length > 0;

  return (
    <div
      onClick={() => fileInputRef.current?.click()}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={cn(
        "relative group cursor-pointer border-2 border-dashed rounded-xl p-6 transition-all duration-200",
        hasFiles 
          ? "border-emerald-500/50 bg-emerald-50/50" 
          : "border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50"
      )}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => {
          const files = Array.from(e.target.files || []) as File[];
          if (files.length > 0) onFilesSelect(files);
        }}
        accept={accept}
        multiple={multiple}
        className="hidden"
      />
      
      <div className="flex flex-col items-center gap-3 text-center">
        <div className={cn(
          "w-12 h-12 rounded-full flex items-center justify-center transition-colors",
          hasFiles ? "bg-emerald-100 text-emerald-600" : "bg-zinc-100 text-zinc-500 group-hover:bg-zinc-200"
        )}>
          {hasFiles ? <CheckCircle className="w-6 h-6" /> : (icon || <Upload className="w-6 h-6" />)}
        </div>
        
        <div>
          <p className="font-medium text-zinc-900">{label}</p>
          <p className="text-sm text-zinc-500 mt-1">
            {hasFiles 
              ? (selectedFiles.length === 1 ? selectedFiles[0].name : `${selectedFiles.length} files selected`) 
              : "Click or drag to upload"}
          </p>
          {hasFiles && selectedFiles.length > 1 && (
            <div className="mt-2 flex flex-wrap justify-center gap-1">
              {selectedFiles.map((f, i) => (
                <span key={i} className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">
                  {f.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
