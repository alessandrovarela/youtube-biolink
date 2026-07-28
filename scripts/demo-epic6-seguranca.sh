#!/usr/bin/env bash
#
# Demo de segurança do Epic 6 — para gravação.
# Roda 3 "ataques" contra o banco de DESENVOLVIMENTO e mostra a defesa bloqueando.
# Não deixa rastro: o que a Demo 2 escreve é limpo automaticamente no fim.
#
# Uso:  ./scripts/demo-epic6-seguranca.sh
#
set -euo pipefail

# ── cores ────────────────────────────────────────────────────────────────────
BOLD=$'\e[1m'; DIM=$'\e[2m'; RED=$'\e[31m'; GREEN=$'\e[32m'; YELLOW=$'\e[33m'
BLUE=$'\e[34m'; CYAN=$'\e[36m'; RESET=$'\e[0m'

cd "$(dirname "$0")/.."

# ── credenciais (do .env.local — projeto de desenvolvimento) ─────────────────
set -a; source .env.local; set +a
URL="$NEXT_PUBLIC_SUPABASE_URL"
ANON="$NEXT_PUBLIC_SUPABASE_ANON_KEY"           # chave PÚBLICA — é o que um visitante teria
SR="$SUPABASE_SERVICE_ROLE_KEY"                 # só para preparar/limpar a demo; nunca aparece na tela

# link ativo real para os ataques mirarem
LINK="$(curl -s "$URL/rest/v1/links?is_active=eq.true&select=id&limit=1" \
  -H "apikey: $SR" -H "Authorization: Bearer $SR" | grep -oE '"id":"[^"]+"' | head -1 | cut -d'"' -f4)"

hr() { printf '%s\n' "${DIM}────────────────────────────────────────────────────────────${RESET}"; }
pause() { echo; read -rp "${DIM}[enter para o próximo ataque]${RESET} " _; echo; }

clear
echo "${BOLD}${CYAN}  Epic 6 — Segurança em Camadas   ${RESET}"
echo "${DIM}  alvo: banco de desenvolvimento · chave usada: a mesma pública que vai pro browser${RESET}"
hr

# ══════════════════════════════════════════════════════════════════════════════
# DEMO 1 — Forjar um clique falso direto no banco
# ══════════════════════════════════════════════════════════════════════════════
echo "${BOLD}1) Forjar um clique — escrita crua na tabela${RESET}"
echo "   Há dois caminhos para gravar um clique: a ${BOLD}porta oficial${RESET} (a função que"
echo "   o app usa — é o Teste 2) e a ${BOLD}escrita crua${RESET}, direto na tabela. Um visitante"
echo "   real SEMPRE usa a porta oficial; a escrita crua o app nunca faz — só um"
echo "   atacante tentaria, para pular a validação. É o que este teste tenta."
echo
echo "${YELLOW}   🔴 ATAQUE:${RESET} POST /rest/v1/link_clicks  (INSERT direto na tabela — caminho que o app nunca usa)"
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$URL/rest/v1/link_clicks" \
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON" -H "Content-Type: application/json" \
  -d "{\"link_id\":\"$LINK\"}")
if [ "$code" = "401" ]; then
  echo "${GREEN}   🟢 BLOQUEADO:${RESET} HTTP $code · ${GREEN}permission denied${RESET} — RLS nega o INSERT anônimo."
else
  echo "${RED}   ⚠️  passou: HTTP $code — algo está errado!${RESET}"
fi
echo "${DIM}   (a escrita crua ficava aberta antes do Epic 6 — agora só a porta oficial escreve.)${RESET}"
pause

# ══════════════════════════════════════════════════════════════════════════════
# DEMO 2 — Rate limiting: a parede
# ══════════════════════════════════════════════════════════════════════════════
echo "${BOLD}2) E pelo caminho legítimo? A parede do rate limiting${RESET}"
echo "   O atacante desiste do INSERT e martela a função oficial de tracking"
echo "   num loop. O teto é 60 cliques por minuto, por link."
echo
START="$(date -u +%Y-%m-%dT%H:%M:%S)"
echo "${YELLOW}   🔴 ATAQUE:${RESET} 65 chamadas seguidas em rpc/record_link_click"
printf '   '
ok=0; blocked=0; firstblock=0
for i in $(seq 1 65); do
  r=$(curl -s -X POST "$URL/rest/v1/rpc/record_link_click" \
      -H "apikey: $ANON" -H "Authorization: Bearer $ANON" -H "Content-Type: application/json" \
      -d "{\"p_link_id\":\"$LINK\"}")
  if [ "$r" = "true" ]; then
    ok=$((ok+1)); printf "${GREEN}▪${RESET}"
  else
    blocked=$((blocked+1)); [ "$firstblock" -eq 0 ] && firstblock=$i; printf "${RED}▪${RESET}"
  fi
done
echo; echo
echo "${GREEN}   🟢 ${ok} gravados${RESET}  →  ${RED}🚫 ${blocked} bloqueados${RESET}   ${DIM}(parede na tentativa #${firstblock})${RESET}"

# limpeza — remove o que a demo escreveu e reseta o contador (repetível em vários takes)
del=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE \
  "$URL/rest/v1/link_clicks?link_id=eq.$LINK&clicked_at=gte.$START" \
  -H "apikey: $SR" -H "Authorization: Bearer $SR" -H "Prefer: return=minimal")
curl -s -o /dev/null -X DELETE "$URL/rest/v1/rate_limit_counters?bucket=eq.track_link&subject=eq.$LINK" \
  -H "apikey: $SR" -H "Authorization: Bearer $SR" -H "Prefer: return=minimal"
echo "${DIM}   (limpeza automática: ${ok} cliques de teste removidos [HTTP $del] e contador zerado.)${RESET}"
pause

# ══════════════════════════════════════════════════════════════════════════════
# DEMO 3 — Roubar as métricas de todos os perfis
# ══════════════════════════════════════════════════════════════════════════════
echo "${BOLD}3) Roubar a analytics de todo mundo${RESET}"
echo "   A view de agregação já vazava: com a chave pública dava para ler os"
echo "   cliques de TODOS os perfis. O Epic 6 fechou esse buraco."
echo
echo "${YELLOW}   🔴 ATAQUE:${RESET} GET /rest/v1/link_click_daily  (chave anônima)"
code=$(curl -s -o /dev/null -w "%{http_code}" "$URL/rest/v1/link_click_daily?select=*&limit=5" \
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON")
if [ "$code" = "401" ]; then
  echo "${GREEN}   🟢 BLOQUEADO:${RESET} HTTP $code · ${GREEN}permission denied${RESET} — a view agora respeita a RLS."
else
  echo "${RED}   ⚠️  passou: HTTP $code — vazamento aberto!${RESET}"
fi
hr
echo "${BOLD}${GREEN}  Defesa em camadas: RLS + rate limiting. Banco intacto ao fim.${RESET}"
echo
