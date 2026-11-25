import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const escolaDir = path.join(rootDir, "escola");
const outDir = process.argv[2] ? path.resolve(rootDir, process.argv[2]) : escolaDir;

function formatFileName(name) {
  return name
    .replace(/\.html?$/i, "")
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function extractHtmlMeta(htmlPath, fallbackName) {
  if (!fs.existsSync(htmlPath)) {
    return {
      title: formatFileName(fallbackName),
      description: "Apresentação escolar",
    };
  }

  const html = fs.readFileSync(htmlPath, "utf8");
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const descMatch = html.match(
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i
  );

  return {
    title: titleMatch ? titleMatch[1].trim() : formatFileName(fallbackName),
    description: descMatch ? descMatch[1].trim() : "Apresentação escolar",
  };
}

function main() {
  if (!fs.existsSync(escolaDir)) {
    console.error("Pasta escola não encontrada.");
    process.exit(1);
  }

  const entries = fs.readdirSync(escolaDir, { withFileTypes: true });
  const presentations = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;

    if (entry.isFile() && /\.html?$/i.test(entry.name)) {
      if (entry.name.toLowerCase() === "index.html") continue;
      const htmlPath = path.join(escolaDir, entry.name);
      const meta = extractHtmlMeta(htmlPath, entry.name);
      presentations.push({
        title: meta.title,
        description: meta.description,
        href: `./${encodeURIComponent(entry.name)}`,
        tag: "Apresentação",
      });
    } else if (entry.isDirectory()) {
      const subIndexPath = path.join(escolaDir, entry.name, "index.html");
      if (!fs.existsSync(subIndexPath)) continue;
      const meta = extractHtmlMeta(subIndexPath, entry.name);
      presentations.push({
        title: meta.title,
        description: meta.description,
        href: `./${encodeURIComponent(entry.name)}/`,
        tag: "Apresentação",
      });
    }
  }

  presentations.sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));

  fs.mkdirSync(outDir, { recursive: true });
  const targetFile = path.join(outDir, "presentations.json");
  fs.writeFileSync(targetFile, JSON.stringify(presentations, null, 2) + "\n", "utf8");
  console.log(`Gerado ${targetFile} com ${presentations.length} apresentação(ões).`);
}

main();
