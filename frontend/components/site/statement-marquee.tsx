export function StatementMarquee() {
  const line = "POLICY TO PERMISSION.   EVIDENCE TO CONSENSUS.   CONSENT BEFORE ACCESS.";
  return (
    <section className="statement-band" aria-label="ConsentGate statement">
      <div className="statement-track">
        <span>{line}</span><span aria-hidden="true">{line}</span>
      </div>
    </section>
  );
}
