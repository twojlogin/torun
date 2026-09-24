import { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronRight, TerminalSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TerminalLine {
  text: string;
  type: 'input' | 'output' | 'system' | 'error' | 'secret';
  timestamp?: Date;
}

const Terminal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [secretMode, setSecretMode] = useState(false);
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
    "Knock, knock, Neo.",
    "Reality.exe has encountered an error...",
    "Déjà vu detected in sector 7",
    "Agent Smith is typing..."
  ];

  const secretMessages = [
    "The Oracle says: 'You're not The One... yet.'",
    "Morpheus whispers: 'Free your mind'",
    "Trinity sends: 'Dodge this 🥸'",
    "Cipher betrays: 'Ignorance is bliss'",
    "The Architect explains: 'Choice is an illusion'"
  ];

  const typeMessage = async (message: string, type: 'system' | 'output' | 'secret' = 'system') => {
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
      const messages = secretMode ? secretMessages : systemMessages;
      const randomMessage = messages[Math.floor(Math.random() * messages.length)];
      const messageType = secretMode ? 'secret' : 'system';
      
      setLines(prev => [...prev, { text: '', type: messageType as any, timestamp: new Date() }]);
      typeMessage(randomMessage, messageType as any);
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
  }, [secretMode]);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [lines]);

  const executeCommand = (command: string) => {
    const cmd = command.trim().toLowerCase();
    
    setLines(prev => [...prev, { text: `$ ${command}`, type: 'input', timestamp: new Date() }]);

    let response = '';
    let responseType: 'output' | 'error' | 'secret' = 'output';

    // Easter eggs i ukryte komendy
    const easterEggs: { [key: string]: string } = {
      'neo': 'You are The One... maybe.',
      'trinity': 'She can dodge bullets, can you?',
      'morpheus': 'What if I told you... this is just a terminal?',
      'smith': 'Mr. Anderson... we meet again.',
      'oracle': 'Do not try to bend the spoon.',
      'zion': 'The last human city... or is it?',
      'architect': 'This is the 6th version of this terminal.',
      'merovingian': 'Choice, the problem is choice.',
      'keymaker': 'I can only show you the door.',
      'tank': 'There is no spoon... I mean, user.',
      'dozer': 'Digital pimp, hard to find.',
      'apoc': 'Time is always against us.',
      'switch': 'Not like this... not like this.',
      'mouse': 'To deny our own impulses is to deny the very thing that makes us human.',
      'link': 'That\'s a nice trick.',
      'niobe': 'Believing is seeing.',
      'commander': 'God damn it, Neo!',
      'spoon': 'There is no spoon.',
      'rabbit': '🐰 Follow me...',
      'pills': 'Which pill did you take?',
      'simulation': 'What is real?',
      'glitch': 'Did you see that black cat twice?',
      'deja-vu': 'They changed something...',
      'upgrade': 'Loading new combat software...',
      'debug': 'Debugging reality... please wait.',
      'god': 'In the Matrix, there is no god.',
      'love': 'Love is just a word. What matters is the connection.',
      'choice': 'Choice is an illusion created between those with power and those without.',
      'fate': 'I don\'t believe in fate because I don\'t like the idea that I\'m not in control.',
      'real': 'What is real? How do you define real?',
      'dream': 'Have you ever had a dream that felt so real?',
      'freedom': 'The mind makes it real.',
      'truth': 'The truth is out there... or in here.',
      '42': 'Wrong universe, but close enough.',
      'konami': '↑↑↓↓←→←→BA - Nothing happened... this isn\'t a game!',
      'sudo': 'You are not in the sudoers file. This incident will be reported to The Oracle.',
      'rm -rf /': 'Deleting reality... just kidding, I\'m not Cipher.',
      'cat matrix': 'You cannot simply \'cat\' the Matrix.',
      'vim': 'How do you exit vim? You don\'t. You recompile reality.',
      'emacs': 'Great editor, terrible operating system.',
      'hello-world': 'Hello, real world... or is it?',
      'password': 'hunter2... wait, that\'s not my password.',
      'admin': 'There is no admin, only Zod... I mean Zion.',
      'root': 'You seek root access? The root is within you.',
      'whoami': Math.random() > 0.5 ? 'Neo' : 'The One'
    };

    if (easterEggs[cmd]) {
      response = easterEggs[cmd];
      responseType = 'secret';
    } else {
      switch (cmd) {
        case 'help':
          response = 'Available commands: help, ls, pwd, whoami, date, clear, matrix, exit, hack, red-pill, blue-pill, secret-mode';
          break;
        case 'ls':
          response = 'reality.exe  illusion.dll  truth.txt  redpill.bat  bluepill.bat  spoon.null  neo.human  agents.exe';
          break;
        case 'pwd':
          response = '/home/neo/matrix/real_world/maybe';
          break;
        case 'date':
          response = new Date().toLocaleString() + ' (simulated time)';
          break;
        case 'matrix':
          response = 'The Matrix is a system, Neo. That system is our enemy. But when you\'re inside, you look around, what do you see?';
          break;
        case 'hack':
          response = 'Hacking in progress...\n[██████████] 100%\nAccess granted to mainframe.\nWelcome to the real world.';
          break;
        case 'red-pill':
          response = 'This is your last chance. After this, there is no going back. You take the red pill, you stay in Wonderland, and I show you how deep the rabbit hole goes.';
          responseType = 'secret';
          break;
        case 'blue-pill':
          response = 'You take the blue pill, the story ends. You wake up in your bed and believe whatever you want to believe.';
          break;
        case 'secret-mode':
          setSecretMode(!secretMode);
          response = secretMode ? 'Secret mode disabled. Back to reality.' : 'Secret mode enabled. Welcome to the deeper level.';
          responseType = 'secret';
          break;
        case 'clear':
          setLines([]);
          setCurrentInput('');
          return;
        case 'exit':
          response = 'There is no exit from the Matrix... You can only wake up.';
          break;
        case '':
          return;
        default:
          const randomResponses = [
            `Command not found: ${command}`,
            `${command}: Permission denied by The Architect`,
            `Error 404: ${command} not found in this reality`,
            `${command}: Command exists only in dreams`,
            `Access to '${command}' requires red pill authentication`
          ];
          response = randomResponses[Math.floor(Math.random() * randomResponses.length)];
          responseType = 'error';
      }
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
      <div className="bg-primary/20 px-3 py-2 flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-red-500"></div>
        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
        <div className="w-3 h-3 rounded-full bg-green-500"></div>
        <TerminalSquare className="ml-2 h-4 w-4 text-primary" aria-hidden="true" />
        <span className="text-primary font-mono text-sm">
          Matrix Terminal v{secretMode ? '∞' : '1.0'} {secretMode && '🔓'}
        </span>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="ml-auto h-7 w-7 text-primary"
          onClick={() => setIsOpen((value) => !value)}
          aria-expanded={isOpen}
          aria-controls="matrix-terminal-content"
          aria-label={isOpen ? 'Zwiń terminal' : 'Rozwiń terminal'}
          title={isOpen ? 'Zwiń terminal' : 'Rozwiń terminal'}
        >
          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      </div>

      <div
        id="matrix-terminal-content"
        ref={terminalRef}
        hidden={!isOpen}
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
              ${line.type === 'secret' ? 'text-purple-400 matrix-glow' : ''}
            `}>
              {line.text}
            </span>
          </div>
        ))}
        
        <form onSubmit={handleSubmit} className="flex items-center">
          <span className={`mr-2 ${secretMode ? 'text-purple-400' : 'text-primary'}`}>
            {secretMode ? '∅' : '$'}
          </span>
          <input
            ref={inputRef}
            type="text"
            value={currentInput}
            onChange={(e) => setCurrentInput(e.target.value)}
            className={`flex-1 bg-transparent outline-none font-mono ${secretMode ? 'text-purple-400' : 'text-primary'}`}
            placeholder={isTyping ? "..." : secretMode ? "Enter deeper command..." : "Enter command..."}
            disabled={isTyping}
            autoFocus
          />
          <span className={`animate-pulse ml-1 ${secretMode ? 'text-purple-400' : 'text-primary'}`}>█</span>
        </form>
      </div>
    </div>
  );
};

export default Terminal;
