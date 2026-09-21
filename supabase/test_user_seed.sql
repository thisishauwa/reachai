-- ====================================================================
-- CREATE TEST ACCOUNT(S) IN SUPABASE AUTH + PUBLIC SCHEMA
-- ====================================================================
-- This creates 1@test.com with password 'password', fully confirmed,
-- with an active clinician profile and facility membership at PHC-DEMO.

create extension if not exists pgcrypto;

do $$
declare
  v_user_id uuid;
  v_email text := '1@test.com';
  v_password text := 'password';
  v_encrypted_password text;
begin
  -- Generate bcrypt hash for password
  v_encrypted_password := crypt(v_password, gen_salt('bf', 10));

  -- Check if user exists
  select id into v_user_id from auth.users where email = v_email;

  if v_user_id is null then
    v_user_id := gen_random_uuid();
    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change_token_new,
      recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      v_email,
      v_encrypted_password,
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"display_name":"Tester 1"}'::jsonb,
      now(),
      now(),
      '',
      '',
      ''
    );

    -- Also insert into auth.identities so Supabase GoTrue recognizes email auth
    insert into auth.identities (
      id,
      user_id,
      provider_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) values (
      v_user_id,
      v_user_id,
      v_email,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email),
      'email',
      now(),
      now(),
      now()
    ) on conflict do nothing;

  else
    -- Update existing user password and confirm email
    update auth.users
    set encrypted_password = v_encrypted_password,
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        updated_at = now()
    where id = v_user_id;
  end if;

  -- Create public profile
  insert into public.profiles (id, display_name)
  values (v_user_id, 'Tester 1')
  on conflict (id) do update set display_name = excluded.display_name;

  -- Link user to demo facility PHC-DEMO
  insert into public.facility_memberships (user_id, organization_id, facility_id, role, is_active)
  values (
    v_user_id,
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000010',
    'clinician',
    true
  )
  on conflict (user_id, facility_id) do update set is_active = true;

  raise notice 'Test user % created with ID % and linked to PHC-DEMO', v_email, v_user_id;
end $$;

-- ====================================================================
-- BATCH SCRIPT FOR ALL 90 TESTERS (1@test.com ... 90@test.com)
-- Uncomment the block below when ready to generate all 90 accounts!
-- ====================================================================
/*
do $$
declare
  v_user_id uuid;
  v_email text;
  v_password text := 'password';
  v_encrypted_password text;
  i int;
begin
  v_encrypted_password := crypt(v_password, gen_salt('bf', 10));

  for i in 1..90 loop
    v_email := i || '@test.com';
    select id into v_user_id from auth.users where email = v_email;

    if v_user_id is null then
      v_user_id := gen_random_uuid();
      insert into auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        email_change_token_new,
        recovery_token
      ) values (
        '00000000-0000-0000-0000-000000000000',
        v_user_id,
        'authenticated',
        'authenticated',
        v_email,
        v_encrypted_password,
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('display_name', 'Tester ' || i),
        now(),
        now(),
        '',
        '',
        ''
      );

      insert into auth.identities (
        id,
        user_id,
        provider_id,
        identity_data,
        provider,
        last_sign_in_at,
        created_at,
        updated_at
      ) values (
        v_user_id,
        v_user_id,
        v_email,
        jsonb_build_object('sub', v_user_id::text, 'email', v_email),
        'email',
        now(),
        now(),
        now()
      ) on conflict do nothing;

    else
      update auth.users
      set encrypted_password = v_encrypted_password,
          email_confirmed_at = coalesce(email_confirmed_at, now()),
          updated_at = now()
      where id = v_user_id;
    end if;

    insert into public.profiles (id, display_name)
    values (v_user_id, 'Tester ' || i)
    on conflict (id) do update set display_name = excluded.display_name;

    insert into public.facility_memberships (user_id, organization_id, facility_id, role, is_active)
    values (
      v_user_id,
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000010',
      'clinician',
      true
    )
    on conflict (user_id, facility_id) do update set is_active = true;
  end loop;

  raise notice 'Created 90 test accounts (1@test.com through 90@test.com)';
end $$;
*/
