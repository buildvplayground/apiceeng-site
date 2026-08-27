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
- [x] 5. Front-end — `Site/` (HTML + CSS + JS vanilla), 12 obras, 2 faixas com parallax
- [x] 6. Ajustes finais — imagens 96 MB → 2,8 MB; 4 auditorias automatizadas passando
- [x] 7. Módulos LGPD (cookies + Política + Fornecedores + backend PHP). Tags: puladas, sem IDs
- [ ] 8. **Revisão humana** ← *aqui*
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
- Portfólio em grade 3 / 2 / 1 com lightbox (setas, Esc, retorno de foco) — 12 obras
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

**Movimento**
- Entradas por `data-anim` (`up`, `left`, `mask`, `clip`), cascata calculada no lote que entra
- Parallax no hero e nas faixas, header que encolhe, barra de progresso de leitura
- **Não anima** para quem rola rápido, sobe, salta de âncora ou já está no fim da página
- `prefers-reduced-motion` desliga tudo; sem JavaScript o site aparece inteiro
