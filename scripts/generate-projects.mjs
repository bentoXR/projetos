import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const frontEndDir = path.join(rootDir, "front-end");
const outDir = process.argv[2] ? path.resolve(rootDir, process.argv[2]) : rootDir;

const OVERRIDES = {
  dutx: {
    title: "dutX",
    description: "Aplicativo de produtividade e gerenciamento de tarefas (Task Tracker).",
    tag: "React · Vite · TS",
  },
  "agente-prompt": {
    title: "Agente Prompt",
    description: "Super Prompt — Gerador de prompts com inteligência artificial.",
    tag: "HTML · CSS · JS",
  },
  "curso-de-ia": {
    title: "Curso de IA",
    description: 'Página de apresentação "Inteligência Artificial na Prática".',
    tag: "HTML · CSS · JS",
  },
  gredes: {
    title: "Gredes (LIFTO)",
    description: "Home page institucional LIFTO / Gredes.",
    tag: "HTML · CSS",
  },
  "jogo-sonic": {
    title: "Jogo Sonic",
    description: "Mini jogo estilo runner direto no navegador.",
    tag: "HTML · CSS · JS",
  },
  "projeto-001": {
    title: "Projeto 001 — OneBit",
    description: "Landing page multi-páginas com clientes e contato.",
    tag: "HTML · CSS",
  },
  "projeto-002": {
    title: "Projeto 002 — Site Mercado",
    description: "Site informativo sobre mercados, alimentação e dicas.",
    tag: "HTML · CSS",
  },
};

function formatFolderName(name) {
  return name
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function extractHtmlMeta(dirPath) {
  const htmlPath = path.join(dirPath, "index.html");
  if (!fs.existsSync(htmlPath)) return {};
  const html = fs.readFileSync(htmlPath, "utf8");
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const descMatch = html.match(
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i
  );
  return {
    title: titleMatch ? titleMatch[1].trim() : undefined,
    description: descMatch ? descMatch[1].trim() : undefined,
  };
}

function detectTag(dirPath, pkg) {
  if (pkg) {
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const tags = [];
    if (deps.react) tags.push("React");
    if (deps.vue) tags.push("Vue");
    if (deps.vite) tags.push("Vite");
    if (deps.typescript || fs.existsSync(path.join(dirPath, "tsconfig.json"))) {
      tags.push("TS");
    }
    if (tags.length > 0) return tags.join(" · ");
  }

  const files = fs.readdirSync(dirPath, { recursive: true }).map(String);
  const hasJs = files.some((f) => f.endsWith(".js") || f.endsWith(".mjs"));
  return hasJs ? "HTML · CSS · JS" : "HTML · CSS";
}

function main() {
  if (!fs.existsSync(frontEndDir)) {
    console.error("Pasta front-end não encontrada.");
    process.exit(1);
  }

  const entries = fs
    .readdirSync(frontEndDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .sort((a, b) => a.name.localeCompare(b.name));

  const projects = entries.map((entry) => {
    const slug = entry.name;
    const dirPath = path.join(frontEndDir, slug);
    const override = OVERRIDES[slug] || {};
    const pkg = readJsonIfExists(path.join(dirPath, "package.json"));
    const htmlMeta = extractHtmlMeta(dirPath);

    return {
      slug,
      href: `./front-end/${slug}/`,
      title: override.title || htmlMeta.title || formatFolderName(slug),
      description:
        override.description ||
        htmlMeta.description ||
        pkg?.description ||
        `Projeto front-end (${slug}).`,
      tag: override.tag || detectTag(dirPath, pkg),
    };
  });

  fs.mkdirSync(outDir, { recursive: true });
  const targetFile = path.join(outDir, "projects.json");
  fs.writeFileSync(targetFile, JSON.stringify(projects, null, 2) + "\n", "utf8");
  console.log(`Gerado ${targetFile} com ${projects.length} projeto(s).`);
}

main();
