import { ArrowUpRight } from "lucide-react";

const protocolRows = [
  ["01", "POLICY", "Define the exact permitted use.", "Nine dimensions turn a policy into a boundary the network can read."],
  ["02", "REQUEST", "Bind purpose, recipient, retention and sharing.", "A use request names the data, the reason and the party asking for it."],
  ["03", "EVIDENCE", "Commit verifiable consent records and attestations.", "Frozen bytes and their hashes make a claim inspectable after the fact."],
  ["04", "CAPABILITY", "Release a single-use authorization only after consensus.", "Access is an outcome, not an assumption made by the interface."],
] as const;

export function Protocol() {
  return (
    <section id="protocol" className="site-section protocol-section">
      <div className="section-title-row"><div className="intro-label"><span className="section-index">02</span><span>Protocol</span></div><span className="section-aside">How a use becomes permission</span></div>
      <div className="protocol-list">
        {protocolRows.map(([number, title, summary, detail]) => (
          <details key={number} className="protocol-row">
            <summary><span className="protocol-number">{number}</span><span className="protocol-title">{title}</span><span className="protocol-summary">{summary}</span><ArrowUpRight className="protocol-arrow size-5" /></summary>
            <div className="protocol-detail"><span /> <p>{detail}</p></div>
          </details>
        ))}
      </div>
    </section>
  );
}
