import { ArrowUpRight, WalletCards } from "lucide-react";

export function FinalCta({ onRequest, onConnect }: { onRequest: () => void; onConnect: () => void }) {
  return (
    <section id="request-access" className="final-cta site-section">
      <div className="final-cta-kicker">08 / Next authorization</div>
      <h2>Request<br /><em>access.</em></h2>
      <p>Define the use. Attach evidence.<br />Let consensus decide whether access should exist.</p>
      <div className="final-cta-actions"><button type="button" onClick={onRequest} className="editorial-button editorial-button-light">New authorization request <ArrowUpRight className="size-4" /></button><button type="button" onClick={onConnect} className="editorial-button editorial-button-dark"><WalletCards className="size-4" /> Connect wallet</button></div>
    </section>
  );
}
