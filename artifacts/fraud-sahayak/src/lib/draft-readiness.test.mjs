import test from 'node:test';
import assert from 'node:assert/strict';
import { canGenerateDraft, isDraftReady } from './draft-readiness.ts';

test('analysis and an old draft cannot make an incomplete case ready', () => {
  const detail = { missingFields: ['incidentDescription', 'bank'], analysis: {}, complaint: {} };
  assert.equal(canGenerateDraft(detail), false);
  assert.equal(isDraftReady(detail), false);
});

test('every required field must be present, including evidence confirmation', () => {
  for (const field of ['incidentDescription', 'incidentDate', 'reportedAmount', 'bank', 'complainantName', 'state', 'evidenceAmountConfirmation']) {
    const detail = { missingFields: [field], analysis: {}, complaint: {} };
    assert.equal(canGenerateDraft(detail), false, field);
    assert.equal(isDraftReady(detail), false, field);
  }
});

test('a complete intake without analysis cannot generate a draft', () => {
  assert.equal(canGenerateDraft({ missingFields: [], analysis: null }), false);
});

test('a complete analyzed case can generate a draft but is not ready without one', () => {
  const detail = { missingFields: [], analysis: {}, complaint: null };
  assert.equal(canGenerateDraft(detail), true);
  assert.equal(isDraftReady(detail), false);
});

test('only a complete analyzed case with a draft is ready', () => {
  assert.equal(isDraftReady({ missingFields: [], analysis: {}, complaint: {} }), true);
  assert.equal(isDraftReady(undefined), false);
});

test('a preserved draft that no longer matches the case is not ready', () => {
  assert.equal(isDraftReady({ missingFields: [], analysis: {}, complaint: {}, draftStale: true }), false);
});
