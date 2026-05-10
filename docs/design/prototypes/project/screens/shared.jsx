// Shared primitives reused across Biolink screens

function Logo({ size = 22 }) {
  return (
    <span className="bl-brand">
      <span className="bl-mark" style={{ width: size, height: size }}>
        <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 1 0-7.07-7.07l-1.5 1.5"/>
          <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 1 0 7.07 7.07l1.5-1.5"/>
        </svg>
      </span>
      <span className="bl-word">biolink</span>
    </span>
  );
}

function Icon({ name, size = 16, stroke = 1.5 }) {
  const props = {
    width: size, height: size, viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", strokeWidth: stroke,
    strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true,
  };
  switch (name) {
    case "plus": return <svg {...props}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
    case "trash": return <svg {...props}><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>;
    case "pencil": return <svg {...props}><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>;
    case "grip": return <svg {...props}><circle cx="9" cy="6" r="0.6"/><circle cx="9" cy="12" r="0.6"/><circle cx="9" cy="18" r="0.6"/><circle cx="15" cy="6" r="0.6"/><circle cx="15" cy="12" r="0.6"/><circle cx="15" cy="18" r="0.6"/></svg>;
    case "eye": return <svg {...props}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>;
    case "eye-off": return <svg {...props}><path d="M9.88 9.88a3 3 0 0 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>;
    case "out": return <svg {...props}><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>;
    case "logout": return <svg {...props}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;
    case "link": return <svg {...props}><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 1 0-7.07-7.07l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 1 0 7.07 7.07l1.5-1.5"/></svg>;
    case "copy": return <svg {...props}><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>;
    case "check": return <svg {...props}><polyline points="20 6 9 17 4 12"/></svg>;
    case "check-circle": return <svg {...props}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;
    case "alert": return <svg {...props}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
    case "info": return <svg {...props}><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>;
    case "mail": return <svg {...props}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22 6 12 13 2 6"/></svg>;
    case "mail-check": return <svg {...props}><path d="M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h8"/><polyline points="22 6 12 13 2 6"/><polyline points="16 19 18 21 22 17"/></svg>;
    case "search-x": return <svg {...props}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8.5" y1="8.5" x2="13.5" y2="13.5"/><line x1="13.5" y1="8.5" x2="8.5" y2="13.5"/></svg>;
    case "bar-chart": return <svg {...props}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
    case "user": return <svg {...props}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
    case "palette": return <svg {...props}><circle cx="13.5" cy="6.5" r="0.5"/><circle cx="17.5" cy="10.5" r="0.5"/><circle cx="8.5" cy="7.5" r="0.5"/><circle cx="6.5" cy="12.5" r="0.5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c3.31 0 6-2.69 6-6 0-4.97-4.5-9-10-9z"/></svg>;
    case "arrow-up": return <svg {...props}><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>;
    case "arrow-down": return <svg {...props}><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>;
    case "arrow-up-right": return <svg {...props}><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>;
    case "loader": return <svg {...props}><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>;
    default: return null;
  }
}

function Avatar({ src, name, size = 96 }) {
  const initials = (name || "?").trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();
  return (
    <div className="bl-avatar" style={{ width: size, height: size, fontSize: size / 3 }}>
      {src ? <img src={src} alt="" /> : <span>{initials}</span>}
    </div>
  );
}

function Field({ label, hint, error, children, counter }) {
  return (
    <div className={"bl-field" + (error ? " has-error" : "")}>
      <div className="bl-field-head">
        <label>{label}</label>
        {counter}
      </div>
      {children}
      {error && <span className="bl-error"><Icon name="alert" size={12}/>{error}</span>}
      {!error && hint && <span className="bl-hint">{hint}</span>}
    </div>
  );
}

function Button({ children, variant = "primary", size = "md", full, type = "button", onClick, disabled, loading }) {
  return (
    <button
      type={type}
      className={`bl-btn ${variant} ${size}` + (full ? " full" : "") + (loading ? " loading" : "")}
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading && <span className="bl-spin"><Icon name="loader" size={14}/></span>}
      {children}
    </button>
  );
}

function Toast({ kind = "success", children }) {
  const icons = { success: "check-circle", error: "alert", info: "info" };
  return (
    <div className={"bl-toast " + kind}>
      <span className={"bl-toast-icon " + kind}><Icon name={icons[kind]} size={14} stroke={2}/></span>
      <span>{children}</span>
    </div>
  );
}

function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="auth-shell">
      <div className="auth-brand"><Logo size={26}/></div>
      <div className="auth-card">
        <div className="auth-head">
          <h1>{title}</h1>
          {subtitle && <p className="bl-muted">{subtitle}</p>}
        </div>
        {children}
      </div>
      {footer && <div className="auth-footer">{footer}</div>}
    </div>
  );
}

Object.assign(window, { Logo, Icon, Avatar, Field, Button, Toast, AuthShell });
