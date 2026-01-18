# GetDeck

GetDeck 是一个浏览器端的 Master Duel 卡组识别工具，无需服务器即可识别卡组。

上传卡组截图后GetDeck 会自动识别每张卡片以供查看，还可以一键生成卡组码，方便导入游戏使用。

你可以在这里直接使用： [https://get-deck.tech](https://get-deck.tech)

备用地址： [https://get-deck.vercel.app/](https://get-deck.vercel.app/)

## 主要功能：
- 所有识别和处理均在本地浏览器完成，不上传图片
- 识别准确率高，速度快，支持桌面和移动端
- 支持 Master Duel 卡组码导出

技术栈包括 Next.js、React、Tailwind CSS、ONNX Runtime Web、Rust WebAssembly、pHash 等。

识别流程：上传截图后，先进行图像预处理，再用 YOLO 检测卡片位置，裁剪卡图并提取感知哈希，最后与本地数据库比对，输出识别结果。

卡片哈希数据通过 CI/CD 自动生成，保证数据库及时更新。卡片图片直接从游戏资源获取，保证与游戏一致。

## 自行部署：
1. 安装依赖：npm install
2. 启动开发：npm run dev
3. 构建生产：npm run build

所有处理均在本地完成，图片不会被收集。

## 致谢

- [百鸽 (ygocdb.com)](https://ygocdb.com) - 提供卡片详细信息查询 API
