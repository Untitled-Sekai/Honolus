const assert = require('node:assert/strict');
const test = require('node:test');
const { MemoryJobQueue, PostgresExecutor, createSonolusDatabase } = require('../dist');

test('PostgresExecutor commits, rolls back, and releases pooled clients', async () => {
    const calls = [];
    let releases = 0;
    const client = { query: async (sql) => { calls.push(sql); return { rows: [] }; }, release: () => releases++ };
    const executor = new PostgresExecutor({ pool: { query: client.query, connect: async () => client, end: async () => {} }, statementTimeoutMs: 1000 });
    await executor.transaction(async (tx) => { await tx.query('SELECT 1'); });
    assert.deepEqual(calls.slice(0, 4), ['BEGIN', 'SET LOCAL statement_timeout = 1000', 'SELECT 1', 'COMMIT']);
    await assert.rejects(() => executor.transaction(async () => { throw new Error('boom'); }), /boom/);
    assert.equal(calls.at(-1), 'ROLLBACK');
    assert.equal(releases, 2);
});

test('memory queue retries failures and moves exhausted jobs to dead state', async () => {
    const queue = new MemoryJobQueue();
    queue.register('retry', async () => { throw new Error('retry me'); });
    const { id } = await queue.enqueue('retry', {}, { maxAttempts: 2 });
    await new Promise((resolve) => setTimeout(resolve, 300));
    const job = await queue.get(id);
    assert.equal(job.state, 'dead');
    assert.equal(job.attempt, 2);
    await queue.close();
});

test('list can skip total count for cursor-only consumers', async () => {
    const database = createSonolusDatabase({ driver: 'memory' });
    const result = await database.repository('level').list({ includeTotalCount: false });
    assert.equal('totalCount' in result, false);
});
