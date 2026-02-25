import { useRef, useEffect } from 'react';
import { GambaExtension, GambaExtensionRef } from './components/GambaExtension';

export default function App() {
  const gambaRef = useRef<GambaExtensionRef>(null);


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
      <GambaExtension ref={gambaRef} />
    </div>
  );
}