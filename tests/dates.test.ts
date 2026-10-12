import { describe, expect, it } from 'vitest';
import {
  describe as describeDate, inputTypeFor, nowValue, parseDate, parseDateTime, parseTime,
  stepFor, toAcfDate, toAcfDateTime, toAcfTime, toWpDateTime,
} from '../src/lib/dates';

describe('parseDate', () => {
  it.each([
    ['2026-05-21', '2026-05-21'],
    ['20260521', '2026-05-21'], // ACF date_picker storage
    ['2026-05-21 10:00:00', '2026-05-21'],
    ['2026-05-21T10:00', '2026-05-21'],
    ['2024-02-29', '2024-02-29'],
  ])('%s → %s', (input, expected) => expect(parseDate(input)).toBe(expected));

  it('returns empty string for empty values', () => {
    expect(parseDate('')).toBe('');
    expect(parseDate(null)).toBe('');
    expect(parseDate(undefined)).toBe('');
  });

  it.each(['21 Травня, 2026', '2026-02-30', '2025-02-29', '2026-13-01', 'tomorrow', '2026-5-1'])(
    'rejects %s',
    (input) => expect(parseDate(input)).toBeNull(),
  );
});

describe('parseDateTime', () => {
  it.each([
    ['2026-05-21 10:30:00', '2026-05-21T10:30'], // ACF date_time_picker storage
    ['2026-05-21T10:30:00', '2026-05-21T10:30'], // WP REST
    ['2026-05-21T10:30', '2026-05-21T10:30'],
    ['2026-05-21T10:30:15', '2026-05-21T10:30:15'], // keeps non-zero seconds
    ['2026-05-21', '2026-05-21T00:00'],
    ['20260521', '2026-05-21T00:00'],
    ['2026-05-21T10:30:00Z', '2026-05-21T10:30'],
    ['2026-05-21T10:30:00+03:00', '2026-05-21T10:30'],
  ])('%s → %s', (input, expected) => expect(parseDateTime(input)).toBe(expected));

  it.each(['2026-05-21T24:00', '2026-05-21 10:61', 'May 21 2026'])('rejects %s', (input) =>
    expect(parseDateTime(input)).toBeNull(),
  );
});

describe('parseTime', () => {
  it.each([
    ['10:30', '10:30'],
    ['10:30:00', '10:30'],
    ['23:59:59', '23:59:59'],
  ])('%s → %s', (input, expected) => expect(parseTime(input)).toBe(expected));

  it.each(['24:00', '9:30', '10:30 pm'])('rejects %s', (input) => expect(parseTime(input)).toBeNull());
});

describe('storage converters', () => {
  it('ACF date_picker stores Ymd', () => expect(toAcfDate('2026-05-21')).toBe('20260521'));
  it('ACF date_time_picker stores Y-m-d H:i:s', () => {
    expect(toAcfDateTime('2026-05-21T10:30')).toBe('2026-05-21 10:30:00');
    expect(toAcfDateTime('2026-05-21T10:30:15')).toBe('2026-05-21 10:30:15');
  });
  it('ACF time_picker stores H:i:s', () => expect(toAcfTime('09:05')).toBe('09:05:00'));
  it('WP REST datetime always has seconds', () => expect(toWpDateTime('2026-05-21T10:30')).toBe('2026-05-21T10:30:00'));
  it('round-trips through parse', () => {
    expect(parseDate(toAcfDate('2026-05-21'))).toBe('2026-05-21');
    expect(parseDateTime(toAcfDateTime('2026-05-21T10:30'))).toBe('2026-05-21T10:30');
  });
});

describe('picker helpers', () => {
  const fixed = new Date(2026, 4, 21, 9, 7, 45);
  it('nowValue uses local wall-clock time without seconds', () => {
    expect(nowValue('date', fixed)).toBe('2026-05-21');
    expect(nowValue('datetime', fixed)).toBe('2026-05-21T09:07');
    expect(nowValue('time', fixed)).toBe('09:07');
  });
  it('maps kinds to native input types', () => {
    expect(inputTypeFor('date')).toBe('date');
    expect(inputTypeFor('datetime')).toBe('datetime-local');
    expect(inputTypeFor('time')).toBe('time');
  });
  it('enables seconds only when the value has them', () => {
    expect(stepFor('datetime', '2026-05-21T10:30')).toBeNull();
    expect(stepFor('datetime', '2026-05-21T10:30:15')).toBe('1');
    expect(stepFor('time', '10:30:15')).toBe('1');
    expect(stepFor('date', '2026-05-21')).toBeNull();
  });
  it('describes a date with weekday for a sanity check', () => {
    // ICU punctuation differs between Node versions — check the parts.
    expect(describeDate('date', '2026-05-21', 'en-GB')).toMatch(/^Thursday,? 21 May 2026$/);
    expect(describeDate('date', '', 'en-GB')).toBe('');
    expect(describeDate('time', '10:00', 'en-GB')).toBe('');
  });
});
