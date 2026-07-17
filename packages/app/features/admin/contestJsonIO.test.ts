import { describe, it, expect } from '@jest/globals'
import { FIELD_LIMITS, parseContestJson } from './contestJsonIO'
import {
  CONTEST_CHAR_LIMITS,
  TRANSLATION_CHAR_LIMITS,
} from './contestFieldLimits'

describe('contestJsonIO limits wiring', () => {
  it('keeps FIELD_LIMITS aligned with shared contest/translation limits', () => {
    expect(FIELD_LIMITS.summary).toBe(CONTEST_CHAR_LIMITS.summary)
    expect(FIELD_LIMITS.summary_ms).toBe(CONTEST_CHAR_LIMITS.summary_ms)
    expect(FIELD_LIMITS.slug).toBe(CONTEST_CHAR_LIMITS.slug)
    expect(FIELD_LIMITS.entry_method_en).toBe(
      TRANSLATION_CHAR_LIMITS.entry_method
    )
    expect(FIELD_LIMITS.entry_method_ms).toBe(
      TRANSLATION_CHAR_LIMITS.entry_method
    )
    expect(FIELD_LIMITS.link_tnc_en).toBe(TRANSLATION_CHAR_LIMITS.link_tnc)
    expect(FIELD_LIMITS.link_tnc_ms).toBe(TRANSLATION_CHAR_LIMITS.link_tnc)
  })

  it('reports over-limit fields while preserving imported values', () => {
    const overSummary = 's'.repeat(CONTEST_CHAR_LIMITS.summary + 1)
    const overEntryMethod = 'e'.repeat(TRANSLATION_CHAR_LIMITS.entry_method + 1)

    const payload = {
      contest: {
        title: 'Sample contest',
        summary: overSummary,
        start_date: '2026-07-01T00:00:00+08:00',
        end_date: '2026-07-28T23:59:59+08:00',
      },
      translations: {
        en: {
          eligible_participants: 'Open to all',
          eligible_products: 'Any product',
          eligible_stores: 'All stores',
          prizes: 'Main prize',
          entry_method: overEntryMethod,
          winners_selection_method: 'Random draw',
          winners_comm_and_timeline: 'Phone call',
          winners_list_and_announcement: 'Official channels',
        },
      },
    }

    const report = parseContestJson(JSON.stringify(payload))

    expect(report.errors).toEqual([])
    expect(report.values.summary).toBe(overSummary)
    expect(report.values.entry_method_en).toBe(overEntryMethod)

    expect(report.overLimit).toEqual(
      expect.arrayContaining([
        {
          field: 'summary',
          chars: CONTEST_CHAR_LIMITS.summary + 1,
          limit: CONTEST_CHAR_LIMITS.summary,
        },
        {
          field: 'entry_method_en',
          chars: TRANSLATION_CHAR_LIMITS.entry_method + 1,
          limit: TRANSLATION_CHAR_LIMITS.entry_method,
        },
      ])
    )
  })
})
