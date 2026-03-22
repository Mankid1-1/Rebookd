// Uses native fetch (Node 18+)

const API_BASE = process.env.E2E_API_URL || 'http://localhost:3000/api/trpc';

async function run() {
  console.log('E2E smoke test starting...');

  try {
    const planRes = await fetch(`${API_BASE}/plans.list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: null }),
      // Add timeout to prevent hanging
      signal: AbortSignal.timeout(5000),
    });

    if (!planRes.ok) {
      throw new Error(`plans.list returned ${planRes.status}`);
    }

    const data = await planRes.json();
    console.log('plans.list response:', data);

    if (!data?.result?.data || !Array.isArray(data.result.data)) {
      throw new Error('Unexpected plans.list shape');
    }

    if (data.result.data.length === 0) {
      console.warn('Warning: plans list is empty');
    }

    console.log('E2E smoke test finished successfully.');
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('E2E smoke test failed: Request timeout - server may not be running');
    } else if (error instanceof Error && error.cause?.code === 'ECONNREFUSED') {
      console.error('E2E smoke test failed: Server not running - start the server first');
    } else {
      console.error('E2E smoke test failed:', error);
    }
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('E2E smoke test failed:', err);
  process.exit(1);
});
