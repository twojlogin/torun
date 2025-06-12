
import MatrixRain from "@/components/MatrixRain";
import Header from "@/components/Header";
import Terminal from "@/components/Terminal";
import { Card } from "@/components/ui/card";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <MatrixRain />
      <Header />
      
      <main className="container mx-auto px-4 pt-24 relative z-10">
        <div className="flex flex-col items-center justify-center min-h-[80vh] gap-8">
          <h1 className="text-4xl md:text-6xl font-bold text-center matrix-glow mb-8">
            Welcome to The Matrix
          </h1>
          
          <Terminal />
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-6xl mt-8">
            <Card className="bg-card/30 backdrop-blur-sm border-primary/20 p-6 hover:border-primary/50 transition-colors">
              <h3 className="text-xl font-bold mb-4 matrix-glow">System Status</h3>
              <p className="text-muted-foreground">All systems operational</p>
            </Card>
            
            <Card className="bg-card/30 backdrop-blur-sm border-primary/20 p-6 hover:border-primary/50 transition-colors">
              <h3 className="text-xl font-bold mb-4 matrix-glow">Network</h3>
              <p className="text-muted-foreground">Connection secure</p>
            </Card>
            
            <Card className="bg-card/30 backdrop-blur-sm border-primary/20 p-6 hover:border-primary/50 transition-colors">
              <h3 className="text-xl font-bold mb-4 matrix-glow">Security</h3>
              <p className="text-muted-foreground">Encryption active</p>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
