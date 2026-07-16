import { Platform, Pressable, View } from 'react-native'
import { Button } from 'app/components/ui/button'
import { Text } from 'app/components/ui/text'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from 'app/components/ui/popover'
import { ChevronDownOutline } from 'app/components/icons-svg/ChevronDownOutline'
import { copyToClipboard } from 'app/lib/clipboard'
import { toast } from 'app/lib/sonner-universal'
import { CONTEST_JSON_PROMPT } from './contestJsonPrompt'
import { CURSOR_INGEST_PROMPT } from './contestCursorPrompt'
import { CURSOR_INGEST_BATCH_PROMPT } from './contestCursorBatchPrompt'

type PromptOption = {
  id: string
  label: string
  description: string
  text: string
  successMessage: string
}

const PROMPT_OPTIONS: PromptOption[] = [
  {
    id: 'tnc-chatbot',
    label: 'From T&C',
    description: 'ChatGPT, Gemini, Claude — paste with the T&C text or PDF',
    text: CONTEST_JSON_PROMPT,
    successMessage:
      'Prompt copied — paste into your chatbot together with the T&C, then Import/Paste JSON here.',
  },
  {
    id: 'cursor-url',
    label: 'From URL',
    description: 'Cursor / Claude Code — one campaign URL, auto-fetch & submit',
    text: CURSOR_INGEST_PROMPT,
    successMessage:
      'Cursor prompt copied — replace <CAMPAIGN_URL> and paste into Cursor.',
  },
  {
    id: 'cursor-batch',
    label: 'From URLs (batch)',
    description: 'Cursor — multiple URLs in one turn (cheaper on request caps)',
    text: CURSOR_INGEST_BATCH_PROMPT,
    successMessage:
      'Batch prompt copied — replace <URL_1>, <URL_2>, … and paste into Cursor.',
  },
]

function PromptMenuItem({ option }: { option: PromptOption }) {
  const handlePress = async () => {
    const ok = await copyToClipboard(option.text)
    if (ok) {
      toast.success(option.successMessage)
    } else {
      toast.error('Could not copy the prompt to the clipboard')
    }
  }

  return (
    <Pressable
      onPress={handlePress}
      className="rounded-md px-2 py-2 active:bg-accent web:hover:bg-accent"
      accessibilityRole="button"
      accessibilityLabel={option.label}
    >
      <Text className="text-sm font-semibold">{option.label}</Text>
      <Text className="text-xs text-muted-foreground mt-0.5">
        {option.description}
      </Text>
    </Pressable>
  )
}

export function CopyAiPromptMenu() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="px-3 py-1 flex-row gap-1">
          <Text className="text-xs font-semibold">Copy AI Prompt</Text>
          <ChevronDownOutline width={14} height={14} />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-2"
        align={Platform.OS === 'web' ? 'start' : 'center'}
      >
        <View className="flex-col gap-1">
          {PROMPT_OPTIONS.map((option) => (
            <PromptMenuItem key={option.id} option={option} />
          ))}
        </View>
      </PopoverContent>
    </Popover>
  )
}
