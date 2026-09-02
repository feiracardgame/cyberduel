#!/usr/bin/env node

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");

function findFiles(directory, predicate) {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const fullPath = path.join(directory, entry.name);
      return entry.isDirectory()
        ? findFiles(fullPath, predicate)
        : predicate(fullPath)
          ? [fullPath]
          : [];
    })
    .sort();
}

function relative(file) {
  return path.relative(projectRoot, file);
}

function runNode(arguments_, label) {
  const result = spawnSync(process.execPath, arguments_, {
    cwd: projectRoot,
    stdio: "inherit",
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${label} falhou (código ${result.status ?? "desconhecido"}).`);
  }
}

function main() {
  const sourceDirectories = ["js", "server", "scripts"]
    .map((directory) => path.join(projectRoot, directory))
    .filter((directory) => fs.existsSync(directory));
  const sourceFiles = sourceDirectories.flatMap((directory) =>
    findFiles(directory, (file) => file.endsWith(".js")),
  );
  const testDirectory = path.join(projectRoot, "test");
  const testFiles = fs.existsSync(testDirectory)
    ? findFiles(testDirectory, (file) => file.endsWith(".test.js"))
    : [];

  if (testFiles.length === 0) {
    throw new Error("Nenhum arquivo *.test.js foi encontrado em test/.");
  }

  console.log(`\n[1/2] Verificando a sintaxe de ${sourceFiles.length} arquivos...`);
  for (const file of sourceFiles) runNode(["--check", file], relative(file));
  console.log("Sintaxe válida.");

  console.log(`\n[2/2] Executando ${testFiles.length} testes funcionais...`);
  for (const file of testFiles) {
    console.log(`\n→ ${relative(file)}`);
    runNode([file], relative(file));
  }

  console.log(`\n✓ Tudo certo: ${sourceFiles.length} arquivos verificados e ${testFiles.length} testes aprovados.`);
}

try {
  main();
} catch (error) {
  console.error(`\n✗ ${error.message}`);
  process.exitCode = 1;
}
