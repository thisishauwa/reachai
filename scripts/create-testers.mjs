import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

// Load .env.local
const envPath = path.resolve(process.cwd(), ".env.local");
const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
const envVars = Object.fromEntries(
  envContent
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const idx = line.indexOf("=");
      return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
    })
);

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("\n❌ Error: Missing SUPABASE_SERVICE_ROLE_KEY.");
  console.error("Please provide your service_role secret key from Supabase Dashboard:");
  console.error("  Project Settings -> API -> Project API keys -> service_role (secret)\n");
  console.error("Usage:");
  console.error("  SUPABASE_SERVICE_ROLE_KEY=your_secret_key node scripts/create-testers.mjs [count]\n");
  process.exit(1);
}

const count = parseInt(process.argv[2] || "1", 10);
const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEMO_ORG_ID = "00000000-0000-0000-0000-000000000001";
const DEMO_FACILITY_ID = "00000000-0000-0000-0000-000000000010"; // PHC-DEMO

async function main() {
  console.log(`\nCreating ${count} test account(s) on ${supabaseUrl}...`);

  for (let i = 1; i <= count; i++) {
    const email = `${i}@test.com`;
    const password = "password";
    const displayName = `Tester ${i}`;

    // 1. Create or get auth user
    const { data: userData, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    });

    let userId = userData?.user?.id;

    if (createError) {
      if (createError.message.includes("already registered") || createError.message.includes("already exists")) {
        console.log(`ℹ️  ${email} already exists, updating password...`);
        const { data: list } = await supabase.auth.admin.listUsers();
        const existing = list.users.find((u) => u.email === email);
        if (existing) {
          userId = existing.id;
          await supabase.auth.admin.updateUserById(userId, {
            password,
            email_confirm: true,
          });
        }
      } else {
        console.error(`❌ Failed to create ${email}:`, createError.message);
        continue;
      }
    }

    if (!userId) {
      console.error(`❌ Could not resolve user ID for ${email}`);
      continue;
    }

    // 2. Insert profile
    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({ id: userId, display_name: displayName });
    if (profileError) {
      console.error(`⚠️ Profile warning for ${email}:`, profileError.message);
    }

    // 3. Link to facility
    const { error: memberError } = await supabase
      .from("facility_memberships")
      .upsert({
        user_id: userId,
        organization_id: DEMO_ORG_ID,
        facility_id: DEMO_FACILITY_ID,
        role: "clinician",
        is_active: true,
      });
    if (memberError) {
      console.error(`⚠️ Facility membership warning for ${email}:`, memberError.message);
    }

    console.log(`✅ [${i}/${count}] ${email} ready (password: "${password}")`);
  }

  console.log(`\n🎉 Done! Ready to sign in at http://localhost:3001/login`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
