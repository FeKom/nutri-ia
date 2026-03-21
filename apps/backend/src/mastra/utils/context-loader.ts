import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';

/**
 * Context Loader - Carrega instruções de arquivos markdown
 * Reduz o uso de tokens ao externalizar prompts grandes
 */

export interface PromptFile {
  name: string;
  path: string;
}

/**
 * Encontra o diretório raiz do projeto procurando por package.json
 */
function findProjectRoot(): string {
  let currentDir = process.cwd();

  // Se estamos em .mastra/output, volta para o projeto root
  if (currentDir.includes('.mastra/output')) {
    const parts = currentDir.split('.mastra/output');
    return parts[0];
  }

  // Procura por package.json subindo na hierarquia
  while (currentDir !== '/') {
    if (existsSync(join(currentDir, 'package.json'))) {
      return currentDir;
    }
    currentDir = dirname(currentDir);
  }

  // Fallback para process.cwd()
  return process.cwd();
}

/**
 * Carrega um arquivo de prompt markdown
 * @param agentName - Nome do agente (ex: 'nutrition-analyst')
 * @param fileName - Nome do arquivo sem extensão (ex: 'instructions')
 * @returns Conteúdo do arquivo como string
 */
export function loadPrompt(agentName: string, fileName: string): string {
  try {
    const projectRoot = findProjectRoot();
    const promptPath = join(projectRoot, 'src', 'mastra', 'prompts', agentName, `${fileName}.md`);

    if (!existsSync(promptPath)) {
      throw new Error(`Arquivo não encontrado: ${promptPath}`);
    }

    return readFileSync(promptPath, 'utf-8');
  } catch (error) {
    console.error(`❌ Erro ao carregar prompt ${agentName}/${fileName}:`, error);
    throw new Error(`Falha ao carregar prompt: ${agentName}/${fileName}`);
  }
}

/**
 * Carrega múltiplos arquivos de prompt e concatena
 * @param agentName - Nome do agente
 * @param fileNames - Array de nomes de arquivos
 * @returns Conteúdo concatenado
 */
export function loadPrompts(agentName: string, fileNames: string[]): string {
  return fileNames
    .map(fileName => loadPrompt(agentName, fileName))
    .join('\n\n');
}

/**
 * Carrega todas as instruções do nutrition-analyst
 * Versão controlada por variável de ambiente para testes A/B:
 * - PROMPT_VERSION=compact (padrão): ~250 tokens
 * - PROMPT_VERSION=full: ~2000 tokens
 */
export function loadNutritionAnalystInstructions(): string {
  const version = process.env.PROMPT_VERSION || 'compact';

  if (version === 'full') {
    console.log('📝 [Prompts] Usando versão FULL (base + tools + examples)');
    return loadPrompts('nutrition-analyst', ['base', 'tools', 'examples']);
  }

  console.log('📝 [Prompts] Usando versão COMPACT (base-compact)');
  return loadPrompt('nutrition-analyst', 'base-compact');
}
