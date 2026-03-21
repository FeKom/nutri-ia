/**
 * Compara resultados de testes A/B entre versões compact e full
 *
 * Como usar:
 * pnpm tsx tests/compare-results.ts
 */

import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

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

interface TestRun {
  version: string;
  date: string;
  results: TestResult[];
}

const resultsDir = join(process.cwd(), 'tests', 'results');

function loadResults(): { compact: TestRun | null; full: TestRun | null } {
  const files = readdirSync(resultsDir).filter((f) => f.endsWith('.json'));

  let compactResults: TestRun | null = null;
  let fullResults: TestRun | null = null;

  // Pega os mais recentes de cada versão
  for (const file of files.reverse()) {
    const content = JSON.parse(readFileSync(join(resultsDir, file), 'utf-8'));

    if (content.version === 'compact' && !compactResults) {
      compactResults = content;
    } else if (content.version === 'full' && !fullResults) {
      fullResults = content;
    }

    if (compactResults && fullResults) break;
  }

  return { compact: compactResults, full: fullResults };
}

function calculateMetrics(results: TestResult[]) {
  const totalBehaviors = results.reduce(
    (sum, r) => sum + r.behaviors_met.length + r.behaviors_missed.length,
    0
  );
  const metBehaviors = results.reduce((sum, r) => sum + r.behaviors_met.length, 0);
  const totalTokens = results.reduce((sum, r) => sum + r.token_count_estimate, 0);

  return {
    behavior_compliance: totalBehaviors > 0 ? (metBehaviors / totalBehaviors) * 100 : 0,
    avg_tokens: totalTokens / results.length,
    total_tests: results.length,
  };
}

function main() {
  const { compact, full } = loadResults();

  console.log('\n📊 ===== COMPARAÇÃO A/B: COMPACT vs FULL =====\n');

  if (!compact) {
    console.log('⚠️  Nenhum resultado COMPACT encontrado');
    console.log('   Execute: PROMPT_VERSION=compact pnpm tsx tests/run-ab-test.ts\n');
  }

  if (!full) {
    console.log('⚠️  Nenhum resultado FULL encontrado');
    console.log('   Execute: PROMPT_VERSION=full pnpm tsx tests/run-ab-test.ts\n');
  }

  if (!compact || !full) {
    console.log('❌ Não foi possível comparar. Execute ambas as versões primeiro.\n');
    return;
  }

  const compactMetrics = calculateMetrics(compact.results);
  const fullMetrics = calculateMetrics(full.results);

  console.log('┌─────────────────────────────────────────────────────────┐');
  console.log('│                    VERSÃO COMPACT                       │');
  console.log('├─────────────────────────────────────────────────────────┤');
  console.log(`│ Data: ${compact.date.substring(0, 19).padEnd(47)}│`);
  console.log(`│ Testes executados: ${compactMetrics.total_tests.toString().padEnd(40)}│`);
  console.log(
    `│ Comportamentos seguidos: ${compactMetrics.behavior_compliance.toFixed(1)}%`.padEnd(58) +
      '│'
  );
  console.log(
    `│ Média de tokens: ${compactMetrics.avg_tokens.toFixed(0)}`.padEnd(58) + '│'
  );
  console.log('└─────────────────────────────────────────────────────────┘');

  console.log('\n┌─────────────────────────────────────────────────────────┐');
  console.log('│                     VERSÃO FULL                         │');
  console.log('├─────────────────────────────────────────────────────────┤');
  console.log(`│ Data: ${full.date.substring(0, 19).padEnd(47)}│`);
  console.log(`│ Testes executados: ${fullMetrics.total_tests.toString().padEnd(40)}│`);
  console.log(
    `│ Comportamentos seguidos: ${fullMetrics.behavior_compliance.toFixed(1)}%`.padEnd(58) +
      '│'
  );
  console.log(`│ Média de tokens: ${fullMetrics.avg_tokens.toFixed(0)}`.padEnd(58) + '│');
  console.log('└─────────────────────────────────────────────────────────┘');

  console.log('\n┌─────────────────────────────────────────────────────────┐');
  console.log('│                        DELTA                            │');
  console.log('├─────────────────────────────────────────────────────────┤');

  const behaviorDelta = compactMetrics.behavior_compliance - fullMetrics.behavior_compliance;
  const tokenDelta = compactMetrics.avg_tokens - fullMetrics.avg_tokens;
  const tokenSavings = fullMetrics.avg_tokens > 0
    ? ((tokenDelta / fullMetrics.avg_tokens) * -100).toFixed(1)
    : '0';

  console.log(
    `│ Diferença de comportamento: ${behaviorDelta >= 0 ? '+' : ''}${behaviorDelta.toFixed(1)}%`.padEnd(
      58
    ) + '│'
  );
  console.log(
    `│ Diferença de tokens: ${tokenDelta >= 0 ? '+' : ''}${tokenDelta.toFixed(0)}`.padEnd(58) +
      '│'
  );
  console.log(`│ Economia de tokens: ${tokenSavings}%`.padEnd(58) + '│');
  console.log('└─────────────────────────────────────────────────────────┘');

  console.log('\n🎯 CONCLUSÃO:\n');

  if (Math.abs(behaviorDelta) <= 5) {
    console.log('   ✅ Versão COMPACT mantém mesma eficiência (~' + behaviorDelta.toFixed(1) + '% diff)');
  } else if (behaviorDelta > 0) {
    console.log('   🎉 Versão COMPACT é MELHOR (+' + behaviorDelta.toFixed(1) + '%)');
  } else {
    console.log(
      '   ⚠️  Versão COMPACT perdeu eficiência (' + behaviorDelta.toFixed(1) + '%)'
    );
  }

  console.log(`   💰 Economia: ${tokenSavings}% menos tokens\n`);

  // Detalhamento por cenário
  console.log('\n📋 DETALHAMENTO POR CENÁRIO:\n');

  compact.results.forEach((compactResult, i) => {
    const fullResult = full.results.find((r) => r.scenario_id === compactResult.scenario_id);
    if (!fullResult) return;

    const compactCompliance =
      (compactResult.behaviors_met.length /
        (compactResult.behaviors_met.length + compactResult.behaviors_missed.length)) *
      100;
    const fullCompliance =
      (fullResult.behaviors_met.length /
        (fullResult.behaviors_met.length + fullResult.behaviors_missed.length)) *
      100;

    console.log(`${i + 1}. ${compactResult.scenario_id}`);
    console.log(`   Compact: ${compactCompliance.toFixed(0)}% | Full: ${fullCompliance.toFixed(0)}%`);
    console.log(
      `   Tokens: ${compactResult.token_count_estimate} vs ${fullResult.token_count_estimate}`
    );
    console.log('');
  });

  console.log('\n');
}

main();
