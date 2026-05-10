function TopBar({ username, onSignOut }) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="brand">
          <span className="logo-mark"/>
          <span className="logo-word">biolink</span>
        </div>
        <div className="topbar-right">
          <a className="public-link" href="#" target="_blank" rel="noreferrer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 1 0-7.07-7.07l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 1 0 7.07 7.07l1.5-1.5"/></svg>
            /@{username}
          </a>
          <button className="btn ghost sm" onClick={onSignOut}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Sair
          </button>
        </div>
      </div>
    </header>
  );
}

function Tabs({ value, onChange }) {
  const tabs = [
    { id: "profile", label: "Perfil" },
    { id: "links", label: "Meus links" },
    { id: "analytics", label: "Analytics" },
  ];
  return (
    <div className="tabs" role="tablist">
      {tabs.map(t => (
        <button key={t.id} role="tab" aria-selected={value === t.id}
          className={"tab" + (value === t.id ? " active" : "")}
          onClick={() => onChange(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

function ProfileForm({ profile, onChange, onSave, onTheme }) {
  const themes = ["light","dark","accent"];
  return (
    <div className="card">
      <h2 className="card-title">Perfil</h2>
      <div className="field">
        <label htmlFor="dn">Nome de exibição</label>
        <input id="dn" value={profile.display_name} onChange={e => onChange({ display_name: e.target.value })}/>
      </div>
      <div className="field">
        <label htmlFor="bio">Bio</label>
        <textarea id="bio" rows="2" value={profile.bio} onChange={e => onChange({ bio: e.target.value.slice(0,160) })}/>
        <span className="hint">{profile.bio.length}/160</span>
      </div>
      <div className="field">
        <label htmlFor="av">URL do avatar</label>
        <input id="av" value={profile.avatar_url} onChange={e => onChange({ avatar_url: e.target.value })}/>
      </div>

      <div className="divider"></div>
      <h2 className="card-title" style={{ marginTop: 4 }}>Aparência</h2>
      <div className="theme-grid">
        {themes.map(t => (
          <button key={t}
            className={"theme-opt theme-" + t + (profile.theme === t ? " selected" : "")}
            onClick={() => onTheme(t)}
            aria-pressed={profile.theme === t}>
            <span className="theme-name">
              {t}
              {profile.theme === t && (
                <span className="theme-check">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </span>
              )}
            </span>
            <span className="theme-strip">
              <span className="ts1"/><span className="ts2"/><span className="ts3"/>
            </span>
          </button>
        ))}
      </div>

      <div className="actions-row">
        <button className="btn primary" onClick={onSave}>Salvar</button>
      </div>
    </div>
  );
}

function LinkRow({ link, onToggle, onDelete, onEdit }) {
  return (
    <div className={"link-row" + (link.is_active ? "" : " inactive")}>
      <svg className="grip" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/></svg>
      <div className="link-body">
        <div className="link-title">{link.title}</div>
        <div className="link-url">{link.url}</div>
      </div>
      <button className={"switch" + (link.is_active ? " on" : "")} onClick={() => onToggle(link.id)} aria-checked={link.is_active} role="switch">
        <span className="knob"/>
      </button>
      <button className="icon-btn" aria-label="Editar" onClick={() => onEdit(link.id)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
      </button>
      <button className="icon-btn" aria-label="Excluir" onClick={() => onDelete(link.id)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
      </button>
    </div>
  );
}

function LinkList({ links, onAdd, onToggle, onDelete, onEdit }) {
  const [title, setTitle] = React.useState("");
  const [url, setUrl] = React.useState("");
  const submit = (e) => {
    e.preventDefault();
    if (!title.trim() || !url.trim()) return;
    onAdd({ title: title.trim(), url: url.trim() });
    setTitle(""); setUrl("");
  };
  return (
    <div className="card">
      <h2 className="card-title">Meus links</h2>
      <form className="add-form" onSubmit={submit}>
        <input placeholder="Título" value={title} onChange={e => setTitle(e.target.value.slice(0,60))}/>
        <input placeholder="https://" value={url} onChange={e => setUrl(e.target.value)}/>
        <button className="btn primary" type="submit">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Adicionar
        </button>
      </form>
      <div className="link-list">
        {links.map(l => (
          <LinkRow key={l.id} link={l} onToggle={onToggle} onDelete={onDelete} onEdit={onEdit}/>
        ))}
        {links.length === 0 && (
          <div className="empty">Você ainda não tem links. Adicione o primeiro acima.</div>
        )}
      </div>
    </div>
  );
}

function AnalyticsPanel({ data }) {
  const total = data.reduce((s, d) => s + d.clicks, 0);
  const max = Math.max(1, ...data.map(d => d.clicks));
  const W = 600, H = 120, PAD = 4;
  const stepX = (W - PAD*2) / Math.max(1, data.length - 1);
  const points = data.map((d, i) => `${PAD + i*stepX},${H - PAD - (d.clicks/max) * (H - PAD*2)}`).join(" ");
  return (
    <div className="card">
      <h2 className="card-title">Analytics</h2>
      <div className="stats-row">
        <div className="stat">
          <span className="stat-label">Cliques (30d)</span>
          <span className="stat-value tabular">{total.toLocaleString("pt-BR")}</span>
          <span className="stat-delta">+82 vs período anterior</span>
        </div>
        <div className="stat">
          <span className="stat-label">Links ativos</span>
          <span className="stat-value tabular">5</span>
          <span className="stat-delta muted">de 30</span>
        </div>
        <div className="stat">
          <span className="stat-label">CTR médio</span>
          <span className="stat-value tabular">8,4%</span>
          <span className="stat-delta muted">por visita</span>
        </div>
      </div>
      <div className="chart-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height="120">
          <polyline fill="none" stroke="var(--color-accent)" strokeWidth="2" points={points}/>
          <polyline fill="var(--color-accent-soft)" stroke="none" opacity="0.5"
            points={`${PAD},${H-PAD} ${points} ${W-PAD},${H-PAD}`}/>
        </svg>
      </div>
      <div className="top-links">
        <div className="top-row top-head">
          <span>Link</span>
          <span className="tabular">Cliques</span>
        </div>
        <div className="top-row"><span>Curso de Next.js + Supabase</span><span className="tabular">412</span></div>
        <div className="top-row"><span>Repositório no GitHub</span><span className="tabular">298</span></div>
        <div className="top-row"><span>Newsletter semanal</span><span className="tabular">186</span></div>
        <div className="top-row"><span>Canal no YouTube</span><span className="tabular">241</span></div>
        <div className="top-row"><span>Discord da comunidade</span><span className="tabular">110</span></div>
      </div>
    </div>
  );
}

Object.assign(window, { TopBar, Tabs, ProfileForm, LinkList, LinkRow, AnalyticsPanel });
