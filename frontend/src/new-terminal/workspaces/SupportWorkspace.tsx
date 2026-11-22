export default function SupportWorkspace({ title, description }: { title: string; description: string }) {
  return (
    <div className="nt-workspace">
      <section className="nt-context-strip">
        <div className="nt-context-title">
          <div className="nt-label nt-info">Research</div>
          <h1>{title}</h1>
        </div>
        <div className="nt-support-description">{description}</div>
      </section>
      <section className="nt-flat-surface">
        <div className="nt-subsection-title"><strong>{title}</strong><span>Research workspace</span></div>
        <div className="nt-empty nt-empty-compact">No research records are available in this workspace yet.</div>
      </section>
    </div>
  );
}
