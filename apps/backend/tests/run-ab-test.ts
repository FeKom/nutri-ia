/**
 * Script de Teste A/B para comparar versões de prompts
 *
 * Como usar:
 * 1. PROMPT_VERSION=compact pnpm tsx tests/run-ab-test.ts
 * 2. PROMPT_VERSION=full pnpm tsx tests/run-ab-test.ts
 * 3. Comparar resultados salvos em tests/results/
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

interface TestScenario {
  id: string;
  name: string;
  description: string;
  messages: Array<{ role: string; content: string }>;
  expected_behaviors: string[];
}

interface TestResult {
  scenario_id: string;
  version: string;
  timestamp: string;
  response: string;
  tools_used: string[];
  token_count_estimate: number;
  behaviors_met: string[];
  behaviors_missed: string[];
  notes: string;
}

// Carrega cenários
const scenariosFile = join(process.cwd(), 'tests', 'ab-test-scenarios.json');
const scenarios: { scenarios: TestScenario[] } = JSON.parse(
  readFileSync(scenariosFile, 'utf-8')
);

// Versão sendo testada
const version = process.env.PROMPT_VERSION || 'compact';

console.log(`\n🧪 ===== TESTE A/B - Versão: ${version.toUpperCase()} =====\n`);

// Cria diretório de resultados se não existir
const resultsDir = join(process.cwd(), 'tests', 'results');
if (!existsSync(resultsDir)) {
  mkdirSync(resultsDir, { recursive: true });
}

async function runTest(scenario: TestScenario): Promise<TestResult> {
  console.log(`\n📋 Testando: ${scenario.name}`);
  console.log(`   ${scenario.description}\n`);

  // TODO: Aqui você faria uma requisição real ao endpoint /chat
  // Por enquanto, vamos criar um template de resultado manual

  const result: TestResult = {
    scenario_id: scenario.id,
    version,
    timestamp: new Date().toISOString(),
    response: '[PLACEHOLDER - Execute o cenário manualmente e preencha]',
    tools_used: [],
    token_count_estimate: 0,
    behaviors_met: [],
    behaviors_missed: scenario.expected_behaviors,
    notes: 'Teste manual necessário. Copie a mensagem abaixo e envie ao chat.',
  };

  console.log('   📤 Mensagens para testar:');
  scenario.messages.forEach((msg, i) => {
    console.log(`   ${i + 1}. ${msg.content}`);
  });

  console.log('\n   ✅ Comportamentos esperados:');
  scenario.expected_behaviors.forEach((behavior, i) => {
    console.log(`   ${i + 1}. ${behavior}`);
  });

  console.log('\n   ⏸️  [PAUSA] Execute este cenário manualmente e anote:\n');
  console.log('      - Quais tools foram usadas?');
  console.log('      - Quantos tokens aproximadamente?');
  console.log('      - Quais comportamentos foram seguidos?');
  console.log('      - Qualidade da resposta (1-5)?');

  return result;
}

async function main() {
  const results: TestResult[] = [];

  console.log('📝 Cenários disponíveis:');
  scenarios.scenarios.forEach((s, i) => {
    console.log(`   ${i + 1}. ${s.name} - ${s.description}`);
  });

  // Executa todos os cenários
  for (const scenario of scenarios.scenarios) {
    const result = await runTest(scenario);
    results.push(result);
  }

  // Salva resultados
  const outputFile = join(
    resultsDir,
    `ab-test-${version}-${Date.now()}.json`
  );

  writeFileSync(
    outputFile,
    JSON.stringify({ version, date: new Date().toISOString(), results }, null, 2)
  );

  console.log(`\n\n✅ Resultados salvos em: ${outputFile}`);
  console.log(`\n📊 Para comparar versões, execute:`);
  console.log(`   pnpm tsx tests/compare-results.ts\n`);
}

main().catch(console.error);
