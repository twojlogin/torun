
import { useState, useEffect } from 'react';

const MatrixGlitch = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [glitchType, setGlitchType] = useState<'text' | 'screen' | 'code'>('text');
  
  const glitchMessages = [
    "SYSTEM ERROR: Reality.exe has stopped working",
    "WARNING: Déjà vu detected",
    "ALERT: Agent Smith approaching...",
    "ERROR: Spoon.dll not found",
    "CRITICAL: Blue pill or red pill?",
    "GLITCH: You are not supposed to see this",
    "ANOMALY: Neo is online",
    "BUG: The cake is a lie... wait, wrong movie"
  ];

  const codeGlitches = [
    "if (reality === false) { wake_up(); }",
    "while(true) { follow_white_rabbit(); }",
    "const choice = pills.length > 1 ? 'red' : 'blue';",
    "// TODO: Fix reality bugs",
    "function escapeMatrix() { return impossible; }"
  ];

  useEffect(() => {
    const showGlitch = () => {
      setGlitchType(['text', 'screen', 'code'][Math.floor(Math.random() * 3)] as any);
      setIsVisible(true);
      
      setTimeout(() => {
        setIsVisible(false);
      }, 2000 + Math.random() * 3000);
    };

    const interval = setInterval(() => {
      if (Math.random() > 0.7) {
        showGlitch();
      }
    }, 20000 + Math.random() * 30000);

    // Pierwszy glitch po 10 sekund
    setTimeout(showGlitch, 10000);

    return () => clearInterval(interval);
  }, []);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-40 flex items-center justify-center">
      {glitchType === 'text' && (
        <div className="bg-black/90 border-2 border-red-500 p-6 rounded-lg animate-pulse">
          <p className="text-red-400 font-mono text-lg matrix-glow">
            {glitchMessages[Math.floor(Math.random() * glitchMessages.length)]}
          </p>
        </div>
      )}
      
      {glitchType === 'screen' && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/20 to-transparent animate-pulse opacity-50"></div>
      )}
      
      {glitchType === 'code' && (
        <div className="absolute top-4 right-4 bg-black/80 border border-primary/50 p-4 rounded font-mono text-sm text-primary">
          <div className="matrix-glow">
            {codeGlitches[Math.floor(Math.random() * codeGlitches.length)]}
          </div>
        </div>
      )}
    </div>
  );
};

export default MatrixGlitch;
