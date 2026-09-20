// Supabase Edge Function: create-patient-account
// Securely provisions a new patient auth account using the Supabase Service Role Key on the server side.
// The frontend calls this function without ever possessing or exposing the service-role key.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { email, password, fullName, patientId, caregiverId, relationship } = await req.json();

    if (!email || !password || !fullName) {
      return new Response(
        JSON.stringify({ error: 'Missing required credentials (email, password, fullName)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Create Patient User in Supabase Auth Admin API
    const { data: userData, error: createError } = await supabaseClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: 'patient',
      },
    });

    if (createError) {
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const newUserId = userData.user.id;

    // 2. Link Patient Profile
    await supabaseClient.from('profiles').upsert({
      id: newUserId,
      full_name: fullName,
      role: 'patient',
      setup_completed: true,
    });

    // 3. Update Patient record with Auth user_id
    if (patientId) {
      await supabaseClient.from('patients').update({ user_id: newUserId }).eq('id', patientId);
    }

    // 4. Link Caregiver-Patient as Primary
    if (caregiverId && patientId) {
      await supabaseClient.from('caregiver_patients').upsert({
        caregiver_id: caregiverId,
        patient_id: patientId,
        relationship: relationship || 'Primary Caregiver',
        status: 'active',
        is_primary: true,
      });
    }

    return new Response(
      JSON.stringify({ success: true, userId: newUserId, email }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Internal Server Error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
