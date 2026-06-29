import { describe, expect, it } from 'vitest'
import { parseCommand } from './parser'

describe('parseCommand — empty / unknown', () => {
  it('empty string returns unknown', () => {
    const r = parseCommand('')
    expect(r.intent).toBe('unknown')
    expect(r.raw).toBe('')
  })

  it('whitespace-only returns unknown', () => {
    expect(parseCommand('   ').intent).toBe('unknown')
  })

  it('gibberish that matches no verb returns unknown', () => {
    expect(parseCommand('the quick brown fox').intent).toBe('unknown')
  })

  it('preserves the raw transcript on unknown', () => {
    const raw = 'qwertyuiop'
    expect(parseCommand(raw).raw).toBe(raw)
  })
})

describe('parseCommand — briefing', () => {
  it('"brief me" returns briefing', () => {
    const r = parseCommand('brief me')
    expect(r.intent).toBe('briefing')
  })

  it('case-insensitive briefing', () => {
    expect(parseCommand('Brief Me').intent).toBe('briefing')
  })

  it('"brief me on deals" still routes to briefing', () => {
    expect(parseCommand('brief me on deals today').intent).toBe('briefing')
  })
})

describe('parseCommand — open_window', () => {
  it('opens perplexity with no query', () => {
    const r = parseCommand('open perplexity')
    expect(r.intent).toBe('open_window')
    if (r.intent !== 'open_window') return
    expect(r.params.target).toBe('perplexity')
    expect(r.params.opts).toEqual({})
  })

  it('opens perplexity ask <query>', () => {
    const r = parseCommand('open perplexity ask cap rates in saginaw')
    expect(r.intent).toBe('open_window')
    if (r.intent !== 'open_window') return
    expect(r.params.target).toBe('perplexity')
    expect(r.params.opts.query).toBe('cap rates in saginaw')
  })

  it('opens gmail / costar / loopnet / pipedrive without query', () => {
    for (const t of ['gmail', 'costar', 'loopnet', 'pipedrive']) {
      const r = parseCommand(`open ${t}`)
      expect(r.intent).toBe('open_window')
      if (r.intent !== 'open_window') return
      expect(r.params.target).toBe(t)
      expect(r.params.opts).toEqual({})
    }
  })

  it('non-perplexity targets ignore the ask phrase', () => {
    const r = parseCommand('open gmail ask anything')
    expect(r.intent).toBe('open_window')
    if (r.intent !== 'open_window') return
    expect(r.params.opts).toEqual({})
  })

  it('unknown target falls through to unknown', () => {
    expect(parseCommand('open spotify').intent).toBe('unknown')
  })
})

describe('parseCommand — add_to_bucket', () => {
  it('"add to bucket: foo" extracts text', () => {
    const r = parseCommand('add to bucket: review Watermills note')
    expect(r.intent).toBe('add_to_bucket')
    if (r.intent !== 'add_to_bucket') return
    expect(r.params.text).toBe('review Watermills note')
  })

  it('"add to bucket foo" (no colon) also works', () => {
    const r = parseCommand('add to bucket call Bruce')
    expect(r.intent).toBe('add_to_bucket')
    if (r.intent !== 'add_to_bucket') return
    expect(r.params.text).toBe('call Bruce')
  })

  it('case-insensitive ADD TO BUCKET', () => {
    const r = parseCommand('ADD TO BUCKET test item')
    expect(r.intent).toBe('add_to_bucket')
  })
})

describe('parseCommand — remind', () => {
  it('"remind me about X in N minutes" parses minutes', () => {
    const r = parseCommand('remind me about Watermills wire in 30 minutes')
    expect(r.intent).toBe('remind')
    if (r.intent !== 'remind') return
    expect(r.params.text).toBe('Watermills wire')
    expect(r.params.minutes).toBe(30)
  })

  it('hours convert to minutes', () => {
    const r = parseCommand('remind me to call Adir in 2 hours')
    expect(r.intent).toBe('remind')
    if (r.intent !== 'remind') return
    expect(r.params.minutes).toBe(120)
  })

  it('days convert to minutes', () => {
    const r = parseCommand('remind me of escrow in 1 day')
    expect(r.intent).toBe('remind')
    if (r.intent !== 'remind') return
    expect(r.params.minutes).toBe(60 * 24)
  })

  it('"min" / "mins" / "hr" / "hrs" / "minute" all accepted', () => {
    expect(parseCommand('remind me to ping in 5 mins').intent).toBe('remind')
    expect(parseCommand('remind me to ping in 5 min').intent).toBe('remind')
    expect(parseCommand('remind me to ping in 1 hr').intent).toBe('remind')
    expect(parseCommand('remind me to ping in 1 minute').intent).toBe('remind')
  })

  it('remind without timer falls through', () => {
    expect(parseCommand('remind me about Watermills').intent).toBe('unknown')
  })
})

describe('parseCommand — delegate (tell)', () => {
  it('"tell <name> to <text>" parses', () => {
    const r = parseCommand('tell Steven to draft the LOI tonight')
    expect(r.intent).toBe('delegate')
    if (r.intent !== 'delegate') return
    expect(r.params.name).toBe('Steven')
    expect(r.params.text).toBe('draft the LOI tonight')
  })

  it('multi-word names work', () => {
    const r = parseCommand('tell Bruce Smoler to send escrow letter')
    expect(r.intent).toBe('delegate')
    if (r.intent !== 'delegate') return
    expect(r.params.name).toBe('Bruce Smoler')
  })

  it('hyphenated names work', () => {
    const r = parseCommand('tell Mary-Ann to follow up')
    expect(r.intent).toBe('delegate')
    if (r.intent !== 'delegate') return
    expect(r.params.name).toBe('Mary-Ann')
  })
})

describe('parseCommand — call', () => {
  it('"call <name>" parses', () => {
    const r = parseCommand('call Doron Sagiv')
    expect(r.intent).toBe('call')
    if (r.intent !== 'call') return
    expect(r.params.name).toBe('Doron Sagiv')
  })

  it('case-insensitive', () => {
    const r = parseCommand('Call Bruce')
    expect(r.intent).toBe('call')
  })
})

describe('parseCommand — email', () => {
  it('"email <name>: <subj> / <body>" splits subject and body', () => {
    const r = parseCommand('email Adir: Watermills update / closing pushed to Friday')
    expect(r.intent).toBe('email')
    if (r.intent !== 'email') return
    expect(r.params.name).toBe('Adir')
    expect(r.params.subject).toBe('Watermills update')
    expect(r.params.body).toBe('closing pushed to Friday')
  })

  it('subject only (no slash) leaves body empty', () => {
    const r = parseCommand('email Bruce: hello')
    expect(r.intent).toBe('email')
    if (r.intent !== 'email') return
    expect(r.params.subject).toBe('hello')
    expect(r.params.body).toBe('')
  })

  it('comma works as separator after name', () => {
    const r = parseCommand('email Steven, weekly digest')
    expect(r.intent).toBe('email')
    if (r.intent !== 'email') return
    expect(r.params.name).toBe('Steven')
    expect(r.params.subject).toBe('weekly digest')
  })
})

describe('parseCommand — search', () => {
  it('"search <text>" parses', () => {
    const r = parseCommand('search retail comps in Saginaw')
    expect(r.intent).toBe('search')
    if (r.intent !== 'search') return
    expect(r.params.text).toBe('retail comps in Saginaw')
  })

  it('case-insensitive', () => {
    const r = parseCommand('Search Bay Valley')
    expect(r.intent).toBe('search')
  })
})

describe('parseCommand — order matters', () => {
  it('briefing wins over search', () => {
    expect(parseCommand('brief me').intent).toBe('briefing')
  })

  it('open beats search even though "open" looks generic', () => {
    expect(parseCommand('open gmail').intent).toBe('open_window')
  })

  it('add to bucket wins over search', () => {
    expect(parseCommand('add to bucket: search later').intent).toBe('add_to_bucket')
  })
})
