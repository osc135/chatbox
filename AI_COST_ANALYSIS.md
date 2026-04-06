# AI Cost Analysis

## Development & Testing Costs

Costs incurred during the one-week development sprint.

| Category | Details | Estimated Cost |
|----------|---------|---------------|
| LLM API (OpenAI GPT-4o) | ~600 API calls for feature testing, chess opponent validation, quiz/vocab generation testing | ~$8.50 |
| LLM API (Anthropic Claude 3.5 Sonnet) | ~200 calls for cross-provider testing and streaming validation | ~$2.40 |
| Total AI spend | | **~$10.90** |

**Token breakdown (estimated):**
- Average input tokens per test call: ~1,200 (system prompt ~700 + conversation history ~500)
- Average output tokens per test call: ~350
- Total input tokens: ~960,000
- Total output tokens: ~280,000

---

## Production Cost Model

### Assumptions

| Variable | Value | Reasoning |
|----------|-------|-----------|
| Average sessions per user per month | 20 | ~1 session per school day |
| Average messages per session | 12 | Mix of short Q&A and longer app interactions |
| Average input tokens per message | 1,400 | System prompt (~800) + history + tools schema (~400) + user message (~200) |
| Average output tokens per message | 300 | Short responses; tool calls are cheap |
| Tool invocations per session | 3 | ~25% of messages trigger a tool |
| Model assumed | GPT-4o ($2.50/M input, $10.00/M output) | Most common provider in deployment |

### Cost per user per month

```
Input:  20 sessions × 12 messages × 1,400 tokens = 336,000 tokens  → $0.84
Output: 20 sessions × 12 messages × 300 tokens  = 72,000 tokens    → $0.72
                                                         Total: ~$1.56/user/month
```

### Projections at Scale

| Scale | Monthly Users | AI Cost | Notes |
|-------|--------------|---------|-------|
| 100 users | 100 | **~$156/mo** | Well within Railway hobby tier; no infra changes needed |
| 1,000 users | 1,000 | **~$1,560/mo** | Scale backend to 2–4 containers; add Redis for session caching |
| 10,000 users | 10,000 | **~$15,600/mo** | Load balance across regions; negotiate OpenAI volume pricing (~20% discount) |
| 100,000 users | 100,000 | **~$156,000/mo** | Switch high-volume sessions to GPT-4o-mini ($0.15/M in, $0.60/M out) for a ~5× reduction |

### Cost Reduction Strategies

**At 10K+ users:**
- Route simple/short responses to GPT-4o-mini — saves ~80% on those calls
- Cache tool schemas in the system prompt rather than regenerating per request
- Summarize long conversation histories before they grow beyond 8K tokens (already implemented via context compaction)

**At 100K users with GPT-4o-mini for 70% of traffic:**
- Blended cost ≈ (0.3 × $1.56 + 0.7 × $0.19) per user = ~$0.60/user/month
- 100K users → **~$60,000/mo**

### Chess Opponent Overhead

Chess opponent LLM calls (moves + analysis) are an additional cost:
- ~8 moves per game average × $0.002/move = ~$0.016/game
- Assuming 3 chess games/user/month: +$0.048/user/month (negligible)
- `super_dumb` difficulty makes zero LLM calls — a free fallback

### Infrastructure (non-AI)

| Scale | Railway / Compute | PostgreSQL | Total Infra |
|-------|-----------------|-----------|------------|
| 100 users | $5/mo (hobby) | Included | $5/mo |
| 1,000 users | $20/mo (2 containers) | $15/mo | $35/mo |
| 10,000 users | $200/mo | $100/mo | $300/mo |
| 100,000 users | $2,000/mo | $500/mo | $2,500/mo |
