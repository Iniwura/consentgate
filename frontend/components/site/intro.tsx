import { ArrowUpRight } from "lucide-react";

export function Intro() {
  return (
    <section id="intro" className="site-section intro-section">
      <div className="intro-label"><span className="section-index">01</span><span>What is ConsentGate?</span></div>
      <div className="intro-copy">
        <h2>ConsentGate decides whether a specific use of data is actually permitted before access is released.</h2>
        <div className="intro-support">
          <p>Policy defines the boundary. A request binds the purpose. Evidence makes the consent inspectable. Consensus decides whether a capability should exist.</p>
          <a href="#live-case" className="text-link">View live authorization <ArrowUpRight className="size-4" /></a>
        </div>
      </div>
    </section>
  );
}
