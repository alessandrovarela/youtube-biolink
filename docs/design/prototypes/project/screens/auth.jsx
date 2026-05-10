// Auth-related screens — Signup, Check email, Login, Reset (request + confirm), Confirm failed

function SignupScreen() {
  return (
    <AuthShell title="Criar conta" subtitle="Crie sua página de links em menos de 5 minutos." footer={<>Já tem conta? <a href="#">Entrar</a></>}>
      <form className="auth-form" onSubmit={e => e.preventDefault()}>
        <Field label="E-mail">
          <input type="email" defaultValue="alessandro@example.com"/>
        </Field>
        <Field label="Nome de usuário" hint="Apenas letras minúsculas, números e _ — começa com letra.">
          <div className="bl-input-prefix">
            <span className="bl-prefix">biolink.dev/@</span>
            <input type="text" defaultValue="alessandro"/>
          </div>
        </Field>
        <Field label="Senha" hint="Mínimo 8 caracteres.">
          <div className="bl-input-suffix">
            <input type="password" defaultValue="••••••••••"/>
            <button type="button" className="bl-suffix-btn" aria-label="Mostrar senha"><Icon name="eye" size={16}/></button>
          </div>
        </Field>
        <Field label="Confirmar senha">
          <input type="password" defaultValue="••••••••••"/>
        </Field>
        <Button type="submit" full>Criar conta</Button>
        <p className="bl-muted bl-tiny">Ao continuar, você aceita os termos de uso e a política de privacidade.</p>
      </form>
    </AuthShell>
  );
}

function CheckEmailScreen() {
  return (
    <AuthShell title="Confirme seu e-mail" footer={<>Errou o e-mail? <a href="#">Voltar e corrigir</a></>}>
      <div className="auth-illustration"><Icon name="mail-check" size={36} stroke={1.4}/></div>
      <p className="auth-lede">Enviamos um link de confirmação para <b>alessandro@example.com</b>. Abra o e-mail e clique no link para ativar sua conta.</p>
      <div className="auth-actions">
        <Button variant="secondary" full><Icon name="mail" size={16}/>Reenviar e-mail</Button>
      </div>
      <p className="bl-muted bl-tiny">Não chegou em alguns minutos? Verifique a caixa de spam.</p>
    </AuthShell>
  );
}

function LoginScreen({ banner }) {
  return (
    <AuthShell title="Entrar" subtitle="Acesse seu dashboard." footer={<>Novo aqui? <a href="#">Criar conta</a></>}>
      {banner && <div className="auth-banner success"><Icon name="check-circle" size={14}/>{banner}</div>}
      <form className="auth-form" onSubmit={e => e.preventDefault()}>
        <Field label="E-mail">
          <input type="email" defaultValue="alessandro@example.com"/>
        </Field>
        <Field label="Senha">
          <div className="bl-input-suffix">
            <input type="password" defaultValue="••••••••••"/>
            <button type="button" className="bl-suffix-btn" aria-label="Mostrar senha"><Icon name="eye" size={16}/></button>
          </div>
          <div className="bl-field-aside"><a href="#" className="bl-link-sm">Esqueci minha senha</a></div>
        </Field>
        <Button type="submit" full>Entrar</Button>
      </form>
    </AuthShell>
  );
}

function LoginErrorScreen() {
  return (
    <AuthShell title="Entrar" subtitle="Acesse seu dashboard." footer={<>Novo aqui? <a href="#">Criar conta</a></>}>
      <div className="auth-banner error"><Icon name="alert" size={14}/>Não foi possível entrar. Verifique seu e-mail e senha.</div>
      <form className="auth-form" onSubmit={e => e.preventDefault()}>
        <Field label="E-mail">
          <input type="email" defaultValue="alessandro@example.com"/>
        </Field>
        <Field label="Senha">
          <div className="bl-input-suffix">
            <input type="password" defaultValue="•••••"/>
            <button type="button" className="bl-suffix-btn" aria-label="Mostrar senha"><Icon name="eye" size={16}/></button>
          </div>
          <div className="bl-field-aside"><a href="#" className="bl-link-sm">Esqueci minha senha</a></div>
        </Field>
        <Button type="submit" full>Entrar</Button>
      </form>
    </AuthShell>
  );
}

function ResetRequestScreen() {
  return (
    <AuthShell title="Recuperar senha" subtitle="Enviaremos um link para você definir uma nova senha." footer={<><a href="#">Voltar para entrar</a></>}>
      <form className="auth-form" onSubmit={e => e.preventDefault()}>
        <Field label="E-mail">
          <input type="email" defaultValue="alessandro@example.com"/>
        </Field>
        <Button type="submit" full>Enviar link</Button>
      </form>
    </AuthShell>
  );
}

function ResetConfirmScreen() {
  return (
    <AuthShell title="Definir nova senha" subtitle="Escolha uma senha forte que você ainda não usou.">
      <form className="auth-form" onSubmit={e => e.preventDefault()}>
        <Field label="Nova senha" hint="Mínimo 8 caracteres.">
          <div className="bl-input-suffix">
            <input type="password" defaultValue="••••••••••"/>
            <button type="button" className="bl-suffix-btn" aria-label="Mostrar senha"><Icon name="eye" size={16}/></button>
          </div>
        </Field>
        <Field label="Confirmar senha">
          <input type="password" defaultValue="••••••••••"/>
        </Field>
        <Button type="submit" full>Salvar nova senha</Button>
      </form>
    </AuthShell>
  );
}

function ConfirmFailedScreen() {
  return (
    <AuthShell title="Link expirado" footer={<><a href="#">Ir para entrar</a></>}>
      <div className="auth-illustration warn"><Icon name="alert" size={36} stroke={1.4}/></div>
      <p className="auth-lede">Esse link de confirmação expirou ou já foi usado. Você pode pedir um novo e-mail de verificação.</p>
      <div className="auth-actions">
        <Button variant="secondary" full><Icon name="mail" size={16}/>Reenviar verificação</Button>
      </div>
    </AuthShell>
  );
}

Object.assign(window, { SignupScreen, CheckEmailScreen, LoginScreen, LoginErrorScreen, ResetRequestScreen, ResetConfirmScreen, ConfirmFailedScreen });
