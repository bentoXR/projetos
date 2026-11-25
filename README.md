# Projetos — bentoXR

Repositório unificado para hospedar e organizar projetos front-end e páginas estáticas no **GitHub Pages** em um único lugar.

🌐 **Vitrine principal:** https://bentoxr.github.io/projetos/

---

## 📁 Estrutura

```text
projetos/
├── index.html                  # Vitrine com links para todos os projetos
├── README.md
├── .github/workflows/pages.yml # Build automático (DutX) + deploy no GitHub Pages
└── front-end/
    ├── agente-prompt/          # Super Prompt — Gerador de Prompts com IA
    ├── curso-de-ia/            # Inteligência Artificial na Prática
    ├── dutx/                   # dutX — Task Tracker (React + Vite + TypeScript)
    ├── gredes/                 # Home Page LIFTO / Gredes
    ├── jogo-sonic/             # Jogo estilo runner (HTML/CSS/JS)
    ├── projeto-001/            # OneBit — Landing Page
    └── projeto-002/            # Site Mercado — Alimentação e Dicas
```

---

## 🚀 Projetos Publicados

| Projeto | Descrição | Tipo | Link ao vivo |
| :--- | :--- | :--- | :--- |
| **Agente Prompt** | Gerador de prompts com IA | HTML / CSS / JS | [Abrir](https://bentoxr.github.io/projetos/front-end/agente-prompt/) |
| **Curso de IA** | Página *Inteligência Artificial na Prática* | HTML / CSS / JS | [Abrir](https://bentoxr.github.io/projetos/front-end/curso-de-ia/) |
| **dutX** | App de produtividade e tarefas (*Task Tracker*) | React + Vite + TS | [Abrir](https://bentoxr.github.io/projetos/front-end/dutx/) |
| **Gredes (LIFTO)** | Home page LIFTO | HTML / CSS | [Abrir](https://bentoxr.github.io/projetos/front-end/gredes/) |
| **Jogo Sonic** | Mini jogo runner no navegador | HTML / CSS / JS | [Abrir](https://bentoxr.github.io/projetos/front-end/jogo-sonic/) |
| **Projeto 001 (OneBit)** | Landing page institucional | HTML / CSS | [Abrir](https://bentoxr.github.io/projetos/front-end/projeto-001/) |
| **Projeto 002 (Site Mercado)** | Site multi-páginas sobre mercados e alimentação | HTML / CSS | [Abrir](https://bentoxr.github.io/projetos/front-end/projeto-002/) |

---

## ⚙️ Como funciona o deploy

A cada `push` na branch `main`, o workflow [`.github/workflows/pages.yml`](.github/workflows/pages.yml):
1. Compila o projeto React/Vite em `front-end/dutx/`.
2. Copia o `index.html` raiz, todos os sites estáticos de `front-end/` e o `dist/` compilado do `dutx`.
3. Publica tudo automaticamente no **GitHub Pages**.
