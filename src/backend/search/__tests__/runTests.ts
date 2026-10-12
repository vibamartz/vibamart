import dotenv from 'dotenv';
dotenv.config();

// Ensure fallback projectId for pure node test execution
if (!process.env.FIREBASE_PROJECT_ID && !process.env.FIREBASE_CONFIG) {
  process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: 'viba-mart-test' });
}

import { runSearchEngineTests } from './searchEngine.test';

const result = runSearchEngineTests();
if (result.failed > 0) {
  console.error(`Tests failed: ${result.failed}`);
  process.exit(1);
} else {
  console.log('All search engine tests passed successfully!');
  process.exit(0);
}
