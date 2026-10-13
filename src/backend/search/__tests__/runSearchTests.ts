import { runAllTests } from './searchEngine.test';

const { passed, failed, errors } = runAllTests();

if (failed > 0) {
  console.error(`\nTest suite finished with ${failed} failures.`);
  process.exit(1);
} else {
  console.log(`\nAll ${passed} Phase 1, 2, 3 & 4 search engine tests passed successfully!`);
  process.exit(0);
}
