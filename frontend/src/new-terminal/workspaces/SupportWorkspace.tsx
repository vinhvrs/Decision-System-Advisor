export default function SupportWorkspace({ title, description }: { title: string; description: string }) {
  return (
    <div className="nt-workspace">
      <section className="nt-context-strip">
        <div className="nt-context-title">
          <div className="nt-label nt-info">Workspace</div>
          <h1>{title}</h1>
        </div>
        <div className="nt-support-description">{description}</div>
      </section>
      <section className="nt-panel">
        <div className="nt-panel-title">
          <strong>{title}</strong>
          <span className="nt-panel-meta">New terminal architecture</span>
        </div>
        <div className="nt-empty">
          This workspace now uses the new shell. Its legacy visual tree will be replaced without importing old page components.
        </div>
      </section>
    </div>
  );
}
