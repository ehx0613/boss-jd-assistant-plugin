# Boss JD 打招呼助手

一个 Chrome 浏览器插件 MVP，用于在 Boss 直聘岗位页识别岗位 JD，结合本地简历和千问大模型生成可直接发给 HR 的打招呼话术。

## 功能

- 识别 Boss 岗位页中的岗位名称、公司名称和岗位 JD
- 支持截图识别 JD
- 支持多次截图自动合并岗位职责和任职要求
- 支持手动编辑识别后的 JD
- 支持上传 PDF / DOCX / TXT 简历并提取文本
- 简历默认保存在浏览器本地
- 调用千问文本模型生成 3 个打招呼版本
- 一键复制生成结果
- 不自动发送消息给 HR
- 服务端不长期保存简历或截图内容

## 项目结构

```text
boss-jd-assistant-extension/
  extension/
    manifest.json       Chrome 插件配置
    popup.html          插件弹窗页面
    popup.css           插件弹窗样式
    popup.js            插件弹窗交互逻辑
    content.js          Boss 页面 JD 提取脚本
    background.js       截图能力
  server/
    server.mjs          本地 Node 服务，负责调用千问和提取简历文本
  .env.example          环境变量示例
  .gitignore            忽略本地密钥文件
  README.md             使用说明
```

## 环境要求

### 必需

- Windows / macOS / Linux
- Node.js 18 或以上
- Chrome 浏览器
- 阿里云百炼 DashScope API Key

### 可选

- `pdftotext`

如果你需要上传 PDF 简历，建议安装 `pdftotext`。当前开发机上使用的是 TeX Live 附带的 `pdftotext`。

DOCX 简历不需要额外 npm 包，服务端会通过系统能力解包并读取正文内容。

## 千问模型配置

本项目默认使用阿里云百炼 OpenAI 兼容接口：

```text
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
QWEN_TEXT_MODEL=qwen-plus
QWEN_VL_MODEL=qwen-vl-plus
```

如果你的百炼控制台要求使用业务空间专属域名，可以把 `QWEN_BASE_URL` 改成控制台提供的地址。

## 本地启动服务

进入项目目录：

```powershell
cd C:\Users\18130\Desktop\简历\jd\boss-jd-assistant-extension
```

复制环境变量文件：

```powershell
copy .env.example .env
```

编辑 `.env`，填入你的 DashScope API Key：

```text
DASHSCOPE_API_KEY=sk-your-dashscope-api-key
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
QWEN_TEXT_MODEL=qwen-plus
QWEN_VL_MODEL=qwen-vl-plus
PORT=8787
```

启动本地服务：

```powershell
node server/server.mjs
```

服务默认地址：

```text
http://127.0.0.1:8787
```

检查服务是否正常：

```powershell
Invoke-RestMethod http://127.0.0.1:8787/health
```

正常会返回类似：

```json
{
  "ok": true,
  "provider": "qwen",
  "textModel": "qwen-plus",
  "vlModel": "qwen-vl-plus"
}
```

## Chrome 插件加载方式

1. 打开 Chrome 浏览器
2. 地址栏输入：

```text
chrome://extensions/
```

3. 回车进入扩展程序管理页面
4. 打开右上角的“开发者模式”
5. 点击左上角“加载已解压的扩展程序”
6. 选择插件目录：

```text
C:\Users\18130\Desktop\简历\jd\boss-jd-assistant-extension\extension
```

注意：请选择最后的 `extension` 文件夹，不是外层的 `boss-jd-assistant-extension`。

加载成功后，可以点击 Chrome 右上角拼图图标，把“Boss JD 打招呼助手”固定到工具栏。

## 使用流程

1. 启动本地服务：

```powershell
node server/server.mjs
```

2. 打开 Boss 直聘岗位详情页
3. 点击 Chrome 工具栏中的插件图标
4. 优先点击“识别岗位”
5. 检查岗位名称、公司名称和岗位 JD 是否正确
6. 如果 JD 不完整，可以使用“截图识别”
7. 如果单张截图只能截到岗位职责或任职要求，可以分两次截图，插件会自动合并
8. 上传 PDF / DOCX / TXT 简历，或直接粘贴简历文本
9. 检查并编辑简历文本
10. 点击“生成话术”
11. 选择一个版本并点击“复制”
12. 手动粘贴到 Boss 聊天框

## JD 识别说明

### 识别岗位

“识别岗位”会通过页面 DOM 读取岗位信息，通常比截图识别更完整。插件会尝试保留：

- 岗位职责
- 职位描述
- 工作职责
- 任职要求
- 任职资格
- 岗位要求

并尽量过滤：

- 公司介绍
- 公司简介
- 工商信息
- 关于我们
- 成立时间
- 公司网址

### 截图识别

“截图识别”只识别当前屏幕可见区域。如果当前截图没有覆盖完整 JD，可能只识别到岗位职责或任职要求。

推荐做法：

1. 先截包含岗位职责的区域
2. 再滚动到任职要求区域
3. 再点一次“截图识别”
4. 插件会自动把两段合并到当前 JD 文本框

## 简历上传说明

支持格式：

- PDF
- DOCX
- TXT

暂不支持旧版 `.doc`。如果你的简历是 `.doc`，请用 Word 或 WPS 另存为 `.docx`，或者导出为 PDF 后上传。

上传后的简历文本会写入插件的“我的简历”文本框，并保存在浏览器本地。服务端只做当次文本提取，不长期保存文件或简历内容。

## 生成话术风格

当前默认模仿“一段式自我推荐”格式：

```text
您好，我是[姓名]，[学校/专业/年级]，想投递[岗位名称]。此前在[实习/工作]中参与[真实工作内容]。项目方面，我做过[项目经历]，熟悉[相关能力]。岗位中提到的[JD匹配点]，与我的经历比较匹配；我可[到岗时间/实习周期]，期待进一步沟通。
```

生成时会刻意区分：

- 实习 / 工作经历
- 校园 / 课程项目
- 个人 / 研究项目
- 教育背景 / 技能

约束包括：

- 不把校园项目说成实习
- 不把多个不同来源的经历混成一个工作场景
- 不夸大简历中不存在的经历、年限、技术栈或身份
- 实习经历优先用于证明协作、文档、项目推进和业务交付
- 项目经历单独用“项目方面”承接

## 常见问题

### 1. 插件加载后没有显示

点击 Chrome 右上角拼图图标，找到“Boss JD 打招呼助手”，点击固定按钮。

### 2. 点击生成时报错 `Missing DASHSCOPE_API_KEY`

说明没有配置 `.env`，或者 `.env` 中没有填写 `DASHSCOPE_API_KEY`。

### 3. 点击生成时报连接失败

确认本地服务已启动：

```powershell
node server/server.mjs
```

并检查：

```powershell
Invoke-RestMethod http://127.0.0.1:8787/health
```

### 4. 截图识别漏掉任职要求

截图只能识别当前可见区域。请滚动到任职要求区域，再点一次“截图识别”。插件会自动合并多次截图结果。

### 5. 识别岗位混入公司介绍

可以手动编辑 JD 文本框，删除无关内容。后续也可以继续优化页面选择器。

### 6. PDF 上传失败

确认本机安装了 `pdftotext`，或将简历另存为 DOCX / TXT 后上传。

## 隐私说明

- 简历默认保存在 Chrome 浏览器本地存储
- 服务端不长期保存简历、截图或生成结果
- 服务端只负责当次调用千问模型和提取文件文本
- 插件不会自动发送消息给 HR
- 生成内容必须由用户确认后手动复制发送

## GitHub 上传注意事项

不要上传真实 `.env` 文件。仓库中只保留 `.env.example`。

推荐上传内容：

- `extension/`
- `server/`
- `.env.example`
- `.gitignore`
- `README.md`

不要上传：

- `.env`
- API Key
- 个人隐私简历文件

## 后续优化方向

- 增加“清空 JD / 重新开始”按钮
- 增加 JD 完整性检查
- 增加“只生成最终推荐版”
- 支持多个简历版本
- 增加简历结构化解析
- 支持更多招聘平台
