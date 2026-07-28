#!/usr/bin/env bash
#
# Epic 6 — Demos de segurança NO APP (precisa do `pnpm dev` rodando).
# Mostra a camada de borda da Story 6.5: auth guard (proxy), a página pública
# passando livre, e os headers de segurança (CSP etc.).
#
# Fluxo de cada teste:  anúncio + comando  →  [enter]  →  executa + resultado.
#
# Antes de rodar, em outro terminal:  pnpm dev
# Depois:                             ./scripts/demo-epic6-app.sh
#
set -euo pipefail

BOLD=$'\e[1m'; DIM=$'\e[2m'; RED=$'\e[31m'; GREEN=$'\e[32m'; YELLOW=$'\e[33m'
CYAN=$'\e[36m'; RESET=$'\e[0m'

cd "$(dirname "$0")/.."
APP="${APP_URL:-http://localhost:3000}"

# username público real (do banco de dev) para o teste da página pública
set -a; source .env.local; set +a
USER_PUB="$(curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/profiles?select=username&limit=1" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  | grep -oE '"username":"[^"]+"' | head -1 | cut -d'"' -f4)"
USER_PUB="${USER_PUB:-alessandrovarela}"

hr()    { printf '%s\n' "${DIM}────────────────────────────────────────────────────────────${RESET}"; }
pause() { echo; read -rp "${DIM}   [enter para executar]${RESET} " _; echo; }
cmd()   { echo "${CYAN}   │ $1${RESET}"; }
cmdtop(){ echo "${DIM}   ┌─ comando enviado ao app ──────────────────────────────────${RESET}"; }
cmdend(){ echo "${DIM}   └────────────────────────────────────────────────────────────${RESET}"; }
# imprime "código + Location" de uma rota, sem seguir o redirect
probe() { curl -s -o /dev/null -D - "$APP$1" 2>/dev/null | tr -d '\r'; }

clear
echo "${BOLD}${CYAN}  Epic 6 — Segurança na borda (app)   ${RESET}"
echo "${DIM}  app: $APP · Story 6.5 — auth guard + CSP no proxy${RESET}"
hr

# preflight: o app está no ar?
if ! curl -s -o /dev/null --max-time 5 "$APP/health"; then
  echo "${RED}  O app não respondeu em $APP.${RESET}"
  echo "  Suba o servidor em outro terminal:  ${BOLD}pnpm dev${RESET}"
  echo "  (ou aponte para outra porta:  APP_URL=http://localhost:3001 $0)"
  exit 1
fi

# ══════════════════════════════════════════════════════════════════════════════
# 1) Auth guard — entrar no dashboard sem estar logado  [6.5]
# ══════════════════════════════════════════════════════════════════════════════
echo "${BOLD}1) Entrar no painel sem login${RESET}"
echo "   O proxy de borda intercepta /dashboard/* antes de renderizar: sem sessão,"
echo "   chuta para /login (e guarda o destino em ?next= para voltar depois do login)."
echo
cmdtop
cmd "curl -i $APP/dashboard            ${DIM}# -i mostra o cabeçalho da resposta${RESET}${CYAN}"
cmd "curl -i $APP/dashboard/analytics"
cmd "curl -i $APP/dashboard/links"
cmdend
pause
for route in /dashboard /dashboard/analytics /dashboard/links; do
  h=$(probe "$route")
  code=$(printf '%s' "$h" | grep -iE '^HTTP/' | tail -1 | awk '{print $2}')
  loc=$(printf '%s' "$h"  | grep -i '^location:' | sed 's/[Ll]ocation: //')
  if [ "$code" = "307" ] || [ "$code" = "302" ]; then
    echo "${GREEN}   🟢 GET $route → HTTP $code → $loc${RESET}"
  else
    echo "${RED}   ⚠️  GET $route → HTTP $code (esperado redirect)${RESET}"
  fi
done
echo; hr

# ══════════════════════════════════════════════════════════════════════════════
# 2) A página pública passa livre — o guard é cirúrgico  [6.5]
# ══════════════════════════════════════════════════════════════════════════════
echo "${BOLD}2) A página pública NÃO é barrada${RESET}"
echo "   O guard cobre só /dashboard/*. A página do usuário e o resto seguem abertos"
echo "   (senão o proxy cobraria borda e cache em toda visita anônima)."
echo
cmdtop
cmd "curl -s -o /dev/null -w '%{http_code}'  $APP/$USER_PUB"
cmd "curl -s -o /dev/null -w '%{http_code}'  $APP/health"
cmd "curl -s -o /dev/null -w '%{http_code}'  $APP/login"
cmdend
pause
for route in "/$USER_PUB" "/health" "/login"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$APP$route")
  echo "${GREEN}   🟢 GET $route → HTTP $code${RESET}"
done
echo "${DIM}   (200 = passou direto, sem redirect — o guard não intercepta.)${RESET}"
echo; hr

# ══════════════════════════════════════════════════════════════════════════════
# 3) Headers de segurança  [6.5]
# ══════════════════════════════════════════════════════════════════════════════
echo "${BOLD}3) Headers de segurança em toda resposta${RESET}"
echo "   O navegador recebe as políticas que limitam clickjacking, sniffing de tipo"
echo "   e de onde scripts/estilos podem vir (CSP)."
echo
cmdtop
cmd "curl -i $APP/            ${DIM}# olhar os cabeçalhos de segurança da resposta${RESET}${CYAN}"
cmdend
pause
H=$(probe "/")
show() { # $1 = nome do header, $2 = rótulo curto
  local v; v=$(printf '%s' "$H" | grep -i "^$1:" | head -1 | cut -d' ' -f2- | cut -c1-52)
  if [ -n "$v" ]; then echo "${GREEN}   🟢 $2${RESET} ${DIM}→ ${v}…${RESET}"
  else echo "${RED}   ⚠️  $2 ausente${RESET}"; fi
}
show "content-security-policy"   "Content-Security-Policy "
show "x-frame-options"           "X-Frame-Options         "
show "x-content-type-options"    "X-Content-Type-Options  "
show "referrer-policy"           "Referrer-Policy         "
hr
echo "${BOLD}${GREEN}  Borda protegida: guard no /dashboard, pública livre, CSP em tudo.${RESET}"
echo
