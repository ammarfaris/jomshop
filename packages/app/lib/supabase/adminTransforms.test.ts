import { describe, it, expect } from '@jest/globals'
import {
  clean,
  slugify,
  extFromName,
  contestCoreFromForm,
  buildTranslationRow,
  translationRowHasContent,
  translationRowsFromForm,
  buildContestSearchPattern,
  diffIds,
  mapContestRow,
  mapTranslationRow,
  mapFileRow,
  chooseFinalMainPath,
  orderFilesMainFirst,
} from './adminTransforms'

describe('clean', () => {
  it('trims surrounding whitespace', () => {
    expect(clean('  hi  ')).toBe('hi')
  })

  it('returns null for empty / whitespace-only / nullish', () => {
    expect(clean('')).toBeNull()
    expect(clean('   ')).toBeNull()
    expect(clean(null)).toBeNull()
    expect(clean(undefined)).toBeNull()
  })
})

describe('slugify', () => {
  it('lowercases and dashes non-alphanumerics', () => {
    expect(slugify('Hello World!')).toBe('hello-world')
    expect(slugify('  Raya   Mega Sale  ')).toBe('raya-mega-sale')
  })

  it('collapses runs and trims leading/trailing dashes', () => {
    expect(slugify('--A & B--')).toBe('a-b')
  })
})

describe('extFromName', () => {
  it('extracts and lowercases the extension', () => {
    expect(extFromName('photo.PNG')).toBe('png')
    expect(extFromName('a.b.jpeg')).toBe('jpeg')
  })

  it('falls back when missing/undefined', () => {
    expect(extFromName(undefined)).toBe('jpg')
    expect(extFromName('noext')).toBe('jpg')
    expect(extFromName('noext', 'png')).toBe('png')
  })
})

describe('contestCoreFromForm', () => {
  const base = {
    title: 'My Contest',
    title_ms: '',
    summary: 'Summary',
    summary_ms: '  ',
    start_date: '2026-01-01T00:00:00.000Z',
    end_date: '2026-02-01T00:00:00.000Z',
    slug: 'my-contest',
    total_prizes_value_rm: '1500.50',
    link_aff_shopee: ' https://shopee.my/x ',
    link_media_website: '',
  }

  it('passes required fields through and ISO-normalizes dates', () => {
    const row = contestCoreFromForm(base)
    expect(row.title).toBe('My Contest')
    expect(row.slug).toBe('my-contest')
    expect(row.start_date).toBe(new Date(base.start_date).toISOString())
    expect(row.end_date).toBe(new Date(base.end_date).toISOString())
  })

  it('nulls empty/whitespace optionals and trims kept ones', () => {
    const row = contestCoreFromForm(base)
    expect(row.title_ms).toBeNull()
    expect(row.summary_ms).toBeNull()
    expect(row.link_media_website).toBeNull()
    expect(row.link_aff_shopee).toBe('https://shopee.my/x')
  })

  it('parses the prize value and defaults visibility', () => {
    const row = contestCoreFromForm(base)
    expect(row.total_prizes_value_rm).toBe(1500.5)
    expect(row.visibility).toBe('users')

    expect(
      contestCoreFromForm({ ...base, total_prizes_value_rm: '' })
        .total_prizes_value_rm,
    ).toBeNull()
    expect(
      contestCoreFromForm({ ...base, visibility: 'admin' }).visibility,
    ).toBe('admin')
  })
})

describe('buildTranslationRow', () => {
  it('uses Supabase column stems (not the Appwrite aliases) and sets keys', () => {
    const row = buildTranslationRow(
      {
        prizes_en: 'Win big',
        eligible_products_en: 'Anything',
        entry_method_en: 'Buy + upload',
      },
      'contest-1',
      'en',
    )
    expect(row.contest_id).toBe('contest-1')
    expect(row.locale).toBe('en')
    expect(row.prizes).toBe('Win big')
    // Supabase column names, not eligible_products_and_purchases / *_and_submission
    expect(row.eligible_products).toBe('Anything')
    expect(row.entry_method).toBe('Buy + upload')
    expect('eligible_products_and_purchases' in row).toBe(false)
    expect('entry_method_and_submission' in row).toBe(false)
  })

  it('reads the locale-specific fields and nulls empties', () => {
    const row = buildTranslationRow(
      { prizes_en: 'EN only', prizes_ms: '' },
      'c1',
      'ms',
    )
    expect(row.prizes).toBeNull()
    expect(row.link_tnc).toBeNull()
  })
})

describe('translationRowHasContent', () => {
  it('ignores contest_id/locale and detects real content', () => {
    expect(
      translationRowHasContent({ contest_id: 'c1', locale: 'ms' }),
    ).toBe(false)
    expect(
      translationRowHasContent({
        contest_id: 'c1',
        locale: 'ms',
        prizes: null,
        link_tnc: null,
      }),
    ).toBe(false)
    expect(
      translationRowHasContent({
        contest_id: 'c1',
        locale: 'ms',
        prizes: 'Hadiah',
      }),
    ).toBe(true)
  })
})

describe('translationRowsFromForm', () => {
  it('always emits EN and adds MS only when it has content', () => {
    const enOnly = translationRowsFromForm({ prizes_en: 'x' }, 'c1')
    expect(enOnly).toHaveLength(1)
    expect(enOnly[0]!.locale).toBe('en')

    const both = translationRowsFromForm(
      { prizes_en: 'x', prizes_ms: 'y' },
      'c1',
    )
    expect(both).toHaveLength(2)
    expect(both.map((r) => r.locale)).toEqual(['en', 'ms'])
  })
})

describe('buildContestSearchPattern', () => {
  it('wraps the term for a contains match', () => {
    expect(buildContestSearchPattern('raya')).toBe('%raya%')
  })

  it('drops or(...)-breaking chars and escapes LIKE wildcards', () => {
    // commas / parens would break PostgREST's or() grammar
    expect(buildContestSearchPattern('a,b(c)')).toBe('%a b c%')
    // % and _ are LIKE wildcards -> escaped so they match literally
    expect(buildContestSearchPattern('50%_off')).toBe('%50\\%\\_off%')
  })
})

describe('diffIds', () => {
  it('computes only the added and removed ids', () => {
    expect(diffIds(['a', 'b', 'c'], ['b', 'c', 'd'])).toEqual({
      toAdd: ['d'],
      toRemove: ['a'],
    })
  })

  it('adds all when nothing existed', () => {
    expect(diffIds([], ['a', 'b'])).toEqual({ toAdd: ['a', 'b'], toRemove: [] })
  })

  it('removes all when nothing is desired', () => {
    expect(diffIds(['a', 'b'], [])).toEqual({ toAdd: [], toRemove: ['a', 'b'] })
  })

  it('is a no-op when unchanged (order-insensitive)', () => {
    expect(diffIds(['a', 'b'], ['b', 'a'])).toEqual({
      toAdd: [],
      toRemove: [],
    })
  })
})

describe('mapContestRow', () => {
  const dbRow = {
    id: 'uuid-1',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
    title: 'T',
    slug: 's',
    main_img_id: 'contests/x.jpg',
    main_img_blurhash: 'LEHV6n',
    visibility: 'any',
  }

  it('maps id -> $id and injects host/category ids', () => {
    const doc = mapContestRow(dbRow, ['h1', 'h2'], ['c1'])
    expect(doc.$id).toBe('uuid-1')
    expect(doc.host_ids).toEqual(['h1', 'h2'])
    expect(doc.category_ids).toEqual(['c1'])
    expect(doc.main_img_id).toBe('contests/x.jpg')
    expect(doc.main_img_token_secret).toBeNull()
  })

  it('defaults ids to empty arrays and falls back updated->created', () => {
    const doc = mapContestRow({ ...dbRow, updated_at: null })
    expect(doc.host_ids).toEqual([])
    expect(doc.category_ids).toEqual([])
    expect(doc.$updatedAt).toBe(dbRow.created_at)
  })
})

describe('mapTranslationRow', () => {
  it('restores the Appwrite aliases the form expects', () => {
    const doc = mapTranslationRow({
      id: 't1',
      contest_id: 'c1',
      locale: 'en',
      eligible_products: 'prod',
      entry_method: 'method',
      prizes: 'p',
    })
    expect(doc.eligible_products_and_purchases).toBe('prod')
    expect(doc.entry_method_and_submission).toBe('method')
    expect(doc.prizes).toBe('p')
  })
})

describe('mapFileRow', () => {
  it('exposes storage_path as file_id and maps width/height', () => {
    const f = mapFileRow({
      id: 'f1',
      storage_path: 'contests/a.jpg',
      contest_id: 'c1',
      width: 800,
      height: 600,
      label: 'main-gallery',
      file_order: 1,
      blurhash: 'bh',
    })
    expect(f.file_id).toBe('contests/a.jpg')
    expect(f.preview_img_width).toBe(800)
    expect(f.preview_img_height).toBe(600)
    expect(f.file_label).toBe('main-gallery')
    expect(f.token_secret).toBeNull()
  })
})

describe('chooseFinalMainPath', () => {
  const uploaded = [
    { path: 'contests/new-1.jpg', uri: 'file://new1' },
    { path: 'contests/new-2.jpg', uri: 'file://new2' },
  ]

  it('prefers a newly-uploaded asset chosen as main', () => {
    expect(
      chooseFinalMainPath({
        newMainImageUri: 'file://new2',
        uploaded,
        mainImageId: 'contests/old.jpg',
        imagesToDelete: [],
      }),
    ).toBe('contests/new-2.jpg')
  })

  it('falls back to the existing selection when still present', () => {
    expect(
      chooseFinalMainPath({
        newMainImageUri: null,
        uploaded,
        mainImageId: 'contests/old.jpg',
        imagesToDelete: [],
      }),
    ).toBe('contests/old.jpg')
  })

  it('returns null when the existing main is being deleted', () => {
    expect(
      chooseFinalMainPath({
        newMainImageUri: null,
        uploaded,
        mainImageId: 'contests/old.jpg',
        imagesToDelete: ['contests/old.jpg'],
      }),
    ).toBeNull()
  })

  it('returns null when a new main uri does not match any upload', () => {
    expect(
      chooseFinalMainPath({
        newMainImageUri: 'file://ghost',
        uploaded,
        mainImageId: null,
        imagesToDelete: [],
      }),
    ).toBeNull()
  })
})

describe('orderFilesMainFirst', () => {
  const files = [
    { id: 'a', storage_path: 'contests/a.jpg' },
    { id: 'b', storage_path: 'contests/b.jpg' },
    { id: 'c', storage_path: 'contests/c.jpg' },
  ]

  it('puts the chosen main first, preserving the rest order', () => {
    const { finalMain, ordered } = orderFilesMainFirst(
      files,
      'contests/b.jpg',
    )
    expect(finalMain).toBe('contests/b.jpg')
    expect(ordered.map((f) => f.id)).toEqual(['b', 'a', 'c'])
  })

  it('resolves an invalid/null candidate to the first file', () => {
    expect(orderFilesMainFirst(files, null).finalMain).toBe('contests/a.jpg')
    expect(
      orderFilesMainFirst(files, 'contests/gone.jpg').finalMain,
    ).toBe('contests/a.jpg')
  })

  it('handles an empty file list', () => {
    const { finalMain, ordered } = orderFilesMainFirst([], 'x')
    expect(finalMain).toBeNull()
    expect(ordered).toEqual([])
  })
})
