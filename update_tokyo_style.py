import json

# Load MiniMax direction
minimax_data = json.load(open('C:/Users/toufi/.gemini/antigravity-ide/brain/a333b73f-3b88-4fc0-9e6a-dffd7f592122/scratch/tokyo_minimax.json', encoding='utf-8'))
direction = json.loads(minimax_data['response'])

# Existing style for palettes
existing_style = json.load(open('tokyo-film/src/city/style.json', encoding='utf-8'))

# Configure Tokyo style
tokyo_style = {
    "city": "Tokyo",
    "driveSide": "left",
    "place": {
        "en": "Shinjuku, Tokyo",
        "zh-CN": "东京新宿"
    },
    "film": {
        "duration": 72,
        "posterAt": 14,
        "tod": [0.04, 0.97],
        "turns": 1,
        "wide": 0.17,
        "near": 0.42,
        "order": [
            "Tokyo Metropolitan Government Main Building 1",
            "Shinjuku Park Tower",
            "Shinjuku Nomura Building",
            "Shinjuku Center Building",
            "Shinjuku Mitsui Building",
            "Mode Gakuen Cocoon Tower",
            "JR Shinjuku Miraina Tower",
            "Tokyu Kabukicho Tower"
        ]
    },
    "ground": existing_style["ground"],
    "facades": existing_style["facades"],
    "roofs": existing_style["roofs"],
    "glass": "#2a425a",
    "windowLit": "#ffe899",
    "windowWarm": "#ffbf59",
    "trim": "#ede6d8",
    "tree": "#3d7a2e",
    "treeDark": "#2a541e",
    "trunk": "#5c3d26",
    "lamp": "#fff3c2",
    "cars": [
        "#f5cc27", # Tokyo yellow taxi
        "#1b6938", # Tokyo green taxi
        "#111214", # Black Crown sedan
        "#e8e5db", # White commuter
        "#c72828", # Red courier
        "#2454a3"  # Blue compact
    ],
    "notes": direction["notes"]
}

with open('tokyo-film/src/city/style.json', 'w', encoding='utf-8') as f:
    json.dump(tokyo_style, f, indent=2, ensure_ascii=False)

print('Updated tokyo-film/src/city/style.json successfully!')
