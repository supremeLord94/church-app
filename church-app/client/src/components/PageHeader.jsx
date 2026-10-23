export default function PageHeader({ title, sub, back, children }) {
  return (
    <header className="page-head">
      <div>
        {back}
        <h1>{title}</h1>
        {sub && <p className="muted">{sub}</p>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </header>
  );
}
