import { supabase, generateEmbedding } from './_db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { query, user_id, threshold = 0.5, limit = 3 } = req.body;
    if (!query || !user_id) {
      return res.status(400).json({ error: 'Missing query or user_id' });
    }

    const embedding = await generateEmbedding(query);

    const { data, error } = await supabase.rpc('match_documents', {
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: limit,
      filter_user_id: user_id
    });

    if (error) throw error;

    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('Query Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
