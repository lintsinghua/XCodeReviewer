/**
 * Splash Screen Component
 * Cassette Futurism / Terminal Retro aesthetic
 * Features: Boot sequence, command input, CSS styled logo
 */

import { useState, useEffect, useRef, useCallback } from "react";

interface SplashScreenProps {
  onComplete: () => void;
}

// Boot sequence messages
const BOOT_SEQUENCE = [
  { text: "[INIT] Loading DeepAudit Core...", delay: 0 },
  { text: "[SCAN] Neural Analysis Engine v3.0", delay: 150 },
  { text: "[LOAD] Vulnerability Pattern Database", delay: 300 },
  { text: "[SYNC] Agent Orchestration Module", delay: 450 },
  { text: "[READY] System Online", delay: 600 },
];

// Available commands
const COMMANDS: Record<string, { action: string; output?: string }> = {
  audit: { action: "start", output: "Initializing audit configuration..." },
  start: { action: "start", output: "Initializing audit configuration..." },
  scan: { action: "start", output: "Initializing audit configuration..." },
  help: { action: "help" },
  clear: { action: "clear" },
};

const HELP_TEXT = `
Available commands:
  audit, start, scan  - Start a new security audit
  help                - Show this help message
  clear               - Clear terminal

Type 'audit' to begin a new security audit.
`;

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [bootLogs, setBootLogs] = useState<string[]>([]);
  const [showLogo, setShowLogo] = useState(false);
  const [bootComplete, setBootComplete] = useState(false);
  const [commandHistory, setCommandHistory] = useState<Array<{ input: string; output?: string; isError?: boolean }>>([]);
  const [currentInput, setCurrentInput] = useState("");
  const [cursorBlink, setCursorBlink] = useState(true);

  const inputRef = useRef<HTMLInputElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);

  // Keep onComplete ref updated
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Boot sequence animation - runs only once
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    // Show logo first
    setTimeout(() => setShowLogo(true), 100);

    BOOT_SEQUENCE.forEach(({ text, delay }) => {
      setTimeout(() => {
        setBootLogs(prev => [...prev, text]);
      }, delay + 400);
    });

    // Boot complete - show command prompt
    setTimeout(() => setBootComplete(true), 1200);
  }, []);

  // Cursor blink
  useEffect(() => {
    const interval = setInterval(() => setCursorBlink(b => !b), 530);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [bootLogs, commandHistory]);

  // Focus input when boot completes
  useEffect(() => {
    if (bootComplete && inputRef.current) {
      inputRef.current.focus();
    }
  }, [bootComplete]);

  // Handle command execution
  const executeCommand = useCallback((cmd: string) => {
    const trimmedCmd = cmd.trim().toLowerCase();

    if (!trimmedCmd) return;

    const command = COMMANDS[trimmedCmd];

    if (!command) {
      setCommandHistory(prev => [...prev, {
        input: cmd,
        output: `Command not found: ${trimmedCmd}. Type 'help' for available commands.`,
        isError: true
      }]);
      return;
    }

    switch (command.action) {
      case "start":
        setCommandHistory(prev => [...prev, {
          input: cmd,
          output: command.output
        }]);
        setTimeout(() => {
          onCompleteRef.current();
        }, 500);
        break;

      case "help":
        setCommandHistory(prev => [...prev, {
          input: cmd,
          output: HELP_TEXT
        }]);
        break;

      case "clear":
        setCommandHistory([]);
        setBootLogs([]);
        break;
    }
  }, []);

  // Handle key press
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      executeCommand(currentInput);
      setCurrentInput("");
    }
  };

  // Focus terminal on click
  const handleTerminalClick = () => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div className="h-screen bg-[#0a0a0f] flex flex-col overflow-hidden relative">
      {/* Scanline overlay */}
      <div className="absolute inset-0 pointer-events-none z-20">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)",
          }}
        />
      </div>

      {/* Vignette effect */}
      <div
        className="absolute inset-0 pointer-events-none z-10"
        style={{
          background: "radial-gradient(ellipse at center, transparent 0%, transparent 50%, rgba(0,0,0,0.5) 100%)",
        }}
      />

      {/* Grid background */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,107,44,0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,107,44,0.5) 1px, transparent 1px)
          `,
          backgroundSize: "32px 32px",
        }}
      />

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center p-4 relative z-30">
        <div className="w-full max-w-2xl">
          {/* CSS Logo */}
          <div className={`text-center mb-8 transition-all duration-700 ${showLogo ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"}`}>
            <div
              className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-wider mb-2 font-mono"
              style={{ textShadow: "0 0 30px rgba(255,107,44,0.5), 0 0 60px rgba(255,107,44,0.3)" }}
            >
              <span className="text-primary">DEEP</span>
              <span className="text-white">AUDIT</span>
            </div>
            <div className="text-gray-500 text-xs sm:text-sm tracking-[0.3em] uppercase">
              Autonomous Security Agent
            </div>
          </div>

          {/* Terminal window */}
          <div
            className="bg-[#0c0c12] border border-gray-800/60 rounded-lg overflow-hidden shadow-2xl"
            onClick={handleTerminalClick}
          >
            {/* Terminal header */}
            <div className="flex items-center gap-2 px-4 py-2.5 bg-[#0a0a0f] border-b border-gray-800/50">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>
              <span className="text-[11px] text-gray-500 ml-3 font-mono tracking-wider">
                deepaudit@terminal
              </span>
            </div>

            {/* Terminal content */}
            <div
              ref={terminalRef}
              className="p-4 font-mono text-sm h-72 overflow-y-auto custom-scrollbar"
            >
              {/* Boot logs */}
              {bootLogs.map((log, i) => (
                <div
                  key={`boot-${i}`}
                  className={`mb-1 ${
                    log.includes("[READY]") ? "text-green-400" :
                    log.includes("[INIT]") ? "text-primary" :
                    "text-gray-500"
                  }`}
                  style={{
                    animation: "fadeSlideIn 0.2s ease-out",
                    animationFillMode: "both",
                    animationDelay: `${i * 0.05}s`
                  }}
                >
                  <span className="text-gray-600 mr-2">&gt;</span>
                  {log}
                </div>
              ))}

              {/* Welcome message */}
              {bootComplete && (
                <div className="mt-4 mb-4 pt-3 border-t border-gray-800/50">
                  <div className="text-primary mb-1">Welcome to DeepAudit Agent Terminal</div>
                  <div className="text-gray-500 text-xs">
                    Type <span className="text-emerald-400 font-semibold">'audit'</span> to start a new security audit, or <span className="text-gray-400">'help'</span> for commands.
                  </div>
                </div>
              )}

              {/* Command history */}
              {commandHistory.map((entry, i) => (
                <div key={`cmd-${i}`} className="mb-2">
                  <div className="flex items-center gap-2 text-gray-300">
                    <span className="text-emerald-500">$</span>
                    <span>{entry.input}</span>
                  </div>
                  {entry.output && (
                    <div className={`ml-4 mt-1 whitespace-pre-wrap text-xs ${
                      entry.isError ? "text-red-400" : "text-gray-500"
                    }`}>
                      {entry.output}
                    </div>
                  )}
                </div>
              ))}

              {/* Current input line */}
              {bootComplete && (
                <div className="flex items-center gap-2 text-gray-300">
                  <span className="text-emerald-500">$</span>
                  <div className="flex-1 relative">
                    <input
                      ref={inputRef}
                      type="text"
                      value={currentInput}
                      onChange={(e) => setCurrentInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="absolute inset-0 w-full bg-transparent text-transparent outline-none border-none"
                      style={{ caretColor: "transparent" }}
                      spellCheck={false}
                      autoComplete="off"
                      autoFocus
                    />
                    <span className="text-gray-200">{currentInput}</span>
                    <span
                      className={`inline-block w-2 h-4 bg-emerald-400 ml-0.5 align-middle transition-opacity ${
                        cursorBlink ? "opacity-100" : "opacity-0"
                      }`}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Hint */}
          <div className={`mt-4 text-center transition-all duration-500 ${bootComplete ? "opacity-100" : "opacity-0"}`}>
            <div className="flex items-center justify-center gap-3">
              <div className="h-px w-8 bg-gradient-to-r from-transparent to-gray-700" />
              <span className="text-gray-600 text-[10px] font-mono tracking-wider">PRESS ENTER TO EXECUTE</span>
              <div className="h-px w-8 bg-gradient-to-l from-transparent to-gray-700" />
            </div>
          </div>
        </div>
      </div>

      {/* Corner decorations */}
      <div className="absolute top-4 left-4 text-[10px] font-mono text-gray-700 z-30">
        <div>SYS.VERSION: 3.0.0</div>
        <div>MODE: INTERACTIVE</div>
      </div>
      <div className="absolute top-4 right-4 text-[10px] font-mono text-gray-700 text-right z-30">
        <div>MEM: 16384MB</div>
        <div>STATUS: READY</div>
      </div>
      <div className="absolute bottom-4 left-4 text-[10px] font-mono text-gray-700 z-30">
        DEEPAUDIT_AGENT_v3
      </div>
      <div className="absolute bottom-4 right-4 text-[10px] font-mono text-gray-700 z-30">
        {new Date().toISOString().split("T")[0]}
      </div>

      {/* Animation styles */}
      <style>{`
        @keyframes fadeSlideIn {
          from {
            opacity: 0;
            transform: translateX(-8px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}

export default SplashScreen;
