import { LibSQLStore } from '@mastra/libsql';

/**
 * Instância única de storage compartilhada por todo o Mastra
 * Usa file-based para persistência entre reinicializações
 */
export const sharedStorage = new LibSQLStore({
  id: 'mastra-shared-storage',
  url: process.env.MASTRA_STORAGE_URL || 'file:./mastra-data.db',
});