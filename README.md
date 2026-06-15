# CPA 理论研习室

个人使用的 CPA 理论知识整理、学习与审核工具。教材是事实依据，教学视频只在后台用于理解讲解思路，产品不提供视频播放、转写稿或时间戳功能。

## 本地启动

### 后端

```powershell
cd api
python -m venv .venv
.\.venv\Scripts\python -m pip install -e ".[dev]"
Copy-Item .env.example .env
.\.venv\Scripts\python -m uvicorn app.main:app --reload
```

需要自动拆解教材或后台理解教学素材时，在 `api/.env` 中配置 `OPENAI_API_KEY`。

### 前端

```powershell
cd web
npm install
npm run dev
```

访问 `http://localhost:3000`。

完成首次安装后，也可以在项目根目录运行：

```powershell
.\start.ps1
```

## 内容状态

知识卡依次经过 `AI草稿 → 待审核 → 已确认`。缺少教材页码、3星以上讲解不完整或会计分录借贷不平衡时，后端会拒绝提交审核。
