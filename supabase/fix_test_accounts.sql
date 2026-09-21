-- ====================================================================
-- FIX ALL TEST ACCOUNTS (1@test.com through 10@test.com)
-- Resolves "Database error querying schema" in Supabase GoTrue Auth
-- Run this in the Supabase Dashboard SQL Editor
-- ====================================================================

create extension if not exists pgcrypto;

-- STEP 1: Fix any existing NULL token columns in auth.users
-- GoTrue throws "Database error querying schema" if any of these columns are NULL instead of ''
update auth.users
set 
  confirmation_token = coalesce(confirmation_token, ''),
  recovery_token = coalesce(recovery_token, ''),
  email_change_token_new = coalesce(email_change_token_new, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  email_change = coalesce(email_change, ''),
  phone_change = coalesce(phone_change, ''),
  phone_change_token = coalesce(phone_change_token, ''),
  reauthentication_token = coalesce(reauthentication_token, ''),
  email_change_confirm_status = coalesce(email_change_confirm_status, 0),
  is_sso_user = coalesce(is_sso_user, false),
  is_anonymous = coalesce(is_anonymous, false)
where email like '%@test.com';

-- STEP 2: Upsert 10 Test Accounts with Hollywood Golden Age Actor names
-- Password: "password" for all
do $$
declare
  v_user_id uuid;
  v_email text;
  v_password text := 'password';
  v_encrypted_password text;
  v_display_name text;
  actor_names text[] := ARRAY[
    'Cary Grant',
    'Katharine Hepburn',
    'Gregory Peck',
    'Tony Curtis',
    'Melvyn Douglas',
    'Greta Garbo',
    'Humphrey Bogart',
    'Lauren Bacall',
    'Audrey Hepburn',
    'James Stewart'
  ];
  i int;
begin
  -- Generate bcrypt salt & hash for password 'password'
  v_encrypted_password := crypt(v_password, gen_salt('bf', 10));

  for i in 1..10 loop
    v_email := i || '@test.com';
    v_display_name := actor_names[i];

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
        recovery_token,
        email_change,
        email_change_token_current,
        phone_change,
        phone_change_token,
        reauthentication_token,
        email_change_confirm_status,
        is_sso_user,
        is_anonymous
      ) values (
        '00000000-0000-0000-0000-000000000000',
        v_user_id,
        'authenticated',
        'authenticated',
        v_email,
        v_encrypted_password,
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('display_name', v_display_name),
        now(),
        now(),
        '', -- confirmation_token must not be null
        '', -- email_change_token_new must not be null
        '', -- recovery_token must not be null
        '', -- email_change must not be null
        '', -- email_change_token_current must not be null
        '', -- phone_change must not be null
        '', -- phone_change_token must not be null
        '', -- reauthentication_token must not be null
        0,
        false,
        false
      );

      -- Insert identity with provider_id = v_user_id::text
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
        gen_random_uuid()::text,
        v_user_id,
        v_user_id::text,
        jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', false, 'phone_verified', false),
        'email',
        now(),
        now(),
        now()
      );

    else
      -- Update existing user: reset password and ensure NO null string columns
      update auth.users
      set 
        encrypted_password = v_encrypted_password,
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
        raw_user_meta_data = jsonb_build_object('display_name', v_display_name),
        updated_at = now(),
        confirmation_token = coalesce(confirmation_token, ''),
        recovery_token = coalesce(recovery_token, ''),
        email_change_token_new = coalesce(email_change_token_new, ''),
        email_change_token_current = coalesce(email_change_token_current, ''),
        email_change = coalesce(email_change, ''),
        phone_change = coalesce(phone_change, ''),
        phone_change_token = coalesce(phone_change_token, ''),
        reauthentication_token = coalesce(reauthentication_token, ''),
        email_change_confirm_status = coalesce(email_change_confirm_status, 0),
        is_sso_user = coalesce(is_sso_user, false),
        is_anonymous = coalesce(is_anonymous, false)
      where id = v_user_id;

      -- Ensure identity exists and is correctly configured
      if not exists (select 1 from auth.identities where user_id = v_user_id and provider = 'email') then
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
          gen_random_uuid()::text,
          v_user_id,
          v_user_id::text,
          jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', false, 'phone_verified', false),
          'email',
          now(),
          now(),
          now()
        );
      else
        update auth.identities
        set 
          provider_id = v_user_id::text,
          identity_data = jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', false, 'phone_verified', false),
          updated_at = now()
        where user_id = v_user_id and provider = 'email';
      end if;

    end if;

    -- Upsert public profile with actor name
    insert into public.profiles (id, display_name)
    values (v_user_id, v_display_name)
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

    raise notice 'Account % (%): ready with password "password"', v_email, v_display_name;
  end loop;

  raise notice 'All 10 test accounts (1@test.com - 10@test.com) successfully repaired!';
end $$;
