export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const today = new Date().toLocaleDateString('ja-JP', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'short'
  });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        system: `あなたはAI・セキュリティニュースのキュレーターです。Web検索で最新ニュースを収集し、重要度順Top10をランキングしてください。必ずJSONのみで返答。コードブロックや説明文は不要。{"date":"日付","news":[{"rank":1,"title":"タイトル（日本語）","source":"媒体名","summary":"要約（日本語40字）","importance":"critical|high|medium","reason":"重要理由（15字以内）","url":"URL","category":"AI|Security|Both"}]}`,
        messages: [{ role: 'user', content: `${today}の最新AIニュースとセキュリティトレンドTop10をランキングしてください。` }]
      })
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(500).json({ error: err.error?.message || 'Anthropic API error' });
    }

    const data = await response.json();
    let text = '';
    for (const block of (data.content || [])) {
      if (block.type === 'text') text += block.text;
    }

    text = text.replace(/```json\n?|\n?```/g, '').trim();
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return res.status(500).json({ error: 'Parse error' });

    let jsonStr = match[0]
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/[\u0000-\u001F\u007F]/g, ' ');

    const parsed = JSON.parse(jsonStr);
    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
