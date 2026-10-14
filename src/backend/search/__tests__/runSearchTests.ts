import { runTests } from './searchEngine.test';

async function main() {
  const success = await runTests();
  if (!success) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});

