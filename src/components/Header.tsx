
import { Button } from "@/components/ui/button";

const Header = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-sm bg-background/80 border-b border-primary/20">
      <nav className="container mx-auto px-3 sm:px-4 py-3 flex items-center justify-between">
        <h1 className="text-base sm:text-xl font-bold matrix-glow">MATRIX OS</h1>
        <div className="flex gap-2 sm:gap-4">
          <Button variant="outline" className="border-primary text-primary hover:bg-primary/20">
            Connect
          </Button>
          <Button variant="outline" className="border-primary text-primary hover:bg-primary/20">
            Execute
          </Button>
        </div>
      </nav>
    </header>
  );
};

export default Header;
