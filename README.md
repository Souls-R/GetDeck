# GetDeck

[![Bilibili](https://img.shields.io/badge/Bilibili-fb7299?style=flat&logo=bilibili&logoColor=white)](https://space.bilibili.com/501465442)
[![Discord](https://img.shields.io/badge/Discord-5865F2?style=flat&logo=discord&logoColor=white)](https://discord.gg/gcPUgPBGw3)

GetDeck 是一个 Master Duel 卡组截图识别，卡组码生成以及分享的工具。

上传卡组截图后GetDeck 会自动识别每张卡片以供查看，还可以一键生成卡组码，方便导入游戏使用，也能生成带二维码与卡组码的分享截图。

你可以在这里直接使用： [https://get-deck.com](https://get-deck.com)

## 主要功能
- 所有识别和处理均在本地浏览器完成，不上传图片
- 识别准确率高，速度快，支持桌面和移动端
- 支持 Master Duel 卡组码导出与分享

技术栈包括 Next.js、React、Tailwind CSS、ONNX Runtime Web、Rust WebAssembly、pHash 等。

识别流程：上传截图后，先进行图像预处理，再用 YOLO 检测卡片位置，裁剪卡图并提取感知哈希，最后与本地数据库比对，输出识别结果。

卡片哈希数据通过 CI/CD 自动生成，保证数据库及时更新。卡片图片直接从游戏资源获取，保证与游戏一致。

## 体验优化

#### 性能加载
*   通过模型持久缓存、并行加载和动态CDN选择，减少重复下载与初始化等待。
*   首屏加载优化，允许用户在模型没有完全加载时就开始上传图片和查看结果，减少等待时间。
*   区分读取本地模型、下载模型和初始化引擎，下载时显示进度。

#### 交互与操作
*   优化了画布的拖拽与缩放操作，并为移动端提供了专门的手势支持，方便查看截图细节。
*   支持使用键盘方向键在识别的卡片间快速导航，提升桌面端操作效率。
*   记忆用户在卡片列表中的滚动位置，无需在返回时重新寻找。
*   自动判断是否需要裁剪，引导用户更精确地选择识别区域，提高识别成功率。

## 自行部署：
1. 安装依赖：npm install
2. 启动开发：npm run dev
3. 构建生产：npm run build

所有处理均在本地完成，图片不会被收集。

## 模型缓存与更新

识别模型保存在浏览器 Cache API 中，不设置过期时间。同版本再次访问直接读取本地模型，只有版本变化、缓存损坏或缓存被浏览器/用户清理时才重新下载。浏览器禁用存储或空间不足时仍可识别，但无法保证下次免下载。

`public/model-manifest.json` 独立维护 `version`、`url` 和文件的 `sha256`。进入识别页会检查这个小文件；检查失败时优先使用上次成功缓存的版本，否则使用随应用构建的版本信息。模型缓存不代表整站离线可用，运行时和卡片数据库仍需加载。

更新模型时：
1. 上传新模型，推荐使用独立版本文件名，保留旧版地址，不要覆盖同版本文件。
2. 计算新文件的 SHA-256，更新清单中的三个字段，再发布网站。普通功能/卡片数据更新无需修改模型版本。
3. 新模型完整下载并通过校验后才写入缓存和清理旧模型。当前版本兼容现有 `best.onnx?v=2026-01-20` 地址；切换为独立文件后，可在模型服务器配置 `Cache-Control: public, max-age=31536000, immutable`。清单应配置不缓存或每次重新验证，不能使用长期 immutable 缓存。

本地缓存逻辑检查：`node --test tests/modelLoader.test.mjs`；类型检查：`npx tsc --noEmit`。

## 致谢

- [百鸽 (ygocdb.com)](https://ygocdb.com) - 提供卡片详细信息查询 API
- [YAML Yugi](https://github.com/DawnbrandBots/yaml-yugi) - 提供多语言卡片数据
