import { useState } from 'react';
import { GambaExtension } from './components/GambaExtension';
import { Chrome, Lock, Star, Zap, Shield } from 'lucide-react';

export default function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
      <GambaExtension />
    </div>
  );
}