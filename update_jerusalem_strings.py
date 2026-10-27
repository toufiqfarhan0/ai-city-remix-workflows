import json

file_path = "jerusalem-film/src/i18n/strings.json"
data = json.load(open(file_path, encoding='utf-8'))

# Update EN
data["en"]["title"] = "Jerusalem in Stone: From Daybreak to Starlight"
data["en"]["campaign"] = "AI CITY REMIX"
data["en"]["tagline"] = "Pick a City. Let AI Tell Its Story."
data["en"]["titleLine1"] = "Jerusalem"
data["en"]["titleLine2"] = "in miniature."
data["en"]["subtitle1"] = "Ancient stones & living parks."
data["en"]["subtitle2"] = "A persistent day-to-starlight journey."
data["en"]["eyebrow"] = "JERUSALEM, REIMAGINED"
data["en"]["explore"] = "Explore Jerusalem in 3D"
data["en"]["loading"] = "Crafting a little Jerusalem…"
data["en"]["statusDay"] = "DAYBREAK OVER THE OLD CITY"
data["en"]["statusNight"] = "STARLIGHT OVER JERUSALEM"
data["en"]["landmarksLabel"] = "SACRED STONES & PUBLIC PARKS"
data["en"]["snapshotTitle"] = "Your miniature Jerusalem, captured."
data["en"]["snapshotAlt"] = "Your miniature Jerusalem snapshot"
data["en"]["sceneAria"] = "Interactive 3D miniature Jerusalem"
data["en"]["homeAria"] = "Jerusalem Miniature home"

data["en"]["lmEmpireName"] = "Jaffa Gate"
data["en"]["lmEmpireArea"] = "OLD CITY PORTAL"
data["en"]["lmEmpireText"] = "Jerusalem’s grand Ottoman portal in pale limestone, welcoming pilgrims and travellers since 1538."
data["en"]["lmEmpireShort"] = "Jaffa Gate"

data["en"]["lmChryslerName"] = "Teddy Park & Gardens"
data["en"]["lmChryslerArea"] = "VALLEY CONNECTIVE SEAM"
data["en"]["lmChryslerText"] = "Terraced public gardens and splash fountains connecting the ancient ramparts to the living city."
data["en"]["lmChryslerShort"] = "Teddy Park"

data["en"]["lmOneWorldName"] = "Tower of David"
data["en"]["lmOneWorldArea"] = "THE CITADEL"
data["en"]["lmOneWorldText"] = "The ancient stone citadel guarding the western ridge, uniting Herodian towers and Ottoman minarets."
data["en"]["lmOneWorldShort"] = "Tower David"

data["en"]["lmCentralParkName"] = "Holy Sepulchre"
data["en"]["lmCentralParkArea"] = "CHRISTIAN QUARTER"
data["en"]["lmCentralParkText"] = "Historic Romanesque twin domes and rotunda preserving centuries of faith and pilgrimage."
data["en"]["lmCentralParkShort"] = "Sepulchre"

data["en"]["lmTimesSquareName"] = "Western Wall"
data["en"]["lmTimesSquareArea"] = "TEMPLE MOUNT PLAZA"
data["en"]["lmTimesSquareText"] = "Monumental Herodian golden limestone ashlar wall, sacred heart of prayer and whispered devotion."
data["en"]["lmTimesSquareShort"] = "Kotel"

data["en"]["lmFlatironName"] = "Dome of the Rock"
data["en"]["lmFlatironArea"] = "TEMPLE MOUNT"
data["en"]["lmFlatironText"] = "The gilded octagonal sanctuary crowning the plateau with turquoise tiles and golden brilliance."
data["en"]["lmFlatironShort"] = "Dome Rock"

data["en"]["lmRockefellerName"] = "Al-Aqsa Mosque"
data["en"]["lmRockefellerArea"] = "SOUTHERN PRECINCT"
data["en"]["lmRockefellerText"] = "Silver-lead dome and columned congregational hall set amidst centuries-old stone pines."
data["en"]["lmRockefellerShort"] = "Al-Aqsa"

data["en"]["lmVesselName"] = "Mount of Olives"
data["en"]["lmVesselArea"] = "EASTERN RIDGE"
data["en"]["lmVesselText"] = "Panoramic terraced ridge of ancient olive groves, looking across the Kidron Valley to the golden city."
data["en"]["lmVesselShort"] = "Mt Olives"

# Update ZH
data["zh-CN"]["title"] = "石之耶路撒冷：从晨光到繁星"
data["zh-CN"]["campaign"] = "AI城市重混大赛"
data["zh-CN"]["tagline"] = "选择一座城市，让AI讲述它的故事。"
data["zh-CN"]["titleLine1"] = "耶路撒冷"
data["zh-CN"]["titleLine2"] = "微缩微景。"
data["zh-CN"]["subtitle1"] = "千年古石与绿意公园。"
data["zh-CN"]["subtitle2"] = "日升月落的永恒旅程。"
data["zh-CN"]["eyebrow"] = "重绘耶路撒冷"
data["zh-CN"]["explore"] = "三维探索耶路撒冷"
data["zh-CN"]["loading"] = "正在精心雕琢耶路撒冷微缩模型…"
data["zh-CN"]["statusDay"] = "老城破晓"
data["zh-CN"]["statusNight"] = "星垂耶路撒冷"
data["zh-CN"]["landmarksLabel"] = "神圣古石与公共花园"
data["zh-CN"]["snapshotTitle"] = "定格您的微缩耶路撒冷。"
data["zh-CN"]["snapshotAlt"] = "微缩耶路撒冷快照"
data["zh-CN"]["sceneAria"] = "交互式三维微缩耶路撒冷"
data["zh-CN"]["homeAria"] = "耶路撒冷微缩主页"

data["zh-CN"]["lmEmpireName"] = "雅法门"
data["zh-CN"]["lmEmpireArea"] = "老城门户"
data["zh-CN"]["lmEmpireText"] = "宏伟的奥斯曼浅色石灰岩城门，自1538年起迎接着四方朝圣者与旅人。"
data["zh-CN"]["lmEmpireShort"] = "雅法门"

data["zh-CN"]["lmChryslerName"] = "泰迪公园与花园"
data["zh-CN"]["lmChryslerArea"] = "山谷连接带"
data["zh-CN"]["lmChryslerText"] = "阶梯式梯园与喷泉，将古老城垣与生机盎然的现代城市温柔相织。"
data["zh-CN"]["lmChryslerShort"] = "泰迪公园"

data["zh-CN"]["lmOneWorldName"] = "大卫塔"
data["zh-CN"]["lmOneWorldArea"] = "老城城堡"
data["zh-CN"]["lmOneWorldText"] = "守卫西侧山脊的巍峨古石城堡，融汇了希律巨塔与奥斯曼宣礼塔。"
data["zh-CN"]["lmOneWorldShort"] = "大卫塔"

data["zh-CN"]["lmCentralParkName"] = "圣墓教堂"
data["zh-CN"]["lmCentralParkArea"] = "基督徒区"
data["zh-CN"]["lmCentralParkText"] = "古老的罗马式双穹顶与明亮圆堂，见证着千百年来的朝圣与守护。"
data["zh-CN"]["lmCentralParkShort"] = "圣墓教堂"

data["zh-CN"]["lmTimesSquareName"] = "西墙"
data["zh-CN"]["lmTimesSquareArea"] = "圣殿山脚"
data["zh-CN"]["lmTimesSquareText"] = "巨大的希律时期金色石灰岩石墙，低语祈愿与心灵寄托的神圣中心。"
data["zh-CN"]["lmTimesSquareShort"] = "西墙"

data["zh-CN"]["lmFlatironName"] = "圆顶清真寺"
data["zh-CN"]["lmFlatironArea"] = "圣殿山"
data["zh-CN"]["lmFlatironText"] = "高踞山巅的鎏金八角圣殿，流淌着青绿釉彩与金色光辉。"
data["zh-CN"]["lmFlatironShort"] = "圆顶寺"

data["zh-CN"]["lmRockefellerName"] = "阿克萨清真寺"
data["zh-CN"]["lmRockefellerArea"] = "南部庭院"
data["zh-CN"]["lmRockefellerText"] = "银灰铅包穹顶与多柱式礼拜大殿，静静伫立于古老石松之间。"
data["zh-CN"]["lmRockefellerShort"] = "阿克萨"

data["zh-CN"]["lmVesselName"] = "橄榄山"
data["zh-CN"]["lmVesselArea"] = "东部山脊"
data["zh-CN"]["lmVesselText"] = "布满古老橄榄树的壮阔山脊，隔着汲沦谷遥望整座圣城的光芒。"
data["zh-CN"]["lmVesselShort"] = "橄榄山"

with open(file_path, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print('Updated jerusalem-film/src/i18n/strings.json successfully!')
