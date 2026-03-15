# 飞书多维表格 × Claude 小红书笔记自动生成

## 部署步骤

### 第一步：上传代码到 GitHub
1. 登录 GitHub（github.com）
2. 点右上角 "+" → "New repository"
3. 仓库名填：feishu-claude-notes
4. 选 Public，点 "Create repository"
5. 把这个文件夹里的所有文件上传进去

### 第二步：部署到 Vercel
1. 登录 vercel.com（用 GitHub 账号登录）
2. 点 "Add New Project"
3. 选择 feishu-claude-notes 仓库
4. 点 "Deploy"

### 第三步：配置环境变量
在 Vercel 项目设置 → Environment Variables 添加：
- CLAUDE_API_KEY = sk-ant-api03-xxx（你的Claude API Key）
- FEISHU_APP_ID = cli_a93f3c2afcb9dcba
- FEISHU_APP_SECRET = Aec1Ft2nijcAdByKHxREByoldRmnHRmq

### 第四步：获取 Webhook 地址
部署成功后，Vercel 会给你一个地址，格式是：
https://feishu-claude-notes.vercel.app/api/generate

### 第五步：配置飞书多维表格
1. 在多维表格添加字段：产品名、标题1~5、正文1~5
2. 打开"自动化"→"新建自动化"
3. 触发条件：记录创建 或 字段"产品名"修改时
4. 执行动作：发送 HTTP 请求
   - 地址：https://你的域名.vercel.app/api/generate
   - 方法：POST
   - Body：
     {
       "app_token": "VbNXbiPkiaT7dCsWC6ocSO0jncc",
       "table_id": "tblG5TzdI1v0FC8n",
       "record_id": "{{recordId}}",
       "product_name": "{{产品名}}"
     }
