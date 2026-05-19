import { supabase, generateEmbedding } from './_db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { user_id, content, metadata } = req.body;
    if (!user_id || !content) {
      return res.status(400).json({ error: 'Missing user_id or content' });
    }

    const embedding = await generateEmbedding(content);

    const { data, error } = await supabase
      .from('memories')
      .insert({ user_id, content, metadata: metadata || {}, embedding })
      .select();

    if (error) throw error;

    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('Upsert Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
