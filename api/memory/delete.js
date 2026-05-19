import { supabase } from './_db.js';

export default async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { id, user_id } = req.body;
    if (!user_id) {
      return res.status(400).json({ error: 'Missing user_id' });
    }

    let query = supabase.from('memories').delete().eq('user_id', user_id);

    if (id) {
      query = query.eq('id', id);
    }

    const { data, error } = await query.select();

    if (error) throw error;

    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('Delete Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
