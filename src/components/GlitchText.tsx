
import { useState, useEffect } from 'react';

interface GlitchTextProps {
  text: string;
  className?: string;
}

const GlitchText = ({ text, className = '' }: GlitchTextProps) => {
  const [displayText, setDisplayText] = useState(text);
  const [isGlitching, setIsGlitching] = useState(false);

  const glitchChars = '!<>-_\\/[]{}—=+*^?#________';
  
  const glitchText = () => {
    setIsGlitching(true);
    let iterations = 0;
    
    const interval = setInterval(() => {
      setDisplayText(
        text
          .split('')
          .map((char, index) => {
            if (index < iterations) {
              return char;
            }
            return glitchChars[Math.floor(Math.random() * glitchChars.length)];
          })
          .join('')
      );
      
      if (iterations >= text.length) {
        clearInterval(interval);
        setIsGlitching(false);
      }
      
      iterations += 1 / 3;
    }, 30);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      if (Math.random() > 0.85) {
        glitchText();
      }
    }, 3000 + Math.random() * 7000);

    return () => clearInterval(timer);
  }, [text]);

  return (
    <span 
      className={`${className} ${isGlitching ? 'animate-pulse' : ''}`}
      style={{
        fontFamily: 'monospace',
        textShadow: isGlitching ? '2px 0 #ff0000, -2px 0 #00ff00' : undefined
      }}
    >
      {displayText}
    </span>
  );
};

export default GlitchText;
