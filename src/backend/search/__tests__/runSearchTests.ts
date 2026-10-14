import { runTests } from './searchEngine.test';

const success = runTests();
if (!success) {
  process.exit(1);
} else {
  process.exit(0);
}
