// Dashboard screens — Profile, Links (CRUD + reorder), Analytics

function TopBar({ username }) {
  return (
    <header className="dash-topbar">
      <div className="dash-topbar-inner">
        <Logo size={22}/>
        <div className="dash-topbar-right">
          <a className="dash-publink" href="#" target="_blank" rel="noreferrer">
            <Icon name="link" size={13}/>
            <span>biolink.dev/@{username}</span>
            <Icon name="copy" size={13}/>
          </a>
          <button className="bl-btn ghost sm" type="button"><Icon name="logout" size={14}/>Sair</button>
        </div>
      </div>
    </header>
  );
}

function DashTabs({ value }) {
  const tabs = [
    { id: "profile", label: "Perfil", icon: "user" },
    { id: "links", label: "Meus links", icon: "link" },
    { id: "analytics", label: "Analytics", icon: "bar-chart" },
  ];
  return (
    <div className="dash-tabs" role="tablist">
      {tabs.map(t => (
        <button key={t.id} role="tab" aria-selected={value === t.id} className={"dash-tab" + (value === t.id ? " active" : "")} type="button">
          <Icon name={t.icon} size={14}/>{t.label}
        </button>
      ))}
    </div>
  );
}

function ThemeSwatches({ value = "light" }) {
  const themes = [
    { id: "light", label: "Light", strip: ["#FFFFFF", "#F1F5F9", "#2563EB"], border: "#E2E8F0", bg: "#FFFFFF", fg: "#0F172A" },
    { id: "dark", label: "Dark", strip: ["#0B1220", "#1A2233", "#60A5FA"], border: "#243046", bg: "#0B1220", fg: "#E5E7EB" },
    { id: "accent", label: "Accent", strip: ["#FAF7F2", "#F0E9DD", "#D97757"], border: "#E5DBC8", bg: "#FAF7F2", fg: "#1A1410" },
  ];
  return (
    <div className="theme-grid">
      {themes.map(t => (
        <button key={t.id} type="button" className={"theme-card" + (value === t.id ? " selected" : "")}
          style={{ background: t.bg, color: t.fg, borderColor: t.border }}>
          <span className="theme-card-head">
            <span className="theme-card-name">{t.label}</span>
            {value === t.id && <span className="theme-card-check"><Icon name="check" size={10} stroke={3}/></span>}
          </span>
          <span className="theme-card-strip">
            {t.strip.map((c, i) => <span key={i} style={{ background: c, borderColor: i === 0 ? t.border : "transparent" }}/>)}
          </span>
        </button>
      ))}
    </div>
  );
}

function DashProfileScreen() {
  const username = "alessandro";
  const display_name = "Alessandro Varela";
  const bio = "Engenheiro fullstack ensinando Next.js + Supabase em público.";
  return (
    <div className="dash-shell">
      <TopBar username={username}/>
      <main className="dash-page">
        <DashTabs value="profile"/>
        <section className="dash-card">
          <div className="dash-card-head">
            <h2>Perfil</h2>
            <p className="bl-muted">Como você aparece na sua página pública.</p>
          </div>
          <div className="dash-profile-row">
            <div className="dash-profile-preview">
              <Avatar src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=256" name={display_name} size={88}/>
              <div className="dash-profile-meta">
                <div className="dash-profile-name">{display_name}</div>
                <div className="dash-profile-handle">@{username}</div>
              </div>
            </div>
            <div className="dash-form">
              <Field label="Nome de exibição">
                <input type="text" defaultValue={display_name}/>
              </Field>
              <Field label="Bio" counter={<span className="bl-counter">{bio.length}/160</span>}>
                <textarea rows="3" defaultValue={bio}/>
              </Field>
              <Field label="URL do avatar" hint="Use uma imagem hospedada em http(s).">
                <input type="url" defaultValue="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=256"/>
              </Field>
              <Field label="Nome de usuário" hint="O username não pode ser alterado por enquanto.">
                <input type="text" defaultValue={username} disabled/>
              </Field>
              <div className="dash-actions"><Button variant="secondary">Cancelar</Button><Button>Salvar</Button></div>
            </div>
          </div>
        </section>

        <section className="dash-card">
          <div className="dash-card-head">
            <h2>Aparência</h2>
            <p className="bl-muted">Tema aplicado ao dashboard e à sua página pública.</p>
          </div>
          <ThemeSwatches value="light"/>
        </section>
      </main>
    </div>
  );
}

const DEMO_LINKS = [
  { id: "1", title: "Curso de Next.js + Supabase", url: "https://biolink.dev/curso", is_active: true, clicks: 412 },
  { id: "2", title: "Repositório no GitHub", url: "https://github.com/alessandro/youtube-biolink", is_active: true, clicks: 298 },
  { id: "3", title: "Canal no YouTube", url: "https://youtube.com/@alessandro", is_active: true, clicks: 241 },
  { id: "4", title: "Newsletter semanal", url: "https://buttondown.email/alessandro", is_active: true, clicks: 186 },
  { id: "5", title: "Discord da comunidade", url: "https://discord.gg/example", is_active: false, clicks: 110 },
];

function LinkRow({ link, dragging, ghost }) {
  return (
    <div className={"link-row" + (link.is_active ? "" : " inactive") + (dragging ? " dragging" : "") + (ghost ? " ghost" : "")}>
      <span className="link-grip" aria-label="Arrastar"><Icon name="grip" size={16}/></span>
      <div className="link-body">
        <div className="link-title">{link.title}</div>
        <div className="link-url">{link.url}</div>
      </div>
      <div className="link-meta">
        <span className="link-clicks tabular"><Icon name="bar-chart" size={11}/>{link.clicks}</span>
      </div>
      <button className={"bl-switch" + (link.is_active ? " on" : "")} aria-checked={link.is_active} role="switch" type="button"><span className="bl-knob"/></button>
      <div className="link-icons">
        <button className="bl-iconbtn" aria-label="Editar" type="button"><Icon name="pencil" size={14}/></button>
        <button className="bl-iconbtn danger" aria-label="Excluir" type="button"><Icon name="trash" size={14}/></button>
      </div>
    </div>
  );
}

function DashLinksScreen({ variant = "list" }) {
  return (
    <div className="dash-shell">
      <TopBar username="alessandro"/>
      <main className="dash-page">
        <DashTabs value="links"/>
        <section className="dash-card">
          <div className="dash-card-head split">
            <div>
              <h2>Meus links</h2>
              <p className="bl-muted">Adicione, reordene e ative os links que aparecem na sua página.</p>
            </div>
            <span className="bl-badge">{DEMO_LINKS.length} de 30</span>
          </div>

          <form className="link-add">
            <input type="text" placeholder="Título" defaultValue=""/>
            <input type="url" placeholder="https://"/>
            <Button type="button"><Icon name="plus" size={14} stroke={2}/>Adicionar link</Button>
          </form>

          <div className="link-list">
            {variant === "drag" ? (
              <>
                <LinkRow link={DEMO_LINKS[0]}/>
                <LinkRow link={DEMO_LINKS[1]} dragging/>
                <div className="link-drop-indicator"/>
                <LinkRow link={DEMO_LINKS[2]}/>
                <LinkRow link={DEMO_LINKS[3]}/>
                <LinkRow link={DEMO_LINKS[4]}/>
              </>
            ) : DEMO_LINKS.map(l => <LinkRow key={l.id} link={l}/>)}
          </div>
        </section>
      </main>
      {variant === "drag" && (
        <div className="dash-toast-mount"><Toast kind="info">Solte para reposicionar — a nova ordem é salva automaticamente.</Toast></div>
      )}
    </div>
  );
}

function DashLinksEmptyScreen() {
  return (
    <div className="dash-shell">
      <TopBar username="alessandro"/>
      <main className="dash-page">
        <DashTabs value="links"/>
        <section className="dash-card">
          <div className="dash-card-head split">
            <div>
              <h2>Meus links</h2>
              <p className="bl-muted">Adicione, reordene e ative os links que aparecem na sua página.</p>
            </div>
            <span className="bl-badge">0 de 30</span>
          </div>
          <form className="link-add">
            <input type="text" placeholder="Título"/>
            <input type="url" placeholder="https://"/>
            <Button type="button"><Icon name="plus" size={14} stroke={2}/>Adicionar link</Button>
          </form>
          <div className="link-empty">
            <div className="link-empty-illu"><Icon name="link" size={28} stroke={1.4}/></div>
            <h3>Você ainda não tem links.</h3>
            <p className="bl-muted">Adicione o primeiro acima — ele aparece imediatamente na sua página pública.</p>
          </div>
        </section>
      </main>
    </div>
  );
}

function DashAnalyticsScreen() {
  // Sample 30 day series
  const data = React.useMemo(() => {
    const out = [];
    let v = 18;
    for (let i = 0; i < 30; i++) {
      v += (Math.sin(i / 3) * 4) + (Math.random() * 6 - 2);
      out.push(Math.max(2, Math.round(v + 8 + i * 0.6)));
    }
    return out;
  }, []);
  const total = data.reduce((s, d) => s + d, 0);
  const max = Math.max(...data);
  const W = 680, H = 160, PAD = 8;
  const stepX = (W - PAD * 2) / (data.length - 1);
  const points = data.map((v, i) => `${PAD + i * stepX},${H - PAD - (v / max) * (H - PAD * 2 - 6)}`).join(" ");
  const area = `${PAD},${H - PAD} ${points} ${W - PAD},${H - PAD}`;

  const top = [
    { title: "Curso de Next.js + Supabase", clicks: 412, share: 31 },
    { title: "Repositório no GitHub", clicks: 298, share: 22 },
    { title: "Canal no YouTube", clicks: 241, share: 18 },
    { title: "Newsletter semanal", clicks: 186, share: 14 },
    { title: "Discord da comunidade", clicks: 110, share: 8 },
  ];

  return (
    <div className="dash-shell">
      <TopBar username="alessandro"/>
      <main className="dash-page">
        <DashTabs value="analytics"/>

        <section className="dash-card">
          <div className="dash-card-head split">
            <div>
              <h2>Cliques</h2>
              <p className="bl-muted">Eventos registrados server-side. Sem IP, sem user-agent completo.</p>
            </div>
            <div className="period-toggle">
              <button type="button">7d</button>
              <button type="button" className="active">30d</button>
              <button type="button">Tudo</button>
            </div>
          </div>

          <div className="stats-grid">
            <div className="stat">
              <span className="stat-label">Cliques (30d)</span>
              <span className="stat-value tabular">{total.toLocaleString("pt-BR")}</span>
              <span className="stat-delta up">+18% vs período anterior</span>
            </div>
            <div className="stat">
              <span className="stat-label">Cliques (7d)</span>
              <span className="stat-value tabular">{data.slice(-7).reduce((s, d) => s + d, 0)}</span>
              <span className="stat-delta up">+6% vs semana passada</span>
            </div>
            <div className="stat">
              <span className="stat-label">Links ativos</span>
              <span className="stat-value tabular">4 <span className="stat-of">/30</span></span>
              <span className="stat-delta muted">1 inativo</span>
            </div>
          </div>

          <div className="chart-wrap">
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height={H}>
              <defs>
                <linearGradient id="biolink-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.18"/>
                  <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0"/>
                </linearGradient>
              </defs>
              <polyline fill="url(#biolink-area)" stroke="none" points={area}/>
              <polyline fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" points={points}/>
            </svg>
            <div className="chart-axis">
              <span>há 30 dias</span><span>há 15 dias</span><span>hoje</span>
            </div>
          </div>
        </section>

        <section className="dash-card">
          <div className="dash-card-head">
            <h2>Top links</h2>
            <p className="bl-muted">Ranqueado por cliques nos últimos 30 dias.</p>
          </div>
          <div className="top-list">
            {top.map((t, i) => (
              <div key={i} className="top-row">
                <span className="top-rank tabular">{String(i + 1).padStart(2, "0")}</span>
                <div className="top-body">
                  <div className="top-title">{t.title}</div>
                  <div className="top-bar"><span className="top-bar-fill" style={{ width: `${t.share * 3.2}%` }}/></div>
                </div>
                <span className="top-clicks tabular">{t.clicks}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

Object.assign(window, { DashProfileScreen, DashLinksScreen, DashLinksEmptyScreen, DashAnalyticsScreen });
