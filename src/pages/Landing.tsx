import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FileText, Mail, MessageSquare, Upload, ArrowRight, CheckCircle, Zap } from "lucide-react";
import doxenLogo from "@/assets/doxen-logo.png";

const Landing = () => {
  return (
    <div className="min-h-screen bg-background noise-bg overflow-hidden relative">
      {/* Ambient color blobs — CSS only, zero GPU WebGL cost */}
      <div className="fixed inset-0 pointer-events-none z-0" aria-hidden="true">
        {/* Red blob — top-left */}
        <div
          className="absolute -top-24 -left-24 w-[420px] h-[420px] rounded-full"
          style={{
            background: 'radial-gradient(circle, hsl(0 100% 50% / 0.28) 0%, transparent 70%)',
            filter: 'blur(48px)',
            transform: 'translateZ(0)',
          }}
        />
        {/* Green blob — top-center/right */}
        <div
          className="absolute -top-16 left-[40%] w-[380px] h-[360px] rounded-full"
          style={{
            background: 'radial-gradient(circle, hsl(152 100% 40% / 0.22) 0%, transparent 70%)',
            filter: 'blur(56px)',
            transform: 'translateZ(0)',
          }}
        />
        {/* Subtle red — bottom-right corner */}
        <div
          className="absolute bottom-0 right-0 w-[300px] h-[300px] rounded-full"
          style={{
            background: 'radial-gradient(circle, hsl(0 100% 50% / 0.14) 0%, transparent 70%)',
            filter: 'blur(60px)',
            transform: 'translateZ(0)',
          }}
        />
      </div>

      {/* Navigation */}
      <nav className="relative z-10 glass-subtle border-b border-border/30 sticky top-0 backdrop-blur-xl">
        <div className="container mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={doxenLogo} alt="Doxen" className="h-8 object-contain" />
          </div>
          <div className="flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost" className="text-muted-foreground hover:text-foreground">Sign In</Button>
            </Link>
            <Link to="/auth?mode=signup">
              <Button className="bg-primary/90 hover:bg-primary text-primary-foreground neon-glow-red">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 container mx-auto px-6 pt-32 pb-24 text-center">
        <div className="max-w-3xl mx-auto animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass border-primary/20 text-sm text-muted-foreground mb-8">
            <div className="w-2 h-2 rounded-full bg-accent pulse-green" />
            AI-Powered Documentation
          </div>
          <h1 className="text-6xl md:text-7xl font-bold text-foreground mb-6 leading-[1.05] tracking-tight">
            Three Clicks.
            <br />
            <span className="gradient-text">That's It.</span>
          </h1>
          <p className="text-lg text-muted-foreground mb-10 leading-relaxed max-w-xl mx-auto">
            Transform scattered emails, Slack messages, and meeting notes into 
            professional Business Requirements Documents.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link to="/auth?mode=signup">
              <Button size="lg" className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground neon-glow-red px-8 h-12 text-base">
                Generate BRD <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="lg" variant="outline" className="glass border-border/40 text-foreground hover:bg-muted/30 h-12 px-8 text-base">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="relative z-10 container mx-auto px-6 py-24">
        <h2 className="text-sm font-medium text-primary tracking-widest uppercase text-center mb-4">
          How It Works
        </h2>
        <p className="text-3xl font-bold text-center text-foreground mb-16 tracking-tight">
          From chaos to clarity in minutes
        </p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <WorkflowStep step={1} icon={<Upload className="h-6 w-6" />} title="Connect Sources" description="Link Gmail, Slack, or upload documents and transcripts" />
          <WorkflowStep step={2} icon={<MessageSquare className="h-6 w-6" />} title="Extract Requirements" description="AI filters noise and identifies key business requirements" />
          <WorkflowStep step={3} icon={<FileText className="h-6 w-6" />} title="Generate BRD" description="Get a structured, professional document in seconds" />
          <WorkflowStep step={4} icon={<CheckCircle className="h-6 w-6" />} title="Export & Share" description="Download as PDF or Markdown with full traceability" />
        </div>
      </section>

      {/* Features Grid */}
      <section className="relative z-10 py-24">
        <div className="container mx-auto px-6">
          <h2 className="text-sm font-medium text-primary tracking-widest uppercase text-center mb-4">
            Features
          </h2>
          <p className="text-3xl font-bold text-center text-foreground mb-16 tracking-tight">
            Everything you need, nothing you don't
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <FeatureCard icon={<Mail className="h-5 w-5" />} title="Gmail Integration" description="Import email threads directly from your inbox. Search by date, sender, or subject." />
            <FeatureCard icon={<MessageSquare className="h-5 w-5" />} title="Slack Integration" description="Connect channels and import conversations. Filter by date range." />
            <FeatureCard icon={<Upload className="h-5 w-5" />} title="Document Upload" description="Upload PDFs, Word docs, and meeting transcripts from any source." />
            <FeatureCard icon={<Zap className="h-5 w-5" />} title="Smart Extraction" description="AI identifies requirements, decisions, stakeholders, and timelines." />
            <FeatureCard icon={<CheckCircle className="h-5 w-5" />} title="Full Traceability" description="Every requirement links back to its source with confidence scores." />
            <FeatureCard icon={<Zap className="h-5 w-5" />} title="Natural Language Editing" description="Refine your BRD with simple commands like 'Add a security section'." />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 container mx-auto px-6 py-24 text-center">
        <div className="max-w-lg mx-auto glass rounded-2xl p-12 neon-glow-red">
          <h2 className="text-2xl font-bold text-foreground mb-4 tracking-tight">
            Ready to streamline your BRD process?
          </h2>
          <p className="text-muted-foreground mb-8">
            Join teams saving hours on documentation with Doxen.
          </p>
          <Link to="/auth?mode=signup">
            <Button size="lg" className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground neon-glow-red px-8">
              Get Started Free <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/30 py-8">
        <div className="container mx-auto px-6 text-center text-muted-foreground text-sm">
          <p>© 2026 Doxen. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

const WorkflowStep = ({ step, icon, title, description }: { step: number; icon: React.ReactNode; title: string; description: string }) => (
  <div className="text-center glass rounded-2xl p-6 group hover:border-primary/30 transition-all duration-300">
    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 text-primary mb-4 group-hover:neon-glow-red transition-shadow duration-300">
      {icon}
    </div>
    <div className="text-xs font-medium text-primary/70 tracking-wider uppercase mb-2">Step {step}</div>
    <h3 className="text-base font-semibold text-foreground mb-2">{title}</h3>
    <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
  </div>
);

const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) => (
  <div className="glass rounded-2xl p-6 group hover:border-primary/30 transition-all duration-300">
    <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary mb-4">
      {icon}
    </div>
    <h3 className="text-base font-semibold text-foreground mb-2">{title}</h3>
    <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
  </div>
);

export default Landing;
