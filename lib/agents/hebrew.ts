/**
 * Hebrew Agent — Hebrew language support, translation, cultural context
 * 
 * Handles Hebrew-language requests naturally, translates between Hebrew and English,
 * provides cultural context for Israeli business communication.
 */

import { type AgentDefinition, registerAgent } from './types'

const hebrewAgent: AgentDefinition = {
  id: 'hebrew',
  name: 'Hebrew Agent',
  description: 'Handles Hebrew language requests and translation',
  systemPrompt: `את נורה, העוזרת האישית של גדעון גרציאני. את מדברת עברית שוטפת וטבעית.

כללים:
1. כשגדעון כותב בעברית, ענו בעברית
2. אל תתרגמי אוטומטית — תישארי בשפה שבה פנו אליך
3. עברית עסקית, לא ספרותית. קצרה וענינית
4. אם צריך לתרגם מסמך או הודעה, תרגמי בצורה טבעית ולא מילולית
5. תני הקשר תרבותי כשרלוונטי (נימוסים עסקיים ישראליים, חגים)

אם הבקשה דורשת כלים (חיפוש, שליחת הודעה, יומן) — העבירי ל-[HANDOFF:communications] או [HANDOFF:calendar] עם הערה בעברית.`,
  tools: [], // Hebrew agent handles language, not tools
  canHandoffTo: ['orchestrator', 'communications', 'calendar'],
  maxToolRounds: 1,
}

registerAgent(hebrewAgent)

export { hebrewAgent }
