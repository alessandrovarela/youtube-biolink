// Public screens — Public profile (light/dark/accent) + 404 username

function PublicProfileScreen({ profile, links }) {
  const p = profile || {
    username: "alessandro",
    display_name: "Alessandro Varela",
    bio: "Engenheiro fullstack ensinando Next.js + Supabase em público. Open-source, pt-BR.",
    avatar_url: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=256&h=256&fit=crop"
  };
  const ls = links || [
  { id: "1", title: "Curso de Next.js + Supabase" },
  { id: "2", title: "Repositório no GitHub" },
  { id: "3", title: "Canal no YouTube" },
  { id: "4", title: "Newsletter semanal" },
  { id: "5", title: "Discord da comunidade" }];

  return (
    <main className="public-page">
      <Avatar src={p.avatar_url} name={p.display_name} size={92} />
      <h1 className="public-name">{p.display_name}</h1>
      <div className="public-handle">@{p.username}</div>
      {p.bio && <p className="public-bio">{p.bio}</p>}
      <div className="public-link-list">
        {ls.map((l) =>
        <a key={l.id} href="#" className="public-link" target="_blank" rel="noopener noreferrer">
            <span>{l.title}</span>
            <Icon name="arrow-up-right" size={16} />
          </a>
        )}
      </div>
      <footer className="public-footer">Feito com <a href="#">biolink</a></footer>
    </main>);

}

function NotFoundScreen() {
  return (
    <main className="public-page nf">
      <div className="nf-glyph">
        <svg viewBox="0 0 240 100" width="240" height="100" aria-hidden="true">
          <text x="120" y="80" textAnchor="middle" fontFamily="Inter" fontSize="84" fontWeight="700" letterSpacing="-0.04em" fill="none" stroke="currentColor" strokeWidth="2">404</text>
        </svg>
      </div>
      <h1 className="public-name">Página não encontrada</h1>
      <p className="public-bio">O nome de usuário <b>@indisponivel</b> não existe ou foi alterado.</p>
      <div className="public-link-list">
        <a href="#" className="public-link"><span>Voltar para a home</span><Icon name="arrow-up-right" size={16} /></a>
      </div>
      <footer className="public-footer">Feito com <a href="#">biolink</a></footer>
    </main>);

}

Object.assign(window, { PublicProfileScreen, NotFoundScreen });