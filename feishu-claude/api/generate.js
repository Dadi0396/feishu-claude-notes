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

async function generateNotes(productName) {
  const prompt = `你是一名资深小红书带货笔记创作者。请为产品「${productName}」生成5篇小红书带货笔记。

要求：
- 每篇包含标题和正文
- 标题要有吸引力，可以用emoji
- 正文口语化，有感染力，突出产品卖点
- 风格参考：情绪共鸣、反向种草、场景化、闺蜜安利、囤货攻略

请严格按以下JSON格式返回，不要有其他内容：
[
  {"title": "标题1", "content": "正文1"},
  {"title": "标题2", "content": "正文2"},
  {"title": "标题3", "content": "正文3"},
  {"title": "标题4", "content": "正文4"},
  {"title": "标题5", "content": "正文5"}
]`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  const data = await res.json();
  if (!data.content) throw new Error('Claude API调用失败');
  const text = data.content[0].text.trim();
  return JSON.parse(text);
}

async function writeToFeishu(token, appToken, tableId, recordId, notes) {
  // 将5篇笔记写入对应字段
  for (let i = 0; i < notes.length; i++) {
    const n = i + 1;
    const fields = {
      [`标题${n}`]: notes[i].title,
      [`正文${n}`]: notes[i].content
    };
    await fetch(`https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/${recordId}`, {
      method: 'PATCH',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields })
    });
  }
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
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    // 1. 生成笔记
    const notes = await generateNotes(product_name);

    // 2. 获取飞书token
    const token = await getFeishuToken();

    // 3. 写回飞书
    await writeToFeishu(token, app_token, table_id, record_id, notes);

    return new Response(JSON.stringify({ success: true, count: notes.length }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
