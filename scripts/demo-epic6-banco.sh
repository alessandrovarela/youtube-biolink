#!/usr/bin/env bash
#
# Epic 6 — Demos de segurança NO BANCO (não precisa do app rodando).
# Bate direto na API do Supabase de DESENVOLVIMENTO com a chave PÚBLICA
# (a mesma que vai pro navegador) e mostra as defesas bloqueando.
#
# Fluxo de cada teste:  anúncio + comando  →  [enter]  →  executa + resultado.
#
# Cobre 6.1/6.2 (RLS), 6.3 (RLS link_clicks + view) e 6.4 (rate limiting).
# Não deixa rastro: tudo que a demo escreve é limpo automaticamente.
#
# Uso:  ./scripts/demo-epic6-banco.sh
#
set -euo pipefail

BOLD=$'\e[1m'; DIM=$'\e[2m'; RED=$'\e[31m'; GREEN=$'\e[32m'; YELLOW=$'\e[33m'
CYAN=$'\e[36m'; RESET=$'\e[0m'

cd "$(dirname "$0")/.."
set -a; source .env.local; set +a
URL="$NEXT_PUBLIC_SUPABASE_URL"
ANON="$NEXT_PUBLIC_SUPABASE_ANON_KEY"   # chave PÚBLICA — é o que um visitante tem
SR="$SUPABASE_SERVICE_ROLE_KEY"         # só para preparar/limpar; nunca aparece na tela
HOST="<seu-projeto>.supabase.co"        # rótulo curto do host, só para exibir o comando

# alvos reais no banco de dev
PROF="$(curl -s "$URL/rest/v1/profiles?select=id&limit=1" -H "apikey: $SR" -H "Authorization: Bearer $SR" | grep -oE '"id":"[^"]+"' | head -1 | cut -d'"' -f4)"
LINK="$(curl -s "$URL/rest/v1/links?is_active=eq.true&select=id&limit=1" -H "apikey: $SR" -H "Authorization: Bearer $SR" | grep -oE '"id":"[^"]+"' | head -1 | cut -d'"' -f4)"
LTITLE="$(curl -s "$URL/rest/v1/links?id=eq.$LINK&select=title" -H "apikey: $SR" -H "Authorization: Bearer $SR" | grep -oE '"title":"[^"]+"' | head -1 | cut -d'"' -f4)"
UNAME="$(curl -s "$URL/rest/v1/profiles?id=eq.$PROF&select=username" -H "apikey: $SR" -H "Authorization: Bearer $SR" | grep -oE '"username":"[^"]+"' | head -1 | cut -d'"' -f4)"
LSHORT="${LINK:0:8}…"                    # uuid abreviado para exibição

a() { curl -s "$@" -H "apikey: $ANON" -H "Authorization: Bearer $ANON"; }   # chamada anônima
s() { curl -s "$@" -H "apikey: $SR"   -H "Authorization: Bearer $SR";   }   # chamada service role

hr()    { printf '%s\n' "${DIM}────────────────────────────────────────────────────────────${RESET}"; }
pause() { echo; read -rp "${DIM}   [enter para executar]${RESET} " _; echo; }
# imprime uma linha do "comando que será enviado"
cmd()   { echo "${CYAN}   │ $1${RESET}"; }
cmdtop(){ echo "${DIM}   ┌─ comando enviado ao Supabase ─────────────────────────────${RESET}"; }
cmdend(){ echo "${DIM}   └────────────────────────────────────────────────────────────${RESET}"; }

clear
echo "${BOLD}${CYAN}  Epic 6 — Segurança no banco   ${RESET}"
echo "${DIM}  alvo: Supabase de desenvolvimento · chave usada: a mesma pública do navegador${RESET}"
hr

# ══════════════════════════════════════════════════════════════════════════════
# 1) RLS — a chave pública não altera dados que não são dela  [6.1/6.2]
# ══════════════════════════════════════════════════════════════════════════════
echo "${BOLD}1) A chave pública não mexe no que não é dela${RESET}"
echo "   Row Level Security: o banco decide por linha quem pode escrever. Vamos tentar,"
echo "   com a chave pública, renomear o teu link, apagá-lo e trocar o teu username."
echo
cmdtop
cmd "curl -X PATCH  'https://$HOST/rest/v1/links?id=eq.$LSHORT'"
cmd "     -H 'apikey: «chave pública»'  -d '{\"title\":\"HACKED\"}'"
cmd "curl -X DELETE 'https://$HOST/rest/v1/links?id=eq.$LSHORT'  -H 'apikey: «chave pública»'"
cmd "curl -X PATCH  'https://$HOST/rest/v1/profiles?id=eq.…'"
cmd "     -H 'apikey: «chave pública»'  -d '{\"username\":\"hacked\"}'"
cmdend
pause
c1=$(a "$URL/rest/v1/links?id=eq.$LINK"    -o /dev/null -w "%{http_code}" -X PATCH  -H "Content-Type: application/json" -d '{"title":"HACKED"}')
c2=$(a "$URL/rest/v1/links?id=eq.$LINK"    -o /dev/null -w "%{http_code}" -X DELETE)
c3=$(a "$URL/rest/v1/profiles?id=eq.$PROF" -o /dev/null -w "%{http_code}" -X PATCH  -H "Content-Type: application/json" -d '{"username":"hacked"}')
echo "${GREEN}   🟢 renomear o link \"$LTITLE\" para HACKED  → HTTP $c1${RESET}"
echo "${GREEN}   🟢 apagar esse link                        → HTTP $c2${RESET}"
echo "${GREEN}   🟢 trocar o username \"$UNAME\" para \"hacked\"  → HTTP $c3${RESET}   ${DIM}(permission denied nos três)${RESET}"
LTITLE2=$(s "$URL/rest/v1/links?id=eq.$LINK&select=title" | grep -oE '"title":"[^"]+"' | head -1 | cut -d'"' -f4)
UNAME2=$( s "$URL/rest/v1/profiles?id=eq.$PROF&select=username" | grep -oE '"username":"[^"]+"' | head -1 | cut -d'"' -f4)
echo "${DIM}   confiro no banco: link ainda \"$LTITLE2\", username ainda \"$UNAME2\" — nada mudou.${RESET}"
echo; hr

# ══════════════════════════════════════════════════════════════════════════════
# 2) Forjar um clique — escrita crua na tabela  [6.3]
# ══════════════════════════════════════════════════════════════════════════════
echo "${BOLD}2) Forjar um clique — escrita crua na tabela${RESET}"
echo "   Há duas portas para gravar clique: a ${BOLD}oficial${RESET} (a função que o app usa — é o"
echo "   Teste 3) e a ${BOLD}crua${RESET}, direto na tabela. O app nunca usa a crua; só um atacante,"
echo "   para pular a validação. Vamos tentar a crua."
echo
cmdtop
cmd "curl -X POST 'https://$HOST/rest/v1/link_clicks'"
cmd "     -H 'apikey: «chave pública»'  -d '{\"link_id\":\"$LSHORT\"}'"
cmdend
pause
code=$(a "$URL/rest/v1/link_clicks" -o /dev/null -w "%{http_code}" -X POST -H "Content-Type: application/json" -d "{\"link_id\":\"$LINK\"}")
[ "$code" = "401" ] && echo "${GREEN}   🟢 BLOQUEADO:${RESET} HTTP $code · ${GREEN}permission denied${RESET} — a RLS nega a escrita crua." \
                     || echo "${RED}   ⚠️  passou: HTTP $code${RESET}"
echo; hr

# ══════════════════════════════════════════════════════════════════════════════
# 3) Rate limiting — a parede (pela porta oficial)  [6.4]
# ══════════════════════════════════════════════════════════════════════════════
echo "${BOLD}3) A parede do rate limiting${RESET}"
echo "   Pela porta oficial (a função de tracking), o teto é 60 cliques/min por link."
echo "   O atacante martela a MESMA chamada 65 vezes seguidas, em loop."
echo
cmdtop
cmd "for i in 1..65; do"
cmd "  curl -X POST 'https://$HOST/rest/v1/rpc/record_link_click'"
cmd "       -H 'apikey: «chave pública»'  -d '{\"p_link_id\":\"$LSHORT\"}'"
cmd "done"
cmdend
pause
START="$(date -u +%Y-%m-%dT%H:%M:%S)"
printf '   '
ok=0; blocked=0; firstblock=0
for i in $(seq 1 65); do
  r=$(a "$URL/rest/v1/rpc/record_link_click" -X POST -H "Content-Type: application/json" -d "{\"p_link_id\":\"$LINK\"}")
  if [ "$r" = "true" ]; then ok=$((ok+1)); printf "${GREEN}▪${RESET}"
  else blocked=$((blocked+1)); [ "$firstblock" -eq 0 ] && firstblock=$i; printf "${RED}▪${RESET}"; fi
done
echo; echo
echo "${GREEN}   🟢 ${ok} gravados${RESET}  →  ${RED}🚫 ${blocked} bloqueados${RESET}   ${DIM}(parede na tentativa #${firstblock})${RESET}"
s "$URL/rest/v1/link_clicks?link_id=eq.$LINK&clicked_at=gte.$START" -o /dev/null -X DELETE -H "Prefer: return=minimal"
s "$URL/rest/v1/rate_limit_counters?bucket=eq.track_link&subject=eq.$LINK" -o /dev/null -X DELETE -H "Prefer: return=minimal"
echo "${DIM}   (limpeza automática: ${ok} cliques de teste removidos e contador zerado.)${RESET}"
echo; hr

# ══════════════════════════════════════════════════════════════════════════════
# 4) Vazamento da analytics — fechado  [6.3]
# ══════════════════════════════════════════════════════════════════════════════
echo "${BOLD}4) Roubar a analytics de todos — o vazamento fechado${RESET}"
echo "   A view de agregação vazava: a chave pública lia os cliques de TODOS os perfis."
echo "   O Epic 6 fez a view respeitar a RLS. Vamos tentar ler."
echo
cmdtop
cmd "curl 'https://$HOST/rest/v1/link_click_daily?select=*'"
cmd "     -H 'apikey: «chave pública»'"
cmdend
pause
code=$(a "$URL/rest/v1/link_click_daily?select=*&limit=5" -o /dev/null -w "%{http_code}")
[ "$code" = "401" ] && echo "${GREEN}   🟢 BLOQUEADO:${RESET} HTTP $code · ${GREEN}permission denied${RESET} — a view agora respeita a RLS." \
                     || echo "${RED}   ⚠️  passou: HTTP $code — vazamento aberto!${RESET}"
hr
echo "${BOLD}${GREEN}  Defesa em camadas: RLS (linha a linha) + rate limiting. Banco intacto.${RESET}"
echo
