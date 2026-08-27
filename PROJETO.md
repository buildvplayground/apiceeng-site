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
- [x] 5. Front-end — `Site/` (HTML + CSS + JS vanilla)
- [x] 6. Ajustes finais — imagens 71,7 MB → 1,6 MB (−97,8 %); overflow 0 de 320 a 1920 px
- [x] 7. Módulos LGPD (cookies + Política + Fornecedores + backend PHP). Tags: puladas, sem IDs
- [ ] 8. **Revisão humana** ← *aqui*
- [ ] 9. Deploy — bloqueado por hospedagem/domínio/secrets

## Preview local

```bash
node preview-server.js     # http://localhost:4173
node audit.js              # auditoria: overflow, menu, lightbox, contraste, a11y
```

## Resultado da auditoria (27/08/2026)

- Overflow horizontal: **0** em 320, 360, 375, 414, 768, 1024, 1280, 1440 e 1920 px, nas 3 páginas
- Grade do portfólio: 3 / 2 / 1 colunas — conforme requisito BuildV
- Menu hambúrguer, lightbox (setas + Esc + retorno de foco) e banner de cookies: funcionando
- Contraste medido: todos os pares passam AA; a maioria AAA
- `prefers-reduced-motion`: revelações e smooth scroll desligados
- Erros de JS/console/rede: **nenhum**
- CTA = botão de WhatsApp em 5 pontos; **zero formulários na home**

## Inventário do material

| Origem | Conteúdo |
|---|---|
| `ID VISUAL.rar` (475 MB) | Manual da marca (PDF), fontes Caviar Dreams + Neoteric Bold (DEMO), logos PNG/JPG/EPS, patterns, papelaria |
| `fotos obras - portifólio` (582 MB) | 147 fotos — Ambev CDD Santa Cruz do Sul e Pelotas, Sicredi, obras industriais, renders |
| `APICE` (166 MB) | 88 fotos de documentação de obra (pavimentação, plataformas, fossas) |
| `Aprofundamento.xlsx` | **Template em branco** — sem briefing preenchido |
| `Leads Pré Qualificação.xlsx` | Template operacional, sem dados do cliente |
| Vídeos (374 MB) | Não baixados (CDD Ambev, Visita Ambev) |
| FOTOS AMBEV PELOTAS / SANTA CRUZ (1,7 GB) | Não baixados — redundantes com o portfólio |
