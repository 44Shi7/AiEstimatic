import React, { useState, useRef, useEffect } from "react";
import {
  MessageSquare,
  Send,
  X,
  Bot,
  User as UserIcon,
  Loader2,
  BookOpen,
  Upload,
  Trash2,
  FileText,
  Maximize2,
  Minimize2,
} from "lucide-react";
import Markdown from "react-markdown";
import { GoogleGenAI } from "@google/genai";
import ExcelJS from "exceljs";
import * as pdfjs from "pdfjs-dist";
import { AggregatedItem, User } from "../types";

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Manual {
  id: string;
  name: string;
  content: string;
  date: string;
}

interface ChatBotProps {
  currentUser: User;
  estimationData: AggregatedItem[];
}

export function ChatBot({ currentUser, estimationData }: ChatBotProps) {
  const isAllowed = ["ADMIN", "POWER_USER"].includes(currentUser.role);
  const [isOpen, setIsOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [manuals, setManuals] = useState<Manual[]>(() => {
    const saved = localStorage.getItem("ies_chatbot_manuals");
    return saved ? JSON.parse(saved) : [];
  });
  const [showManuals, setShowManuals] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    localStorage.setItem("ies_chatbot_manuals", JSON.stringify(manuals));
  }, [manuals]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      try {
        let content = "";
        const fileExtension = file.name.split(".").pop()?.toLowerCase();

        if (fileExtension === "txt") {
          content = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (event) => resolve(event.target?.result as string);
            reader.readAsText(file);
          });
        } else if (fileExtension === "pdf") {
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
          let fullText = "";
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
              .map((item: any) => item.str)
              .join(" ");
            fullText += pageText + "\n";
          }
          content = fullText;
        } else if (fileExtension === "xlsx" || fileExtension === "xls") {
          const arrayBuffer = await file.arrayBuffer();
          const workbook = new ExcelJS.Workbook();
          await workbook.xlsx.load(arrayBuffer);
          let fullText = "";
          workbook.eachSheet((sheet) => {
            fullText += `Sheet: ${sheet.name}\n`;
            sheet.eachRow((row) => {
              const rowValues = Array.isArray(row.values)
                ? row.values
                    .filter((v) => v !== undefined && v !== null)
                    .join(" | ")
                : "";
              fullText += rowValues + "\n";
            });
            fullText += "\n";
          });
          content = fullText;
        }

        if (content) {
          const newManual: Manual = {
            id: Math.random().toString(36).substr(2, 9),
            name: file.name,
            content: content,
            date: new Date().toISOString(),
          };
          setManuals((prev) => [...prev, newManual]);
        }
      } catch (err) {
        console.error(`Error processing file ${file.name}:`, err);
        alert(
          `Failed to process ${file.name}. Please ensure it's a valid file.`,
        );
      }
    }
  };

  const deleteManual = (id: string) => {
    setManuals((prev) => prev.filter((m) => m.id !== id));
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    const apiKey = typeof process !== "undefined" ? process.env.GEMINI_API_KEY : undefined;
    if (!apiKey) {
      if (window.aistudio) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "Error: Gemini API key is not configured. Opening selection dialog...",
          },
        ]);
        await window.aistudio.openSelectKey();
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "Error: Gemini API key is not configured. Please check your environment settings.",
          },
        ]);
      }
      setIsLoading(false);
      return;
    }

    // Construct context
    const context = `
      You are an AI assistant for ai estimatic.
      Current User: ${currentUser.name} (Role: ${currentUser.role})
      
      Current Estimation Data (Summary):
      ${JSON.stringify(estimationData.slice(0, 20), null, 2)}
      ${estimationData.length > 20 ? `... and ${estimationData.length - 20} more items.` : ""}
      
      Knowledge Base (User Manuals):
      ${manuals.map((m) => `Manual: ${m.name}\nContent: ${m.content.substring(0, 1000)}...`).join("\n\n")}
      
      Guidelines:
      - Help users with their estimation data.
      - Answer questions about software usage based on the provided manuals.
      - Be professional, concise, and accurate.
      - If data is missing, ask for clarification.
    `;

    const generateWithRetry = async (
      retries = 2,
      delay = 1000,
      useSearch = true,
    ) => {
      if (!apiKey) {
        console.error("Gemini API Key is missing");
        throw new Error(
          "Gemini API Key is missing. Please ensure it is configured in the AI Studio settings.",
        );
      }
      try {
        console.log(
          `Sending request to Gemini (retries left: ${retries}, search: ${useSearch})...`,
        );
        const ai = new GoogleGenAI({ apiKey });

        // Limit history to last 10 messages to avoid huge payloads
        const recentMessages = messages.slice(-10);

        return await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: [
            { role: "user", parts: [{ text: context }] },
            ...recentMessages.map((m) => ({
              role: m.role === "user" ? "user" : "model",
              parts: [{ text: m.content }],
            })),
            { role: "user", parts: [{ text: userMessage }] },
          ],
          config: {
            ...(useSearch ? { tools: [{ googleSearch: {} }] } : {}),
          },
        });
      } catch (err: any) {
        console.error(`Gemini request failed:`, err);

        // Fallback if search is restricted
        if (
          useSearch &&
          (err.message?.includes("API key not valid") ||
            err.message?.includes("400") ||
            err.message?.includes("permission"))
        ) {
          console.warn("Search restricted, retrying without search...");
          return generateWithRetry(retries, delay, false);
        }

        if (
          retries > 0 &&
          (err.message?.includes("503") ||
            err.message?.includes("high demand") ||
            err.message?.includes("UNAVAILABLE"))
        ) {
          console.log(`Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          return generateWithRetry(retries - 1, delay * 2, useSearch);
        }
        throw err;
      }
    };

    try {
      const response = await generateWithRetry();
      console.log("Gemini response received:", response);
      const assistantMessage =
        response.text || "I'm sorry, I couldn't process that request.";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: assistantMessage },
      ]);
    } catch (err: any) {
      console.error("ChatBot Error:", err);
      let errorMessage = err.message || "Failed to connect to AI service.";

      if (
        errorMessage.includes("503") ||
        errorMessage.includes("high demand")
      ) {
        errorMessage =
          "The AI service is currently experiencing high demand and is temporarily unavailable. Please try again in a few moments.";
      } else {
        errorMessage = `Error: ${errorMessage}. Please check your connection or API key in the settings.`;
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: errorMessage },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAllowed) return null;

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-zinc-900 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-all z-50 group"
      >
        <MessageSquare className="w-6 h-6" />
        <span className="absolute right-full mr-3 px-3 py-1 bg-zinc-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
          estimatic Assistant
        </span>
      </button>
    );
  }

  return (
    <div
      className={`fixed bottom-6 right-6 bg-white border border-zinc-200 rounded-2xl shadow-2xl flex flex-col z-50 transition-all duration-300 ${isMaximized ? "w-[80vw] h-[80vh]" : "w-96 h-[500px]"}`}
    >
      {/* Header */}
      <div className="p-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50 rounded-t-2xl">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-zinc-900 text-white rounded-lg flex items-center justify-center">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-zinc-900">
              estimatic Assistant
            </h3>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">
                Online
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowManuals(!showManuals)}
            className={`p-2 rounded-lg transition-colors ${showManuals ? "bg-zinc-200 text-zinc-900" : "text-zinc-400 hover:bg-zinc-100"}`}
            title="Knowledge Base"
          >
            <BookOpen className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-2 text-zinc-400 hover:bg-zinc-100 rounded-lg transition-colors"
          >
            {isMaximized ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 text-zinc-400 hover:bg-zinc-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Chat Area */}
        <div
          className={`flex-1 flex flex-col transition-all duration-300 ${showManuals ? "opacity-50 pointer-events-none blur-[1px]" : ""}`}
        >
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth"
          >
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <div className="w-12 h-12 bg-zinc-50 rounded-2xl flex items-center justify-center mb-4">
                  <Bot className="w-6 h-6 text-zinc-400" />
                </div>
                <h4 className="font-bold text-zinc-900 mb-1">
                  How can I help you?
                </h4>
                <p className="text-xs text-zinc-500">
                  Ask me about your estimation sheet or software manuals.
                </p>
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] flex gap-3 ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${m.role === "user" ? "bg-zinc-100 text-zinc-600" : "bg-zinc-900 text-white"}`}
                  >
                    {m.role === "user" ? (
                      <UserIcon className="w-4 h-4" />
                    ) : (
                      <Bot className="w-4 h-4" />
                    )}
                  </div>
                  <div
                    className={`p-3 rounded-2xl text-sm ${m.role === "user" ? "bg-zinc-900 text-white rounded-tr-none" : "bg-zinc-100 text-zinc-800 rounded-tl-none"}`}
                  >
                    <div className="markdown-body">
                      <Markdown>{m.content}</Markdown>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex gap-3">
                  <div className="w-8 h-8 bg-zinc-900 text-white rounded-lg flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="bg-zinc-100 p-3 rounded-2xl rounded-tl-none flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                    <span className="text-xs text-zinc-500 font-medium">
                      Thinking...
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-4 border-t border-zinc-100">
            <div className="relative">
              <input
                type="text"
                placeholder="Type your message..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                className="w-full pl-4 pr-12 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all text-sm"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Manuals Overlay */}
        {showManuals && (
          <div className="absolute inset-0 bg-white/95 backdrop-blur-sm p-4 flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-sm text-zinc-900 flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                Knowledge Base
              </h4>
              <button
                onClick={() => setShowManuals(false)}
                className="p-1 text-zinc-400 hover:bg-zinc-100 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {manuals.length === 0 && (
                <div className="text-center py-8">
                  <FileText className="w-8 h-8 text-zinc-200 mx-auto mb-2" />
                  <p className="text-xs text-zinc-400">
                    No manuals uploaded yet.
                  </p>
                </div>
              )}
              {manuals.map((manual) => (
                <div
                  key={manual.id}
                  className="p-3 bg-zinc-50 border border-zinc-100 rounded-xl flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 bg-white border border-zinc-200 rounded-lg flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-zinc-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-zinc-900 truncate">
                        {manual.name}
                      </p>
                      <p className="text-[10px] text-zinc-400">
                        {new Date(manual.date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteManual(manual.id)}
                    className="p-2 text-zinc-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-4">
              <label className="w-full flex flex-col items-center justify-center px-4 py-6 bg-zinc-50 border-2 border-dashed border-zinc-200 rounded-2xl hover:bg-zinc-100 hover:border-zinc-300 transition-all cursor-pointer">
                <Upload className="w-6 h-6 text-zinc-400 mb-2" />
                <span className="text-xs font-bold text-zinc-900">
                  Upload Manuals
                </span>
                <span className="text-[10px] text-zinc-400 mt-1">
                  Supports .txt, .pdf, .xlsx files
                </span>
                <input
                  type="file"
                  className="hidden"
                  multiple
                  accept=".txt,.pdf,.xlsx,.xls"
                  onChange={handleFileUpload}
                />
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
