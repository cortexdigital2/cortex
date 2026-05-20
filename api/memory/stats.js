import { supabase, activeProviderName } from './_db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { user_id } = req.query;
    if (!user_id) {
      return res.status(400).json({ error: 'Missing user_id parameter' });
    }

    // 1. Obter contagem
    const { count, error } = await supabase
      .from('memories')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user_id);

    if (error) throw error;

    // 2. Obter última gravação
    const { data: latest, error: latestError } = await supabase
      .from('memories')
      .select('created_at')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false })
      .limit(1);

    const lastUpdated = latest && latest.length > 0 ? latest[0].created_at : null;

    return res.status(200).json({
      success: true,
      count: count || 0,
      provider: activeProviderName,
      lastUpdated
    });
  } catch (err) {
    console.error('Stats Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
