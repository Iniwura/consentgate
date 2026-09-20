import { CopyButton } from "@/components/consentgate/copy-button";
import { shortAddress } from "@/lib/format";
import { studioDevConfig } from "@/lib/config";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-display">CONSENT<br />BEFORE<br /><em>ACCESS.</em></div>
      <div className="footer-columns"><div><span>/PROTOCOL</span><a href="#policy">Policy</a><a href="#evidence">Evidence</a><a href="#decision">Review</a><a href="#contract">Capability</a></div><div><span>/NETWORK</span><strong>Studio Dev</strong><strong>Chain {studioDevConfig.chainId}</strong><strong>GenLayer</strong></div><div><span>/CONTRACT</span><strong>{shortAddress(studioDevConfig.contractAddress)}</strong><div className="footer-copy"><CopyButton value={studioDevConfig.contractAddress} />Copy address</div></div></div>
      <div className="footer-bottom"><span>©2026 ConsentGate</span><span>Authorization as a verifiable state transition.</span><a href="#top">Back to top ↑</a></div>
    </footer>
  );
}
