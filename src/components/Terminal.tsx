
import { useState, useEffect, useRef } from 'react';

interface TerminalLine {
  text: string;
  type: 'input' | 'output' | 'system' | 'error';
  timestamp?: Date;
}

const Terminal = () => {
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const systemMessages = [
    "Initializing connection...",
    "Access granted.",
    "Welcome to the Matrix.",
    "Follow the white rabbit...",
    "There is no spoon.",
    "Wake up, Neo...",
    "The Matrix has you...",
    "Knock, knock, Neo."
  ];

  const typeMessage = async (message: string, type: 'system' | 'output' = 'system') => {
    setIsTyping(true);
    for (let i = 0; i <= message.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 50));
      setLines(prev => [
        ...prev.slice(0, -1),
        { text: message.slice(0, i), type, timestamp: new Date() }
      ]);
    }
    setIsTyping(false);
  };

  useEffect(() => {
    const showRandomMessage = () => {
      const randomMessage = systemMessages[Math.floor(Math.random() * systemMessages.length)];
      setLines(prev => [...prev, { text: '', type: 'system', timestamp: new Date() }]);
      typeMessage(randomMessage);
    };

    // Pierwsza wiadomość od razu
    setTimeout(showRandomMessage, 1000);
    
    // Losowe wiadomości co 15-30 sekund
    const interval = setInterval(() => {
      if (Math.random() > 0.7) { // 30% szansy co interwał
        showRandomMessage();
      }
    }, 15000 + Math.random() * 15000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [lines]);

  const executeCommand = (command: string) => {
    const cmd = command.trim().toLowerCase();
    
    setLines(prev => [...prev, { text: `$ ${command}`, type: 'input', timestamp: new Date() }]);

    let response = '';
    let responseType: 'output' | 'error' = 'output';

    switch (cmd) {
      case 'help':
        response = 'Available commands: help, ls, pwd, whoami, date, clear, matrix, exit, hack, red-pill, blue-pill';
        break;
      case 'ls':
        response = 'reality.exe  illusion.dll  truth.txt  redpill.bat  bluepill.bat  spoon.null';
        break;
      case 'pwd':
        response = '/home/neo/matrix/real_world';
        break;
      case 'whoami':
        response = Math.random() > 0.5 ? 'Neo' : 'The One';
        break;
      case 'date':
        response = new Date().toLocaleString() + ' (or is it?)';
        break;
      case 'matrix':
        response = 'The Matrix is a system, Neo. That system is our enemy.';
        break;
      case 'hack':
        response = 'Hacking in progress...\n[██████████] 100%\nAccess granted to mainframe.';
        break;
      case 'red-pill':
        response = 'This is your last chance. After this, there is no going back.';
        break;
      case 'blue-pill':
        response = 'The story ends, you wake up in your bed and believe whatever you want to believe.';
        break;
      case 'clear':
        setLines([]);
        setCurrentInput('');
        return;
      case 'exit':
        response = 'There is no exit from the Matrix...';
        break;
      case '':
        return;
      default:
        response = `Command not found: ${command}`;
        responseType = 'error';
    }

    // Dodaj opóźnienie jak prawdziwy terminal
    setTimeout(() => {
      setLines(prev => [...prev, { text: response, type: responseType, timestamp: new Date() }]);
    }, 100 + Math.random() * 200);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentInput.trim() && !isTyping) {
      executeCommand(currentInput);
      setCurrentInput('');
    }
  };

  const handleTerminalClick = () => {
    inputRef.current?.focus();
  };

  return (
    <div className="w-full max-w-4xl mx-auto bg-black/90 backdrop-blur-sm border border-primary/30 rounded-lg overflow-hidden">
      <div className="bg-primary/20 px-4 py-2 flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-red-500"></div>
        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
        <div className="w-3 h-3 rounded-full bg-green-500"></div>
        <span className="ml-4 text-primary font-mono text-sm">Matrix Terminal v1.0</span>
      </div>
      
      <div 
        ref={terminalRef}
        className="h-96 overflow-y-auto p-4 font-mono text-sm cursor-text"
        onClick={handleTerminalClick}
      >
        {lines.map((line, index) => (
          <div key={index} className="mb-1">
            <span className={`
              ${line.type === 'input' ? 'text-primary' : ''}
              ${line.type === 'output' ? 'text-green-400' : ''}
              ${line.type === 'system' ? 'text-primary matrix-glow' : ''}
              ${line.type === 'error' ? 'text-red-400' : ''}
            `}>
              {line.text}
            </span>
          </div>
        ))}
        
        <form onSubmit={handleSubmit} className="flex items-center">
          <span className="text-primary mr-2">$</span>
          <input
            ref={inputRef}
            type="text"
            value={currentInput}
            onChange={(e) => setCurrentInput(e.target.value)}
            className="flex-1 bg-transparent text-primary outline-none font-mono"
            placeholder={isTyping ? "..." : "Enter command..."}
            disabled={isTyping}
            autoFocus
          />
          <span className="text-primary animate-pulse ml-1">█</span>
        </form>
      </div>
    </div>
  );
};

export default Terminal;
