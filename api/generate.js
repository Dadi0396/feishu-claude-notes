export const config = { runtime: 'edge' };

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const FEISHU_APP_ID = process.env.FEISHU_APP_ID;
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET;

async function getFeishuToken() {
  const res = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: FEISHU_APP_ID, app_secret: FEISHU_APP_SECRET })
  });
  const data = await res.json();
  if (data.code !== 0) throw new Error('飞书token获取失败: ' + data.msg);
  return data.tenant_access_token;
}

async function generateNote(productName) {
  const prompt = `你是一名资深小红书带货笔记创作者，擅长写出高转化率的爆款笔记。

请为产品「${productName}」生成1篇高质量小红书带货笔记。

【标题要求】
- 20字以内
- 含emoji
- 有悬念或情绪冲击力

【正文排版要求】
- 开头1-2句钩子，制造共鸣或悬念
- 每段2-3行，段落之间空一行
- 重点卖点单独成段，前面加emoji符号
- 中间穿插真实使用场景描述
- 结尾一句行动号召（如：姐妹闭眼冲/链接在主页）
- 全文自然融入5-8个emoji
- 总字数200-300字
- 口语化、有闺蜜感、真实不浮夸

请严格按以下JSON格式返回，不要有任何其他内容：
{"title": "标题内容", "content": "正文内容，段落之间用\\n\\n分隔"}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  const data = await res.json();
  if (!data.content) throw new Error('Claude API调用失败: ' + JSON.stringify(data));
  const text = data.content[0].text.trim();
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

async function writeToFeishu(token, appToken, tableId, recordId, note) {
  const res = await fetch(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/${recordId}`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fields: {
          '标题': note.title,
          '正文': note.content
        }
      })
    }
  );
  const result = await res.json();
  if (result.code !== 0) throw new Error('写入飞书失败: ' + result.msg);
  return result;
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const body = await req.json();
    const { app_token, table_id, record_id, product_name } = body;

    if (!product_name) {
      return new Response(JSON.stringify({ error: '产品名不能为空' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 1. 生成笔记
    const note = await generateNote(product_name);

    // 2. 获取飞书token
    const token = await getFeishuToken();

    // 3. 写回飞书
    await writeToFeishu(token, app_token, table_id, record_id, note);

    return new Response(JSON.stringify({ success: true, title: note.title }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
