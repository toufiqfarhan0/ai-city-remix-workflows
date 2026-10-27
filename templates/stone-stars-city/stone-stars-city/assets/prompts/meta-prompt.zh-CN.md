# 微缩地标城市场景

把{{city}}做成一座可交互的三维微缩城市：漂浮在空中的童话岛屿，正中央只有一个主角，即{{landmark}}。地标用程序化的 Three.js 几何体搭建（尖塔、窗户、瓦片、肋条、装饰等重复细节用实例化），不下载模型或纹理。它必须是全场最高、最精细的物体，正面朝向观众（+Z），并放进村庄留出的空地（世界坐标 x −9..9，z −10..11）。周围是：{{village}}；外围任何东西都不能和地标比高，也不能挡住主立面。风格：{{style}}。光线：{{lighting}}。交互：{{interaction}}。

在复制出的项目里工作。替换 `src/scene/landmark.js`，保持返回结构 `{ group, hitTarget, animate(t), stats, lightingMaterials, views }`，其中 `views.facade` 和 `views.crown` 是两个近景章节的相机锚点（`target`、`from`、`hold`）。`src/scene/village.js` 只按城市需要调整（颜色、屋顶形状、树木、广场），保留它的固定种子布局和环路曲线。所有可见文字写进 `src/i18n/strings.json`（英文和简体中文，键相同；影片画面文字用英文），并把 `index.html` 的 `<title>` 改成英文标题。按 `references/method.md` 里的地标接口和换主题清单检查，并查看 `references/verification.md` 列出的影片帧：自动检查不判断构图。

网页和影片共用同一个世界。影片 24 秒，分四个 6 秒章节：{{chapters}}。画面是时间的纯函数（`script(t)`）：相机关键帧来自 `src/scene/config.js`，光线在 9 到 21 秒之间从黄金时刻走到星光，动态元素用同一个 t。可见控件必须操作真实的场景状态。提供桌面和影片用的完整 16:9 版式、手机紧凑版式和 345×345 嵌入，减少动态效果时不自动播放，输出一个离线 HTML，运行时不联网、不用存储、不调用模型。内置配乐只在用户操作后开始，默认静音。注明城市是示意，并非测绘。{{extraPrompt}}
