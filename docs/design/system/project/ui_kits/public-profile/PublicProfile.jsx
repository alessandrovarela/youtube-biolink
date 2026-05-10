function LinkButton({ title, url, onClick }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      className="link-row"
    >
      <span className="link-title">{title}</span>
      <svg className="link-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="7" y1="17" x2="17" y2="7"/>
        <polyline points="7 7 17 7 17 17"/>
      </svg>
    </a>
  );
}

function Avatar({ src, name, size = 96 }) {
  const initials = (name || "?").split(/\s+/).slice(0,2).map(w => w[0]).join("").toUpperCase();
  return (
    <div className="avatar" style={{ width: size, height: size, fontSize: size/3 }}>
      {src ? <img src={src} alt="" /> : <span>{initials}</span>}
    </div>
  );
}

function PublicProfile({ profile, links, onLinkClick }) {
  return (
    <main className="public-page">
      <Avatar src={profile.avatar_url} name={profile.display_name} />
      <h1 className="display-name">{profile.display_name}</h1>
      <div className="username">@{profile.username}</div>
      {profile.bio && <p className="bio">{profile.bio}</p>}
      <div className="link-list">
        {links.map(l => (
          <LinkButton key={l.id} title={l.title} url={l.url} onClick={() => onLinkClick?.(l.id)} />
        ))}
      </div>
      <footer className="public-footer">
        Feito com <a href="#" target="_blank" rel="noopener noreferrer">biolink</a>
      </footer>
    </main>
  );
}

Object.assign(window, { PublicProfile, LinkButton, Avatar });
