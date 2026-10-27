const fs = require('fs');

async function directBerlin() {
  const key = process.env.SANDBASE_API_KEY;
  if (!key) {
    console.error('No SANDBASE_API_KEY found');
    process.exit(1);
  }
  console.log('Sending Berlin direction request to SandBase MiniMax M3.1 Flash...');

  const prompt = `You are the creative film director for the AI City Remix contest.
Selected official Skill: landmark-buildup
Target City: Berlin (lat: 52.5167, lon: 13.3833, city_id: "berlin")
Landmark: Brandenburg Gate (Brandenburger Tor on Pariser Platz)
Contest Brief:
- Angle: "Birth, growth, scars, today & Its future"
- Story: After the build, move from day to dusk to see the landmark in its city; Return to the opening location at the end
- Creative direction: End on the floodlit landmark at dusk
- Duration: 60 to 75 seconds

Historical & Architectural Context:
- Completed 1791 by Carl Gotthard Langhans in sandstone, inspired by the Propylaea of Athens.
- 12 Doric columns forming five passageways; two wing pavilions.
- Crowned by Johann Gottfried Schadow's copper Quadriga (goddess Victoria in chariot drawn by four horses).
- Survived wartime bombardments, stood isolated in the Cold War death strip, witnessed the fall of the Wall in 1989, and stands today as a global monument to peace and unity.

Requirements:
1. title: evocative English film title (<= 75 chars)
2. summary: poetic narrative summary (<= 200 chars)
3. my_city_line: poetic one-liner for Berlin (<= 50 chars)
4. recipe_copy: {
     en: { title, place, eyebrow, text, disclaimer, views: { overview, colonnade, quadriga, dusk } },
     zh-CN: { title, place, eyebrow, text, disclaimer, views: { overview, colonnade, quadriga, dusk } }
   }
5. stages: array of 6 construction & lighting stages with id, from, to, label: { en, zh-CN }
6. narration_segments: exactly 8 spoken English sentences (approx 12-16 words each, paced across 60 seconds from Pariser Platz foundation, Doric colonnade, cold war scars, reunification, to floodlit dusk).
7. director_notes: summary of prompt, MiniMax M3.1 Flash role, 3D stone-by-stone procedural assembly, and human artistic direction.
8. sources: 3 real citations / URLs (e.g. Visit Berlin, UNESCO / Berlin State Monument Authority).

Return ONLY valid JSON. No markdown ticks, no preamble.`;

  try {
    const response = await fetch('https://api.sandbase.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'minimax/minimax-m3.1-flash',
        messages: [
          { role: 'system', content: 'You are an expert film director and German architectural historian. Return pure JSON only.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 8192
      })
    });

    const data = await response.json();
    console.log('Response received.');
    let content = data?.choices?.[0]?.message?.content || '';
    if (!content && data?.choices?.[0]?.message?.reasoning_content) {
      console.log('Reasoning finished, extracting thought / content...');
    }

    fs.writeFileSync('scratch/berlin_minimax.json', JSON.stringify({ prompt, data, content }, null, 2));
    console.log('Saved to scratch/berlin_minimax.json');
  } catch (err) {
    console.error('Error:', err);
  }
}

directBerlin();
