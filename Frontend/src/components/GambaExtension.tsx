import { useState } from 'react';
import { Power, Sun, Moon, Shield, Play, Pause, Plus, Minus, ChevronDown, Menu, X } from 'lucide-react';

export function GambaExtension() {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isPoweredOn, setIsPoweredOn] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedMode, setSelectedMode] = useState('Both');
  const [confidenceScore, setConfidenceScore] = useState(87);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isWhitelisted, setIsWhitelisted] = useState(false);

  const modes = ['AI', 'Malicious Code', 'Both'];

  return (
    <div className="w-full h-full overflow-hidden bg-background">
      {/* Glassmorphism Container */}
      <div
        className={`w-full h-full relative flex flex-col ${isDarkMode
          ? 'bg-gradient-to-br from-slate-900/95 via-slate-800/95 to-slate-900/95'
          : 'bg-gradient-to-br from-white/95 via-gray-50/95 to-white/95'
          }`}
        style={{
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        {/* Animated background pattern */}
        <div className={`absolute inset-0 opacity-10 ${isDarkMode ? 'opacity-5' : 'opacity-10'}`}>
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-500/20 via-transparent to-purple-500/20 animate-pulse"
            style={{ animationDuration: '3s' }} />
        </div>

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
        <div className="relative z-10 h-full flex flex-col p-6">
          {/* Header Row */}
          <div className="flex items-center justify-between mb-8">
            {/* Power Button */}
            <button
              onClick={() => setIsPoweredOn(!isPoweredOn)}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${isPoweredOn
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
                className={`w-6 h-6 transition-all duration-300 ${isPoweredOn ? 'text-white' : isDarkMode ? 'text-slate-400' : 'text-gray-600'
                  }`}
              />
            </button>

            {/* GAMBA Logo */}
            <div className={`text-2xl font-bold tracking-wider ${isDarkMode ? 'text-white' : 'text-slate-900'
              }`}>
              GAMBA
            </div>

            {/* Hamburger Menu Button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${isDarkMode
                ? 'bg-slate-700 hover:bg-slate-600 text-white'
                : 'bg-gray-200 hover:bg-gray-300 text-slate-900'
                }`}
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>

          {/* Hero Section - Status Indicator */}
          <div className="flex flex-col items-center mb-8">
            <div
              className={`w-24 h-24 rounded-full flex items-center justify-center mb-4 transition-all duration-500 ${isPoweredOn
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
                className={`w-12 h-12 transition-all duration-500 ${isPoweredOn
                  ? 'text-[#28C76F] animate-pulse'
                  : isDarkMode
                    ? 'text-slate-600'
                    : 'text-gray-400'
                  }`}
                style={{ animationDuration: '2s' }}
              />
            </div>
            <div className={`text-xl font-semibold tracking-wide ${isPoweredOn
              ? 'text-[#28C76F]'
              : isDarkMode
                ? 'text-slate-500'
                : 'text-gray-500'
              }`}>
              STATUS: {isPoweredOn ? 'SECURE' : 'OFFLINE'}
            </div>
          </div>

          {/* Data Cards */}
          <div className={`rounded-xl p-4 mb-6 border backdrop-blur-sm ${isDarkMode
            ? 'bg-slate-800/50 border-slate-700'
            : 'bg-white/80 border-gray-200 shadow-sm'
            }`}>
            {/* Category with Confidence Score */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className={`text-xs uppercase tracking-wider mb-1 ${isDarkMode ? 'text-slate-400' : 'text-gray-500'
                  }`}>
                  Category
                </div>
                <div className={`text-base font-medium ${isDarkMode ? 'text-white' : 'text-slate-900'
                  }`}>
                  Educational
                </div>
              </div>

              {/* Circular Progress */}
              <div className="relative w-16 h-16">
                <svg className="w-full h-full transform -rotate-90">
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
            <div className="mb-4">
              <div className={`text-xs uppercase tracking-wider mb-1 ${isDarkMode ? 'text-slate-400' : 'text-gray-500'
                }`}>
                URL
              </div>
              <div className={`text-sm font-mono truncate ${isDarkMode ? 'text-slate-300' : 'text-slate-700'
                }`}>
                https://education.example.com/cyber-security-101
              </div>
            </div>

            {/* Modifications */}
            <div>
              <div className={`text-xs uppercase tracking-wider mb-1 ${isDarkMode ? 'text-slate-400' : 'text-gray-500'
                }`}>
                Modifications
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-[#007AFF] text-white text-xs font-medium">
                  3 Page Edits
                </span>
              </div>
            </div>

            {/* Threats Detected */}
            <div className="mt-4 pt-4 border-t border-slate-700/50">
              <div className={`text-xs uppercase tracking-wider mb-1 ${isDarkMode ? 'text-slate-400' : 'text-gray-500'
                }`}>
                Threats Detected
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-[#EA5455] text-white text-xs font-medium">
                  0 Threats
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
                onClick={() => setIsRunning(!isRunning)}
                disabled={!isPoweredOn}
                className={`w-32 h-14 rounded-lg flex items-center justify-center gap-2 font-semibold transition-all duration-300 ${!isPoweredOn
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
                className={`flex-1 h-14 rounded-lg flex items-center justify-center gap-2 font-semibold transition-all duration-300 ${!isPoweredOn
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
}