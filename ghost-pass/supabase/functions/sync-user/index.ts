import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('sync-user function called')
    
    const requestBody = await req.json()
    console.log('Request body:', JSON.stringify(requestBody))
    
    const { userId, email, role = 'USER' } = requestBody

    if (!userId || !email) {
      console.error('Missing userId or email')
      return new Response(
        JSON.stringify({ error: 'Missing userId or email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    console.log('Supabase URL:', supabaseUrl)
    console.log('Service key exists:', !!supabaseServiceKey)
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase environment variables')
      return new Response(
        JSON.stringify({ error: 'Server configuration error: Missing Supabase credentials' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase admin client using service role key
    const supabaseAdmin = createClient(
      supabaseUrl,
      supabaseServiceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    console.log('Checking if user exists in public.users:', userId)

    // Check if user already exists in public.users
    const { data: existingUser, error: checkError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('id', userId)
      .maybeSingle()

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking existing user:', checkError)
      return new Response(
        JSON.stringify({ error: 'Database error checking user', details: checkError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (existingUser) {
      console.log('User already exists:', userId)
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'User already synced',
          userId,
          alreadyExists: true
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Checking if user exists in auth.users:', userId)

    // Check if user exists in auth.users
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId)

    if (authError || !authUser.user) {
      // User doesn't exist in auth.users, create them
      console.log('Creating user in auth.users:', userId)
      
      const { data: newAuthUser, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
        id: userId,
        email: email,
        email_confirm: true,
        user_metadata: {
          synced_from: 'be-valid',
          synced_at: new Date().toISOString()
        }
      })

      if (createAuthError) {
        console.error('Error creating auth user:', createAuthError)
        return new Response(
          JSON.stringify({ error: 'Failed to create auth user', details: createAuthError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log('Auth user created successfully:', newAuthUser.user.id)
    } else {
      console.log('User already exists in auth.users:', userId)
    }

    // Now create user in public.users table
    console.log('Creating user in public.users:', userId, 'with role:', role)
    
    const { error: insertError } = await supabaseAdmin
      .from('users')
      .insert({
        id: userId,
        email: email,
        role: role,
        created_at: new Date().toISOString(),
      })

    if (insertError) {
      // Check if it's a duplicate key error (user was created by another request)
      if (insertError.code === '23505') {
        console.log('User already exists (created by concurrent request):', userId)
        return new Response(
          JSON.stringify({
            success: true,
            message: 'User already synced (concurrent request)',
            userId,
            alreadyExists: true
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      console.error('Error creating public user:', insertError)
      return new Response(
        JSON.stringify({ error: 'Failed to create user record', details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('User successfully synced:', userId)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'User synced successfully',
        userId
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error in sync-user function:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error.message || String(error)
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
