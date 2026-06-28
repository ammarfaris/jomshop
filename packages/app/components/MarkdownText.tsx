import { Text } from 'app/components/ui/text'
import { Separator } from 'app/components/ui/separator'
import { Link } from 'app/lib/link-universal'
import { Platform, View, ScrollView, Text as RNText } from 'react-native'
import { useColorScheme } from 'app/hooks/useColorScheme'
import { useColorThemeValues } from 'app/hooks/useColorThemeValues'

interface MarkdownTextProps {
  children: string
  className?: string
}

interface TableData {
  headers: string[]
  rows: string[][]
  alignments: ('left' | 'center' | 'right')[]
}

interface ListItem {
  content: string
  indent: number
}

interface ListData {
  items: ListItem[]
  ordered: boolean
  startNumber?: number
}

interface HeadingData {
  level: 1 | 2 | 3 | 4
  content: string
}

interface CodeBlockData {
  content: string
  language?: string
}

type BlockPart =
  | { type: 'text'; content: string }
  | { type: 'table'; data: TableData }
  | { type: 'list'; data: ListData }
  | { type: 'hr' }
  | { type: 'heading'; data: HeadingData }
  | { type: 'codeblock'; data: CodeBlockData }

/**
 * Lightweight markdown parser that handles links, bold text, italic text, nested formatting, tables, lists, headings, horizontal rules, and code blocks.
 * Supports:
 * - External links: [text](https://example.com)
 * - Internal links: [text](/contest/slug)
 * - Bold text: **bold text**
 * - Italic text: *italic text* or _italic text_
 * - Bold-italic text: ***bold and italic*** or ___bold and italic___
 * - Nested formatting: _italic text with **bold** inside_
 * - Tables: | Header 1 | Header 2 | with alignment support
 * - Unordered lists: - item or * item
 * - Ordered lists: 1. item
 * - Headings: # H1, ## H2, ### H3, #### H4
 * - Horizontal rules: --- or *** or ___
 * - Inline code: `code`
 * - Fenced code blocks: ```language\ncode\n```
 */
export function MarkdownText({ children, className }: MarkdownTextProps) {
  const { isDarkColorScheme } = useColorScheme()
  const { main } = useColorThemeValues(isDarkColorScheme)

  // Parse table from lines
  const parseTable = (lines: string[]): TableData | null => {
    if (lines.length < 2) return null

    // Parse header row
    const headerLine = lines[0]
    if (!headerLine) return null
    const headers = headerLine
      .split('|')
      .map((cell) => cell.trim())
      .filter((cell) => cell !== '')

    if (headers.length === 0) return null

    // Parse separator row to get alignments
    const separatorLine = lines[1]
    if (!separatorLine) return null
    const separatorCells = separatorLine
      .split('|')
      .map((cell) => cell.trim())
      .filter((cell) => cell !== '')

    // Validate separator row (should contain dashes)
    const isValidSeparator = separatorCells.every((cell) =>
      /^:?-+:?$/.test(cell)
    )
    if (!isValidSeparator) return null

    // Determine alignments
    const alignments: ('left' | 'center' | 'right')[] = separatorCells.map(
      (cell) => {
        const leftColon = cell.startsWith(':')
        const rightColon = cell.endsWith(':')
        if (leftColon && rightColon) return 'center'
        if (rightColon) return 'right'
        return 'left'
      }
    )

    // Parse data rows
    const rows: string[][] = []
    for (let i = 2; i < lines.length; i++) {
      const line = lines[i]
      if (!line) continue
      const cells = line
        .split('|')
        .map((cell) => cell.trim())
        .filter((_, idx, arr) => {
          // Filter out empty strings at start/end caused by leading/trailing pipes
          if (idx === 0 && arr[idx] === '') return false
          if (idx === arr.length - 1 && arr[idx] === '') return false
          return true
        })
      // Re-parse to get actual cells
      const actualCells = line
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim())
      if (actualCells.length > 0) {
        rows.push(actualCells)
      }
    }

    return { headers, rows, alignments }
  }

  // Parse list from lines
  const parseList = (
    lines: string[]
  ): { listData: ListData; consumedLines: number } | null => {
    if (lines.length === 0) return null

    const items: ListItem[] = []
    let ordered = false
    let startNumber = 1

    // Check first line to determine list type
    const firstLine = lines[0] ?? ''
    const unorderedMatch = firstLine.match(/^(\s*)([-*+])\s+(.*)$/)
    const orderedMatch = firstLine.match(/^(\s*)(\d+)\.\s+(.*)$/)

    if (!unorderedMatch && !orderedMatch) return null

    if (orderedMatch) {
      ordered = true
      startNumber = parseInt(orderedMatch[2] ?? '1', 10)
    }

    let consumedLines = 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? ''

      // Check for list item patterns
      const unorderedItemMatch = line.match(/^(\s*)([-*+])\s+(.*)$/)
      const orderedItemMatch = line.match(/^(\s*)(\d+)\.\s+(.*)$/)

      if (ordered && orderedItemMatch) {
        const indent = (orderedItemMatch[1] ?? '').length
        const content = orderedItemMatch[3] ?? ''
        items.push({ content, indent })
        consumedLines++
      } else if (!ordered && unorderedItemMatch) {
        const indent = (unorderedItemMatch[1] ?? '').length
        const content = unorderedItemMatch[3] ?? ''
        items.push({ content, indent })
        consumedLines++
      } else if (line.trim() === '') {
        // Empty line might end the list or be between items
        // Check if next line continues the list
        const nextLine = lines[i + 1] ?? ''
        const nextUnordered = nextLine.match(/^(\s*)([-*+])\s+(.*)$/)
        const nextOrdered = nextLine.match(/^(\s*)(\d+)\.\s+(.*)$/)
        if ((ordered && nextOrdered) || (!ordered && nextUnordered)) {
          consumedLines++
          continue
        }
        break
      } else {
        // Non-list line, end the list
        break
      }
    }

    if (items.length === 0) return null

    return {
      listData: { items, ordered, startNumber },
      consumedLines,
    }
  }

  // Check if a line is a list item
  const isListLine = (line: string): boolean => {
    const trimmed = line.trim()
    return (
      /^[-*+]\s+/.test(trimmed) || // Unordered: - item, * item, + item
      /^\d+\.\s+/.test(trimmed) // Ordered: 1. item
    )
  }

  // Check if a line is a horizontal rule (---, ***, ___)
  const isHorizontalRule = (line: string): boolean => {
    const trimmed = line.trim()
    return (
      /^[-*_]{3,}$/.test(trimmed) && /^(.)\1*$/.test(trimmed.replace(/\s/g, ''))
    )
  }

  // Check if a line is a heading and return level + content
  const parseHeading = (line: string): HeadingData | null => {
    const trimmed = line.trim()
    const match = trimmed.match(/^(#{1,4})\s+(.+)$/)
    if (match) {
      const level = match[1]?.length as 1 | 2 | 3 | 4
      const content = match[2] ?? ''
      if (level >= 1 && level <= 4) {
        return { level, content }
      }
    }
    return null
  }

  // Split content into blocks (text, tables, lists, headings, horizontal rules, and code blocks)
  const parseBlocks = (text: string): BlockPart[] => {
    const blocks: BlockPart[] = []
    const lines = text.split('\n')
    let currentTextLines: string[] = []
    let tableLines: string[] = []
    let inTable = false
    let inCodeBlock = false
    let codeBlockLines: string[] = []
    let codeBlockLanguage: string | undefined = undefined

    const flushTextLines = () => {
      if (currentTextLines.length > 0) {
        const textContent = currentTextLines.join('\n').trim()
        if (textContent) {
          blocks.push({ type: 'text', content: textContent })
        }
        currentTextLines = []
      }
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? ''
      const trimmedLine = line.trim()

      // Check for fenced code block start/end (``` or ```language)
      const codeBlockStartMatch = trimmedLine.match(/^```(\w*)$/)
      const isCodeBlockEnd = trimmedLine === '```'

      if (inCodeBlock) {
        if (isCodeBlockEnd) {
          // End of code block
          blocks.push({
            type: 'codeblock',
            data: {
              content: codeBlockLines.join('\n'),
              language: codeBlockLanguage,
            },
          })
          codeBlockLines = []
          codeBlockLanguage = undefined
          inCodeBlock = false
        } else {
          // Inside code block, preserve the line as-is
          codeBlockLines.push(line)
        }
        continue
      }

      if (codeBlockStartMatch) {
        // Starting a new code block
        flushTextLines()
        if (inTable) {
          // End any ongoing table
          const tableData = parseTable(tableLines)
          if (tableData) {
            blocks.push({ type: 'table', data: tableData })
          } else {
            currentTextLines.push(...tableLines)
            flushTextLines()
          }
          tableLines = []
          inTable = false
        }
        inCodeBlock = true
        codeBlockLanguage = codeBlockStartMatch[1] || undefined
        continue
      }

      // Check if this line looks like a table row (starts and ends with |, or contains | with content)
      const isTableRowLine =
        (trimmedLine.startsWith('|') && trimmedLine.endsWith('|')) ||
        (trimmedLine.includes('|') &&
          /^\|?[^|]+(\|[^|]+)+\|?$/.test(trimmedLine))

      // Check if this is a list line
      const isListItemLine = isListLine(line)

      // Check for horizontal rule (must check before list since --- could be confused)
      const isHrLine = isHorizontalRule(line)

      // Check for heading
      const headingData = parseHeading(line)

      if (isTableRowLine) {
        if (!inTable) {
          // Starting a new table, save accumulated text
          flushTextLines()
          inTable = true
        }
        tableLines.push(trimmedLine)
      } else if (isHrLine && !inTable) {
        // Horizontal rule - flush text and add hr block
        flushTextLines()
        blocks.push({ type: 'hr' })
      } else if (headingData && !inTable) {
        // Heading - flush text and add heading block
        flushTextLines()
        blocks.push({ type: 'heading', data: headingData })
      } else if (isListItemLine && !inTable) {
        // Starting a list, save accumulated text first
        flushTextLines()

        // Parse the list starting from current line
        const remainingLines = lines.slice(i)
        const listResult = parseList(remainingLines)

        if (listResult) {
          blocks.push({ type: 'list', data: listResult.listData })
          // Skip the lines consumed by the list (minus 1 because loop will increment)
          i += listResult.consumedLines - 1
        } else {
          // Not a valid list, treat as text
          currentTextLines.push(line)
        }
      } else {
        if (inTable) {
          // End of table, parse it
          const tableData = parseTable(tableLines)
          if (tableData) {
            blocks.push({ type: 'table', data: tableData })
          } else {
            // Not a valid table, treat as text
            currentTextLines.push(...tableLines)
          }
          tableLines = []
          inTable = false
        }
        currentTextLines.push(line)
      }
    }

    // Handle remaining content
    if (inCodeBlock && codeBlockLines.length > 0) {
      // Unclosed code block - still render it
      blocks.push({
        type: 'codeblock',
        data: {
          content: codeBlockLines.join('\n'),
          language: codeBlockLanguage,
        },
      })
    }

    if (inTable && tableLines.length > 0) {
      const tableData = parseTable(tableLines)
      if (tableData) {
        blocks.push({ type: 'table', data: tableData })
      } else {
        currentTextLines.push(...tableLines)
      }
    }

    flushTextLines()

    return blocks
  }

  // Parse markdown with links, bold text, italic text, inline code, and nested formatting
  const parseMarkdown = (
    text: string
  ): Array<{
    type: 'text' | 'link' | 'bold' | 'italic' | 'bold-italic' | 'code'
    content: string | any[]
    url?: string
  }> => {
    const parts: Array<{
      type: 'text' | 'link' | 'bold' | 'italic' | 'bold-italic' | 'code'
      content: string | any[]
      url?: string
    }> = []

    // Combined regex to match all patterns, prioritizing longer matches
    // Order matters: inline code first (to prevent backticks from interfering), then bold-italic > bold > underscore italic > asterisk italic, links separately
    // Underscore italic comes before asterisk italic to handle cases like _*text_
    // Using [\s\S] instead of . to match newlines
    // Inline code uses single backticks: `code`
    const regex =
      /`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)|\*\*\*([\s\S]+?)\*\*\*|\_\_\_([\s\S]+?)\_\_\_|\*\*([\s\S]+?)\*\*|_([\s\S]+?)_|\*([\s\S]+?)\*/g

    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = regex.exec(text)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: text.substring(lastIndex, match.index),
        })
      }

      // Check what type of match it is
      if (match[1]) {
        // Inline code: `code`
        parts.push({
          type: 'code',
          content: match[1],
        })
      } else if (match[2] && match[3]) {
        // Link: [text](url)
        parts.push({
          type: 'link',
          content: match[2],
          url: match[3],
        })
      } else if (match[4] || match[5]) {
        // Bold-italic: ***text*** or ___text___
        const content = match[4] ?? match[5] ?? ''
        parts.push({
          type: 'bold-italic',
          content: content,
        })
      } else if (match[6]) {
        // Bold: **text**
        parts.push({
          type: 'bold',
          content: match[6],
        })
      } else if (match[7]) {
        // Italic with underscores: _text_
        // Recursively parse the content to handle nested bold
        const nestedContent = parseMarkdown(match[7])
        if (nestedContent.length === 1 && nestedContent[0]?.type === 'text') {
          // No nested formatting, just italic
          parts.push({
            type: 'italic',
            content: match[7],
          })
        } else {
          // Has nested formatting
          parts.push({
            type: 'italic',
            content: nestedContent,
          })
        }
      } else if (match[8]) {
        // Italic with asterisks: *text*
        parts.push({
          type: 'italic',
          content: match[8],
        })
      }

      lastIndex = match.index + match[0].length
    }

    // Add remaining text after the last match
    if (lastIndex < text.length) {
      parts.push({
        type: 'text',
        content: text.substring(lastIndex),
      })
    }

    return parts.length > 0 ? parts : [{ type: 'text' as const, content: text }]
  }

  const parts = parseMarkdown(children)

  // Recursive rendering function to handle nested content
  const renderPart = (part: any, index: number): any => {
    if (part.type === 'link' && part.url) {
      // Check if it's an internal link (starts with /)
      const isInternal = part.url.startsWith('/')

      return (
        <Link
          key={index}
          href={part.url}
          className={
            Platform.OS === 'web' ? 'text-main underline' : 'underline'
          }
          style={Platform.OS === 'web' ? undefined : { color: main }}
          target={isInternal ? undefined : '_blank'}
          rel={isInternal ? undefined : 'noopener noreferrer'}
        >
          {part.content}
        </Link>
      )
    }

    if (part.type === 'bold') {
      // On web, use a span with font-weight to avoid Text nesting issues
      // On native, we have to use Text but with explicit fontSize inheritance
      if (Platform.OS === 'web') {
        return (
          <span key={index} style={{ fontWeight: 'bold' }}>
            {typeof part.content === 'string'
              ? part.content
              : part.content.map((nested: any, i: number) =>
                  renderPart(nested, i)
                )}
          </span>
        )
      }

      // For native, use Text with fontWeight only (no fontSize override)
      return (
        <Text key={index} style={{ fontWeight: '700' }}>
          {typeof part.content === 'string'
            ? part.content
            : part.content.map((nested: any, i: number) =>
                renderPart(nested, i)
              )}
        </Text>
      )
    }

    if (part.type === 'italic') {
      // On web, use a span with font-style to avoid Text nesting issues
      // On native, use Text with fontStyle
      if (Platform.OS === 'web') {
        return (
          <span key={index} style={{ fontStyle: 'italic' }}>
            {typeof part.content === 'string'
              ? part.content
              : part.content.map((nested: any, i: number) =>
                  renderPart(nested, i)
                )}
          </span>
        )
      }

      // For native, use Text with fontStyle only
      return (
        <Text key={index} style={{ fontStyle: 'italic' }}>
          {typeof part.content === 'string'
            ? part.content
            : part.content.map((nested: any, i: number) =>
                renderPart(nested, i)
              )}
        </Text>
      )
    }

    if (part.type === 'bold-italic') {
      // On web, use a span with both font-weight and font-style
      // On native, use Text with both fontWeight and fontStyle
      if (Platform.OS === 'web') {
        return (
          <span key={index} style={{ fontWeight: 'bold', fontStyle: 'italic' }}>
            {typeof part.content === 'string'
              ? part.content
              : part.content.map((nested: any, i: number) =>
                  renderPart(nested, i)
                )}
          </span>
        )
      }

      // For native, use Text with both fontWeight and fontStyle
      return (
        <Text key={index} style={{ fontWeight: '700', fontStyle: 'italic' }}>
          {typeof part.content === 'string'
            ? part.content
            : part.content.map((nested: any, i: number) =>
                renderPart(nested, i)
              )}
        </Text>
      )
    }

    if (part.type === 'code') {
      // Inline code styling
      const codeBgColor = isDarkColorScheme
        ? 'rgba(255, 255, 255, 0.1)'
        : 'rgba(0, 0, 0, 0.06)'
      const codeTextColor = isDarkColorScheme
        ? 'rgba(255, 255, 255, 0.9)'
        : 'rgba(0, 0, 0, 0.85)'

      if (Platform.OS === 'web') {
        return (
          <code
            key={index}
            style={{
              backgroundColor: codeBgColor,
              color: codeTextColor,
              paddingLeft: 6,
              paddingRight: 6,
              paddingTop: 2,
              paddingBottom: 2,
              borderRadius: 4,
              fontFamily: 'Consolas, Monaco, "Courier New", monospace',
              fontSize: '0.85em',
            }}
          >
            {part.content}
          </code>
        )
      }

      // For native, use Text with monospace font
      return (
        <Text
          key={index}
          style={{
            backgroundColor: codeBgColor,
            color: codeTextColor,
            paddingHorizontal: 6,
            fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
            fontSize: 12,
          }}
        >
          {part.content}
        </Text>
      )
    }

    // Return plain text without wrapping in Text to avoid nested Text components
    return part.content
  }

  // Render inline text content (with markdown formatting)
  const renderInlineContent = (text: string) => {
    // Convert <br>, <br/>, <br /> tags to newlines before parsing
    const normalizedText = text.replace(/<br\s*\/?>/gi, '\n')
    const parts = parseMarkdown(normalizedText)
    return parts.map((part, index) => renderPart(part, index))
  }

  // Render a table
  const renderTable = (tableData: TableData, tableIndex: number) => {
    const borderColor = isDarkColorScheme
      ? 'rgba(255, 255, 255, 0.2)'
      : 'rgba(0, 0, 0, 0.15)'
    const headerBg = isDarkColorScheme
      ? 'rgba(255, 255, 255, 0.08)'
      : 'rgba(0, 0, 0, 0.04)'
    const altRowBg = isDarkColorScheme
      ? 'rgba(255, 255, 255, 0.03)'
      : 'rgba(0, 0, 0, 0.02)'

    const getTextAlign = (
      alignment: 'left' | 'center' | 'right'
    ): 'left' | 'center' | 'right' => {
      return alignment
    }

    // Calculate if table needs horizontal scroll (more than 4 columns typically needs scroll)
    const needsScroll = tableData.headers.length > 4

    const tableContent = (
      <View style={{ flex: 1 }}>
        {/* Header Row */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: headerBg,
            borderBottomWidth: 1,
            borderBottomColor: borderColor,
          }}
        >
          {tableData.headers.map((header, cellIndex) => (
            <View
              key={`header-${cellIndex}`}
              style={{
                flex: 1,
                minWidth: needsScroll ? 120 : undefined,
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderRightWidth:
                  cellIndex < tableData.headers.length - 1 ? 1 : 0,
                borderRightColor: borderColor,
              }}
            >
              <Text
                className={className}
                style={{
                  fontWeight: '600',
                  textAlign: getTextAlign(
                    tableData.alignments[cellIndex] ?? 'left'
                  ),
                }}
              >
                {renderInlineContent(header)}
              </Text>
            </View>
          ))}
        </View>

        {/* Data Rows */}
        {tableData.rows.map((row, rowIndex) => (
          <View
            key={`row-${rowIndex}`}
            style={{
              flexDirection: 'row',
              backgroundColor: rowIndex % 2 === 1 ? altRowBg : 'transparent',
              borderBottomWidth: rowIndex < tableData.rows.length - 1 ? 1 : 0,
              borderBottomColor: borderColor,
            }}
          >
            {row.map((cell, cellIndex) => (
              <View
                key={`cell-${rowIndex}-${cellIndex}`}
                style={{
                  flex: 1,
                  minWidth: needsScroll ? 120 : undefined,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderRightWidth: cellIndex < row.length - 1 ? 1 : 0,
                  borderRightColor: borderColor,
                }}
              >
                <Text
                  className={className}
                  style={{
                    textAlign: getTextAlign(
                      tableData.alignments[cellIndex] ?? 'left'
                    ),
                  }}
                >
                  {renderInlineContent(cell)}
                </Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    )

    return (
      <View
        key={`table-${tableIndex}`}
        style={{
          marginVertical: 12,
          borderRadius: 8,
          borderWidth: 1,
          borderColor,
          overflow: 'hidden',
        }}
      >
        {needsScroll ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {tableContent}
          </ScrollView>
        ) : (
          tableContent
        )}
      </View>
    )
  }

  // Render a list
  const renderList = (listData: ListData, listIndex: number) => {
    const bulletColor = isDarkColorScheme
      ? 'rgba(255, 255, 255, 0.6)'
      : 'rgba(0, 0, 0, 0.6)'

    return (
      <View
        key={`list-${listIndex}`}
        style={{
          marginVertical: 8,
        }}
      >
        {listData.items.map((item, itemIndex) => {
          const bulletMarker = listData.ordered
            ? `${(listData.startNumber ?? 1) + itemIndex}.`
            : '•'

          return (
            <View
              key={`list-item-${itemIndex}`}
              style={{
                flexDirection: 'row',
                paddingLeft: item.indent > 0 ? item.indent * 16 : 0,
                marginBottom: 4,
              }}
            >
              <Text
                className={className}
                style={{
                  color: bulletColor,
                  width: listData.ordered ? 24 : 16,
                  marginRight: 4,
                }}
              >
                {bulletMarker}
              </Text>
              <Text className={className} style={{ flex: 1 }}>
                {renderInlineContent(item.content)}
              </Text>
            </View>
          )
        })}
      </View>
    )
  }

  // Render a horizontal rule
  const renderHorizontalRule = (hrIndex: number) => {
    return (
      <View
        key={`hr-${hrIndex}`}
        style={{
          marginVertical: 16,
        }}
      >
        <Separator />
      </View>
    )
  }

  // Render a heading
  const renderHeading = (headingData: HeadingData, headingIndex: number) => {
    // Heading classes:
    // H1 (#) → Slightly bigger than section titles (text-xl, 20px)
    // H2 (##) → Same as section titles like "Prizes" (text-lg, 18px)
    // H3 (###) → Slightly smaller (text-base, 16px)
    // H4 (####) → Same as normal text, just bold (inherits size)
    const headingClasses: Record<1 | 2 | 3 | 4, string> = {
      1: 'text-xl font-semibold', // Slightly bigger than section title (20px)
      2: 'text-lg font-semibold', // Matches section title size (18px)
      3: 'text-base font-semibold', // Slightly smaller (16px)
      4: 'font-semibold', // Same as normal text size, just bold
    }

    const headingMargins: Record<
      1 | 2 | 3 | 4,
      { marginTop: number; marginBottom: number }
    > = {
      1: { marginTop: 16, marginBottom: 8 },
      2: { marginTop: 14, marginBottom: 6 },
      3: { marginTop: 10, marginBottom: 4 },
      4: { marginTop: 8, marginBottom: 4 },
    }

    const margins = headingMargins[headingData.level]

    // For H4, we want to inherit the text size from className, so we don't add size class
    // For H1, H2, H3, we override with specific size classes
    const headingClassName =
      headingData.level === 4
        ? `${className ?? ''} ${headingClasses[4]}`.trim()
        : headingClasses[headingData.level]

    return (
      <Text
        key={`heading-${headingIndex}`}
        className={headingClassName}
        style={{
          marginTop: margins.marginTop,
          marginBottom: margins.marginBottom,
        }}
      >
        {renderInlineContent(headingData.content)}
      </Text>
    )
  }

  // Render a fenced code block
  const renderCodeBlock = (codeBlockData: CodeBlockData, codeBlockIndex: number) => {
    const bgColor = isDarkColorScheme
      ? 'rgba(255, 255, 255, 0.08)'
      : 'rgba(0, 0, 0, 0.04)'
    const borderColor = isDarkColorScheme
      ? 'rgba(255, 255, 255, 0.15)'
      : 'rgba(0, 0, 0, 0.1)'
    const textColor = isDarkColorScheme
      ? 'rgba(255, 255, 255, 0.9)'
      : 'rgba(0, 0, 0, 0.85)'

    const codeContent = (
      <RNText
        style={{
          fontFamily:
            Platform.OS === 'ios'
              ? 'Menlo'
              : Platform.OS === 'android'
                ? 'monospace'
                : 'Consolas, Monaco, "Courier New", monospace',
          fontSize: 12,
          lineHeight: 18,
          color: textColor,
        }}
      >
        {codeBlockData.content}
      </RNText>
    )

    return (
      <View
        key={`codeblock-${codeBlockIndex}`}
        style={{
          backgroundColor: bgColor,
          borderRadius: 8,
          borderWidth: 1,
          borderColor,
          marginVertical: 12,
          padding: 12,
          overflow: 'hidden',
        }}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={Platform.OS === 'web'}
        >
          {codeContent}
        </ScrollView>
      </View>
    )
  }

  // Parse content into blocks
  const blocks = parseBlocks(children)

  // If there's only one text block with no tables or lists, render simply
  if (blocks.length === 1 && blocks[0]?.type === 'text') {
    const parts = parseMarkdown(blocks[0].content)
    return (
      <Text className={className}>
        {parts.map((part, index) => renderPart(part, index))}
      </Text>
    )
  }

  // Render mixed content (text, tables, lists, headings, horizontal rules, and code blocks)
  return (
    <View className={className}>
      {blocks.map((block, blockIndex) => {
        if (block.type === 'table') {
          return renderTable(block.data, blockIndex)
        }
        if (block.type === 'list') {
          return renderList(block.data, blockIndex)
        }
        if (block.type === 'hr') {
          return renderHorizontalRule(blockIndex)
        }
        if (block.type === 'heading') {
          return renderHeading(block.data, blockIndex)
        }
        if (block.type === 'codeblock') {
          return renderCodeBlock(block.data, blockIndex)
        }
        // Text block
        const parts = parseMarkdown(block.content)
        return (
          <Text key={`text-${blockIndex}`} className={className}>
            {parts.map((part, index) => renderPart(part, index))}
          </Text>
        )
      })}
    </View>
  )
}
