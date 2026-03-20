import { createClient } from '@supabase/supabase-js';

// Uses service role key server-side — bypasses RLS safely
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function DELETE(req: Request) {
  try {
    const { session_id } = await req.json();
    if (!session_id) {
      return Response.json({ error: 'session_id is required' }, { status: 400 });
    }

    // Delete from intelligence_reports first (FK safety)
    const { error: reportsErr } = await supabase
      .from('intelligence_reports')
      .delete()
      .eq('session_id', session_id);

    if (reportsErr) {
      return Response.json({ error: reportsErr.message }, { status: 500 });
    }

    // Delete the pipeline run itself
    const { error: runErr } = await supabase
      .from('pipeline_runs')
      .delete()
      .eq('session_id', session_id);

    if (runErr) {
      return Response.json({ error: runErr.message }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (e: any) {
    return Response.json({ error: e.message || 'Unknown error' }, { status: 500 });
  }
}
