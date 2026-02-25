import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';

// Ref type — call these from outside to update the display
export type GambaExtensionRef = {
  setCategory: (category: string) => void;
  setConfidenceScore: (score: number) => void;
  setPageEdits: (count: number) => void;
  setThreatsCount: (count: number) => void;
};
import { Power, Sun, Moon, Shield, Play, Pause, Plus, Minus, ChevronDown, Menu, X, MessageSquare } from 'lucide-react';



export const GambaExtension = forwardRef<GambaExtensionRef>(function GambaExtension(_, ref) {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isPoweredOn, setIsPoweredOn] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedMode, setSelectedMode] = useState('Both');
  const [confidenceScore, setConfidenceScore] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isWhitelisted, setIsWhitelisted] = useState(false);
  const [hasCompletedAnalysis, setHasCompletedAnalysis] = useState(true);
  const [currentUrl, setCurrentUrl] = useState<string>('Loading...');
  const [category, setCategory] = useState<string>('Unknown');
  const [pageEdits, setPageEdits] = useState<number>(0);
  const [threatsCount, setThreatsCount] = useState<number>(0);

  // Expose setter functions so parent components can update category & score
  useImperativeHandle(ref, () => ({
    setCategory: (value: string) => setCategory(value),
    setConfidenceScore: (value: number) => setConfidenceScore(value),
    setPageEdits: (value: number) => setPageEdits(value),
    setThreatsCount: (value: number) => setThreatsCount(value),
  }));

  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.tabs) {
      setCurrentUrl(window.location.href);
      return;
    }

    // 1. Sync URL instantly from active tab
    const syncUrl = () => {
      chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
        const url = tabs[0]?.url;
        if (url) setCurrentUrl(url);
      });
    };
    syncUrl();

    // 2. Listen for URL changes and tab switches for instant UI feedback
    const onUpdated = (_: number, changeInfo: any) => {
      if (changeInfo.url) setCurrentUrl(changeInfo.url);
    };
    const onActivated = () => syncUrl();

    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.onActivated.addListener(onActivated);

    // 3. Initial Load: Get the last analysis data from storage
    chrome.storage.local.get(['currentAnalysis'], (result: any) => {
      const { data } = result.currentAnalysis || {};
      if (data) {
        if (data.category) setCategory(data.category);
        if (data.score !== undefined) setConfidenceScore(data.score);
        if (data.pageEdits !== undefined) setPageEdits(data.pageEdits);
        if (data.threatsCount !== undefined) setThreatsCount(data.threatsCount);
      }
    });

    // 4. Listen for Storage Changes: When background script finishes a new analysis
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      const { data } = (changes.currentAnalysis?.newValue as any) || {};
      if (data) {
        if (data.category) setCategory(data.category);
        if (data.score !== undefined) setConfidenceScore(data.score);
        if (data.pageEdits !== undefined) setPageEdits(data.pageEdits);
        if (data.threatsCount !== undefined) setThreatsCount(data.threatsCount);
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.tabs.onActivated.removeListener(onActivated);
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);


  const modes = ['AI', 'Malicious Code', 'Both'];

  const handleReanalyze = () => {
    console.log('Reanalyze clicked. Current URL:', currentUrl);

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      if (isRunning) {
        console.log('Analysis already in progress...');
        return;
      }

      if (!currentUrl || currentUrl === 'Loading...') {
        console.warn('Cannot analyze: URL not yet loaded');
        return;
      }

      setIsRunning(true);
      setHasCompletedAnalysis(false);

      chrome.runtime.sendMessage(
        { type: 'ANALYZE_URL', url: currentUrl },
        (response) => {
          console.log('Analysis complete response:', response);
          setIsRunning(false);
          setHasCompletedAnalysis(true);
        }
      );
    } else {
      // Simulation for non-extension environment
      if (!isRunning) {
        setIsRunning(true);
        setHasCompletedAnalysis(false);
        setTimeout(() => {
          setIsRunning(false);
          setHasCompletedAnalysis(true);
        }, 2000);
      } else {
        setIsRunning(false);
      }
    }
  };

  return (
    <div className="w-[400px] h-[600px] overflow-hidden">
      {/* Glassmorphism Container */}
      <div
        className={`w-full h-full relative overflow-hidden no-scrollbar ${isDarkMode
          ? 'bg-gradient-to-br from-slate-900/95 via-slate-800/95 to-slate-900/95'
          : 'bg-gradient-to-br from-white/95 via-gray-50/95 to-white/95'
          }`}
        style={{
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        {/* Animated background pattern */}
        {/* <div className={`absolute inset-0 opacity-10 ${isDarkMode ? 'opacity-5' : 'opacity-10'}`}>
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-500/20 via-transparent to-purple-500/20 animate-pulse" 
               style={{ animationDuration: '3s' }} />
        </div> */}

        {/* Hamburger Menu Overlay */}
        {isMenuOpen && (
          <div
            className="absolute inset-0 bg-black/50 z-20 backdrop-blur-sm"
            onClick={() => setIsMenuOpen(false)}
          />
        )}

        {/* Hamburger Menu Panel */}
        <div
          className={`absolute top-0 right-0 h-full w-64 z-30 transition-transform duration-300 ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'
            } ${isDarkMode
              ? 'bg-slate-900/98 border-l border-slate-700'
              : 'bg-white/98 border-l border-gray-200'
            }`}
          style={{
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          <div className="p-6">
            {/* Menu Header */}
            <div className="flex items-center justify-between mb-8">
              <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'
                }`}>
                Settings
              </h3>
              <button
                onClick={() => setIsMenuOpen(false)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isDarkMode
                  ? 'hover:bg-slate-800 text-slate-400 hover:text-white'
                  : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                  }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Theme Toggle Option */}
            <div className="mb-6">
              <div className={`text-xs uppercase tracking-wider mb-3 ${isDarkMode ? 'text-slate-400' : 'text-gray-500'
                }`}>
                Appearance
              </div>
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${isDarkMode
                  ? 'bg-slate-800 hover:bg-slate-700'
                  : 'bg-gray-100 hover:bg-gray-200'
                  }`}
              >
                <div className="flex items-center gap-3">
                  {isDarkMode ? (
                    <Moon className="w-5 h-5 text-blue-400" />
                  ) : (
                    <Sun className="w-5 h-5 text-yellow-500" />
                  )}
                  <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-slate-900'
                    }`}>
                    {isDarkMode ? 'Dark Mode' : 'Light Mode'}
                  </span>
                </div>
                <div
                  className={`w-12 h-6 rounded-full p-0.5 transition-all duration-300 ${isDarkMode ? 'bg-[#007AFF]' : 'bg-gray-300'
                    }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-all duration-300 ${isDarkMode ? 'translate-x-6' : 'translate-x-0'
                      }`}
                  />
                </div>
              </button>
            </div>

            {/* Detection Mode Option */}
            <div className="mb-6">
              <div className={`text-xs uppercase tracking-wider mb-3 ${isDarkMode ? 'text-slate-400' : 'text-gray-500'
                }`}>
                Detection Mode
              </div>
              <div className="relative">
                <select
                  value={selectedMode}
                  onChange={(e) => setSelectedMode(e.target.value)}
                  className={`w-full px-4 py-3 rounded-lg appearance-none cursor-pointer transition-all duration-200 font-medium ${isDarkMode
                    ? 'bg-slate-800 text-white hover:bg-slate-700'
                    : 'bg-gray-100 text-slate-900 hover:bg-gray-200'
                    }`}
                  style={{ paddingRight: '2.5rem' }}
                >
                  {modes.map((mode) => (
                    <option key={mode} value={mode}>
                      {mode}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className={`absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none ${isDarkMode ? 'text-slate-400' : 'text-gray-500'
                    }`}
                />
              </div>
            </div>

            {/* Manage Whitelist Option */}
            <div>
              <div className={`text-xs uppercase tracking-wider mb-3 ${isDarkMode ? 'text-slate-400' : 'text-gray-500'
                }`}>
                Whitelist
              </div>
              <button
                className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${isDarkMode
                  ? 'bg-slate-800 hover:bg-slate-700'
                  : 'bg-gray-100 hover:bg-gray-200'
                  }`}
              >
                <Shield className={`w-5 h-5 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`} />
                <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-slate-900'
                  }`}>
                  Manage Whitelist
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="relative z-10 h-full flex flex-col p-5">
          {/* Header Row */}
          <div className="flex items-center justify-between mb-6">
            {/* Power Button */}
            <button
              onClick={() => setIsPoweredOn(!isPoweredOn)}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300 ${isPoweredOn
                ? 'bg-[#007AFF] shadow-lg shadow-[#007AFF]/50 hover:shadow-[#007AFF]/70'
                : isDarkMode
                  ? 'bg-slate-700 hover:bg-slate-600'
                  : 'bg-gray-200 hover:bg-gray-300'
                }`}
              style={{
                boxShadow: isPoweredOn ? '0 0 20px rgba(0, 122, 255, 0.5)' : 'none',
              }}
            >
              <Power
                className={`w-5 h-5 transition-all duration-300 ${isPoweredOn ? 'text-white' : isDarkMode ? 'text-slate-400' : 'text-gray-600'
                  }`}
              />
            </button>
            {/* This is a "Ghost" div to match the width of the feedback button on the right */}
            <div className="w-7 h-7" />

            {/* GAMBA Logo */}
            <div className={`text-2xl font-bold tracking-wider ${isDarkMode ? 'text-white' : 'text-slate-900'
              }`}>
              GAMBA
            </div>

            {/* Right Side Buttons */}
            <div className="flex items-center gap-2">
              {/* Feedback Button - appears after analysis completes */}
              {hasCompletedAnalysis && (
                <button
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 ${isDarkMode
                    ? 'bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-600 hover:text-gray-900'
                    }`}
                >
                  <MessageSquare className="w-4 h-4" />
                </button>
              )}

              {/* Hamburger Menu Button */}
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300 ${isDarkMode
                  ? 'bg-slate-700 hover:bg-slate-600 text-white'
                  : 'bg-gray-200 hover:bg-gray-300 text-slate-900'
                  }`}
              >
                <Menu className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Hero Section - Status Indicator */}
          <div className="flex flex-col items-center mb-6">
            <div
              className={`w-20 h-20 rounded-full flex items-center justify-center mb-3 transition-all duration-500 ${isPoweredOn
                ? 'bg-[#28C76F]/20 shadow-lg shadow-[#28C76F]/30'
                : isDarkMode
                  ? 'bg-slate-800/50'
                  : 'bg-gray-200/50'
                }`}
              style={{
                boxShadow: isPoweredOn ? '0 0 30px rgba(40, 199, 111, 0.3)' : 'none',
              }}
            >
              <Shield
                className={`w-10 h-10 transition-all duration-500 ${isPoweredOn
                  ? 'text-[#28C76F] animate-pulse'
                  : isDarkMode
                    ? 'text-slate-600'
                    : 'text-gray-400'
                  }`}
                style={{ animationDuration: '2s' }}
              />
            </div>
            <div className={`text-lg font-semibold tracking-wide ${isPoweredOn
              ? 'text-[#28C76F]'
              : isDarkMode
                ? 'text-slate-500'
                : 'text-gray-500'
              }`}>
              STATUS: {isPoweredOn ? 'SECURE' : 'OFFLINE'}
            </div>
          </div>

          {/* Data Cards */}
          <div className={`rounded-xl p-4 mb-5 border backdrop-blur-sm ${isDarkMode
            ? 'bg-slate-800/50 border-slate-700'
            : 'bg-white/80 border-gray-200 shadow-sm'
            }`}>
            {/* Category with Confidence Score */}
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className={`text-xs uppercase tracking-wider mb-1 ${isDarkMode ? 'text-slate-400' : 'text-gray-500'
                  }`}>
                  Category
                </div>
                <div className={`text-base font-medium ${isDarkMode ? 'text-white' : 'text-slate-900'
                  }`}>
                  {category}
                </div>
              </div>

              {/* Circular Progress */}
              <div className="relative w-14 h-14">
                <svg className="w-14 h-14 transform -rotate-90">
                  <circle
                    cx="28"
                    cy="28"
                    r="24"
                    stroke={isDarkMode ? '#334155' : '#E5E7EB'}
                    strokeWidth="4"
                    fill="none"
                  />
                  <circle
                    cx="28"
                    cy="28"
                    r="24"
                    stroke="#007AFF"
                    strokeWidth="4"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 24}`}
                    strokeDashoffset={`${2 * Math.PI * 24 * (1 - confidenceScore / 100)}`}
                    className="transition-all duration-500"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`text-xs font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'
                    }`}>
                    {confidenceScore}%
                  </span>
                </div>
              </div>
            </div>

            {/* URL */}
            <div className="mb-3">
              <div className={`text-xs uppercase tracking-wider mb-1 ${isDarkMode ? 'text-slate-400' : 'text-gray-500'
                }`}>
                URL
              </div>
              <div
                className={`text-sm font-mono truncate ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}
                title={currentUrl}
              >
                {currentUrl}
              </div>
            </div>

            {/* Modifications */}
            <div className="mb-3">
              <div className={`text-xs uppercase tracking-wider mb-1 ${isDarkMode ? 'text-slate-400' : 'text-gray-500'
                }`}>
                Modifications
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-[#007AFF] text-white text-xs font-medium">
                  {pageEdits} Page Edits
                </span>
              </div>
            </div>

            {/* Threats Detected */}
            <div className="pt-3 border-t border-slate-700/50">
              <div className={`text-xs uppercase tracking-wider mb-1 ${isDarkMode ? 'text-slate-400' : 'text-gray-500'
                }`}>
                Threats Detected
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-[#EA5455] text-white text-xs font-medium">
                  {threatsCount} Threats
                </span>
              </div>
            </div>
          </div>

          {/* Control Center */}
          <div className="mt-auto">
            {/* Action Row */}
            <div className="flex gap-3">
              {/* Reanalyze/Pause Button */}
              <button
                onClick={handleReanalyze}
                disabled={!isPoweredOn}
                className={`w-32 h-12 rounded-lg flex items-center justify-center gap-2 font-semibold transition-all duration-300 ${!isPoweredOn
                  ? isDarkMode
                    ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : isRunning
                    ? 'bg-[#EA5455] hover:bg-[#EA5455]/90 text-white shadow-lg shadow-[#EA5455]/30 hover:shadow-[#EA5455]/50'
                    : 'bg-[#007AFF] hover:bg-[#007AFF]/90 text-white shadow-lg shadow-[#007AFF]/30 hover:shadow-[#007AFF]/50'
                  }`}
              >
                {isRunning ? (
                  <>
                    <Pause className="w-5 h-5" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5" />
                    <span>Reanalyze</span>
                  </>
                )}
              </button>

              {/* Add to Whitelist Button */}
              <button
                onClick={() => setIsWhitelisted(!isWhitelisted)}
                disabled={!isPoweredOn}
                className={`flex-1 h-12 rounded-lg flex items-center justify-center gap-2 font-semibold transition-all duration-300 ${!isPoweredOn
                  ? isDarkMode
                    ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : isWhitelisted
                    ? isDarkMode
                      ? 'bg-slate-700 hover:bg-slate-600 text-white border-2 border-slate-500'
                      : 'bg-gray-200 hover:bg-gray-300 text-slate-900 border-2 border-gray-400'
                    : isDarkMode
                      ? 'border-2 border-slate-600 hover:border-slate-500 text-slate-300 hover:text-white hover:bg-slate-700/50'
                      : 'border-2 border-gray-300 hover:border-gray-400 text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
              >
                {isWhitelisted ? (
                  <Minus className="w-5 h-5" />
                ) : (
                  <Plus className="w-5 h-5" />
                )}
                <span className="text-sm">
                  {isWhitelisted ? 'Remove from Whitelist' : 'Add to Whitelist'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
