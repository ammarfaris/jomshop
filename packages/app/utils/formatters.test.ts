import { describe, it, expect } from '@jest/globals'
import { formatUpvoteCount } from './formatters'

describe('formatUpvoteCount', () => {
  describe('numbers less than 1000', () => {
    it('should format 0 as "0"', () => {
      expect(formatUpvoteCount(0)).toBe('0')
    })

    it('should format single digits as-is', () => {
      expect(formatUpvoteCount(5)).toBe('5')
      expect(formatUpvoteCount(9)).toBe('9')
    })

    it('should format double digits as-is', () => {
      expect(formatUpvoteCount(42)).toBe('42')
      expect(formatUpvoteCount(99)).toBe('99')
    })

    it('should format triple digits as-is', () => {
      expect(formatUpvoteCount(123)).toBe('123')
      expect(formatUpvoteCount(999)).toBe('999')
    })
  })

  describe('numbers 1000-999999 with K suffix', () => {
    it('should format 1000 as "1K"', () => {
      expect(formatUpvoteCount(1000)).toBe('1K')
    })

    it('should format 1234 as "1.2K" (rounded to 1 decimal)', () => {
      expect(formatUpvoteCount(1234)).toBe('1.2K')
    })

    it('should format 1500 as "1.5K"', () => {
      expect(formatUpvoteCount(1500)).toBe('1.5K')
    })

    it('should format 5678 as "5.7K" (rounded up)', () => {
      expect(formatUpvoteCount(5678)).toBe('5.7K')
    })

    it('should format 10000 as "10K"', () => {
      expect(formatUpvoteCount(10000)).toBe('10K')
    })

    it('should format 45600 as "45.6K"', () => {
      expect(formatUpvoteCount(45600)).toBe('45.6K')
    })

    it('should format 999000 as "999K"', () => {
      expect(formatUpvoteCount(999000)).toBe('999K')
    })

    it('should format 999499 as "999.5K" (rounded)', () => {
      expect(formatUpvoteCount(999499)).toBe('999.5K')
    })

    it('should format 999999 as "1000K"', () => {
      expect(formatUpvoteCount(999999)).toBe('1000K')
    })
  })

  describe('numbers 1000000+ with M suffix', () => {
    it('should format 1000000 as "1M"', () => {
      expect(formatUpvoteCount(1000000)).toBe('1M')
    })

    it('should format 1234567 as "1.2M" (rounded to 1 decimal)', () => {
      expect(formatUpvoteCount(1234567)).toBe('1.2M')
    })

    it('should format 1500000 as "1.5M"', () => {
      expect(formatUpvoteCount(1500000)).toBe('1.5M')
    })

    it('should format 5678900 as "5.7M" (rounded up)', () => {
      expect(formatUpvoteCount(5678900)).toBe('5.7M')
    })

    it('should format 12300000 as "12.3M"', () => {
      expect(formatUpvoteCount(12300000)).toBe('12.3M')
    })

    it('should format 100000000 as "100M"', () => {
      expect(formatUpvoteCount(100000000)).toBe('100M')
    })
  })

  describe('edge cases', () => {
    it('should handle negative numbers by returning "0"', () => {
      expect(formatUpvoteCount(-1)).toBe('0')
      expect(formatUpvoteCount(-100)).toBe('0')
    })

    it('should handle decimal inputs by rounding', () => {
      expect(formatUpvoteCount(1234.56)).toBe('1.2K')
      expect(formatUpvoteCount(999.9)).toBe('999')
    })
  })
})
