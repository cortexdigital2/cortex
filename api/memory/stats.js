import { supabase } from './_db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { user_id } = req.query;
    if (!user_id) {
      return res.status(400).json({ error: 'Missing user_id parameter' });
    }

    const { count, error } = await supabase
      .from('memories')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user_id);

    if (error) throw error;

    return res.status(200).json({ success: true, count: count || 0 });
  } catch (err) {
    console.error('Stats Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
