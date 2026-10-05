# Ápice Arquitetura e Engenharia — Site

- **Cliente:** Ápice Serviços de Engenharia (marca: *Ápice Arquitetura e Engenharia*)
- **Slug:** `apiceeng`
- **Repo:** `dev-buildv/apiceeng-site` (privado)
- **Drive:** https://drive.google.com/drive/folders/1olCAkmYKoTa6e4lr3c4EUFqQIxXBnE3M
- **Hospedagem:** *a definir* (pendência)
- **Copy:** **PROVISÓRIA** — briefing do Drive veio em branco (planilha template não preenchida)

## Etapas

- [x] 1. Extrair do Drive
- [x] 2. Organizar pastas
- [x] 2b. Repositório GitHub — `dev-buildv/apiceeng-site`
- [x] 3. Design system — `design-system/tokens.md`
- [x] 4. Copy **provisória** (Ramo B) — `Copys/copy-provisoria.md`
- [x] 5. Front-end: `Site/` (HTML + CSS + JS vanilla), 6 obras em carrossel, 2 faixas com parallax
- [x] 6. Ajustes finais: imagens 96 MB para 3,0 MB; 4 auditorias automatizadas passando
- [x] 7. Módulos LGPD (cookies + Política + Fornecedores + backend PHP). Tags: puladas, sem IDs
- [ ] 8. **Revisão humana** ← *aqui* (1ª rodada de ajustes do cliente aplicada em 05/10/2026, ver abaixo)
- [ ] 9. Deploy — bloqueado por hospedagem/domínio/secrets

## Preview local e verificação

```bash
node preview-server.js          # http://localhost:4173
node audit.js                   # requisitos BuildV, responsividade, a11y estrutural
node audit-motion.js            # sistema de movimento e as guardas de "quando não animar"
node audit-wcag.js              # axe-core + alvos de toque, zoom, 1.4.12, teclado, tipografia
node audit-contraste-foto.js    # contraste de texto sobre fotografia
```

## Resultado das auditorias (27/08/2026) — as quatro passam sem falhas

**Requisitos BuildV**
- Portfólio em **carrossel** (exceção à grade, pedido do cliente) — 6 obras, 2 inteiras + a próxima pela borda
  no desktop, com o **avanço preso à rolagem** (palco travado) em tela grande com mouse;
  card = obra com o serviço, "N fotos" e lightbox por obra (setas, Esc, contador, retorno de foco)
- Hero com foto real; CTA sempre botão de WhatsApp em 5 pontos; **zero formulários na home**
- `index.html` na raiz; logo em 2 versões; smooth scroll

**Responsividade**
- Rolagem horizontal **zero** em 320, 360, 375, 414, 768, 1024, 1280, 1440 e 1920px, nas 3 páginas
- Também com zoom de **200% e 400%**, e com o texto a 200%

**Acessibilidade**
- **axe-core (WCAG 2.0/2.1/2.2 A+AA + best-practice): nenhuma violação nas 3 páginas**
- Todo alvo de toque com 24x24px (2.5.8); todo focável com anel de foco; skip link no 1º Tab
- Sobrevive ao espaçamento forçado do 1.4.12
- Contraste: todos os pares em AA, a maioria AAA — inclusive **texto sobre fotografia**,
  medido pelo pior pixel do fundo real (o axe não avalia isso)

**Tipografia**
- Nenhuma linha acima de 82 caracteres, nenhuma coluna abaixo de 26, **nenhuma palavra órfã**
  na última linha — em desktop, tablet e celular

**Movimento** (segue `skills/gerar-frontend/sistema-de-movimento.md`)
- Gestos por `data-anim`: `up`, `left`, `soft`, `fig`, `mask`, `curtain`
- **Títulos divididos palavra por palavra**, subindo de dentro de uma máscara (42ms entre elas)
- **A animação começa e termina na tela**: o motor mede o tempo de viewport restante e
  encurta a duração, ou revela pronto se não couber
- Scroll suave por lerp na roda do mouse, que cede a scroll externo e não sequestra
  área rolável nem overlay aberto
- Parallax de 0,10 a 0,12, header que encolhe, barra de leitura
- **Não anima** para quem rola rápido, sobe, salta de âncora ou já está no fim da página
- `prefers-reduced-motion` desliga tudo; sem JavaScript o site aparece inteiro

## Ajustes do cliente — 05/10/2026 (branch `ajuste/2026-10-05-apice-fotos-carrossel`)

| # | Pedido | O que mudou |
|---|---|---|
| 1 | Trocar a foto de "Execução com equipe própria" | `faixa-equipe-v2.webp`: equipe com uniforme ÁPICE concretando pavimento industrial (telefones do caminhão desfocados) |
| 2 | Obras em carrossel, projetos em sequência | `#obrasCarrossel`: 6 obras maiores (2,4 por vista no desktop), avanço preso à rolagem do mouse em tela grande (a seção trava e a roda passa as obras), arrastar e setas no toque; sem autoplay; cada obra abre a galeria dela, do projeto à entrega |
| 3 | Foto em concordância com o serviço do card | Tag do card = um dos 6 serviços; saíram render da Sicredi, residência, "contenção" e "piso" que a foto não comprovava |
| 4 | Hero com janela estourada | `hero-v2.webp`: área de convivência com sinuca, pendentes e lounge (Ambev Santa Cruz), no mesmo espírito da antiga e sem janela; véu da hero aliviado na base à direita |

- Eyebrows sem o filete (traço) à esquerda, nas 3 páginas (pedido do cliente).
- Também: `sobre-v2.webp` recortada sem o céu estourado; rótulo da faixa de projeto virou "Projeto arquitetônico em 3D"; alts revistos.
- Motor de movimento: Espaço num botão volta a ser clique (WCAG 2.1.1) e a roda vertical sobre o trilho segue no lerp.
- Cache: imagens novas com sufixo `-v2`/pasta `portfolio/`; CSS/JS com `?v=20261005`.
- **Exceção ao requisito "grade 3/2/1"** registrada no vault (`40-Sessoes-e-Decisoes/2026-10-05 Apice — ajustes do cliente ...`).
- Origem de cada foto e catálogo das 235 originais: `_raw/ajustes-2026-10-05/` (local). Geração reproduzível: `_raw/ajustes-2026-10-05/gen_images.py` (recortes e webp) e `gen_obras.py` (HTML do carrossel).

**Checklist adversarial (4 lentes + verificação de cada achado)** — corrigido nesta branch:
- Palco travado só liga quando cabe na janela (janela baixa, zoom, texto 200% caem no carrossel comum).
- Controles do carrossel acima das obras (o banner de cookies e o botão do WhatsApp os cobriam).
- Foco por mouse não rola mais a página (cliques se perdiam); Tab traz a obra para a vista nos dois modos.
- Estado "Obras X a Y" atualizado a cada quadro; anúncio ao leitor de tela separado e só quando assenta.
- Lightbox anuncia a troca de foto, nomeia o diálogo com a obra e não corta o topo da foto com zoom 400%.
- Âncora "Obras" para no topo do palco travado; Shift+roda conta como gesto lateral.
- Auditorias novas para tudo isso (palco em 6 combinações de janela/fonte, banner de cookies, clique de
  mouse sem salto, Tab no celular, estado durante a rolagem, anúncio do lightbox, dims das galerias).

**Bugs anteriores à branch corrigidos (commit separado, achados pelo mesmo checklist)**
- Foto do Sobre e citações das faixas (data-anim mask/curtain) só apareciam saindo da tela: um alvo
  100% recortado por clip-path nunca intersecta para o IntersectionObserver.
- Menu do celular: o toque no link caía no véu escuro e só fechava o menu; com a página rolada, o
  backdrop-filter do header prendia o painel na altura do header (os links sumiam).
- Teste de cascata do audit-motion era intermitente (~1 em 10): rolagem calma no teste.

**Pendências do cliente desta rodada**
- Originais em alta (não WhatsApp) das fotos de equipe e das obras industriais; a faixa está em 1280 px.
- Autorização da Ambev para letreiros e marcas; nome da unidade de Santa Cruz (CDD ou Cervejaria).
- Sicredi: não há foto de obra Sicredi executada, mas a hero cita "Obras entregues para … Sicredi".
- Infraestrutura/terraplenagem e gestão de obra seguem sem obra no portfólio (faltam fotos).
