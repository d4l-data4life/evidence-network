// Seeds a single demo user so username/password login is testable without a
// signup flow. Runs at container startup (see docker-entrypoint.sh) and via
// `npm run db:seed`.
//
// Written as plain ESM using the `pg` driver directly (rather than the Prisma
// client) so it needs no TypeScript loader or query engine at runtime — just
// `pg` + `bcryptjs`, both present in the production image. Idempotent: upserts
// on the unique `username`.

import "dotenv/config";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import bcrypt from "bcryptjs";
import pg from "pg";

const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "password123";

// Resolve the active deployment profile so the seeded branding/i18n settings
// match the instance identity (e.g. DEPLOYMENT=champs). Mirrors lib/deployment.
function activeProfile() {
  const url = new URL("../lib/deployment/profiles.json", import.meta.url);
  const profiles = JSON.parse(readFileSync(url, "utf8"));
  const key = (process.env.DEPLOYMENT || "default").toLowerCase();
  return profiles[key] ?? profiles.default;
}

async function main() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    // admin = SUPERUSER (bootstrap admin); coord = COORDINATOR (to exercise the
    // approval queue, since no one may approve their own submissions).
    const { rows } = await client.query(
      `INSERT INTO "User" ("id", "username", "name", "email", "passwordHash", "systemRole", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, 'SUPERUSER'::"SystemRole", CURRENT_TIMESTAMP)
       ON CONFLICT ("username")
       DO UPDATE SET "passwordHash" = EXCLUDED."passwordHash", "systemRole" = 'SUPERUSER'::"SystemRole", "updatedAt" = CURRENT_TIMESTAMP
       RETURNING "id", "username";`,
      [randomUUID(), ADMIN_USERNAME, "Admin Arnold", "admin@evidence-network.local", passwordHash],
    );
    const user = rows[0];
    console.log(`Seeded admin user (SUPERUSER): ${user.username} (id=${user.id})`);
    console.log(`  login with  username: ${ADMIN_USERNAME}  password: ${ADMIN_PASSWORD}`);

    const coordHash = await bcrypt.hash("password123", 10);
    await client.query(
      `INSERT INTO "User" ("id", "username", "name", "email", "passwordHash", "systemRole", "updatedAt")
       VALUES ($1, 'coord', 'Coordinator Casey', 'coord@evidence-network.local', $2, 'COORDINATOR'::"SystemRole", CURRENT_TIMESTAMP)
       ON CONFLICT ("username")
       DO UPDATE SET "passwordHash" = EXCLUDED."passwordHash", "systemRole" = 'COORDINATOR'::"SystemRole", "updatedAt" = CURRENT_TIMESTAMP;`,
      [randomUUID(), coordHash],
    );
    console.log("Seeded coordinator user: coord / password123");

    const userHash = await bcrypt.hash("password123", 10);
    await client.query(
      `INSERT INTO "User" ("id", "username", "name", "email", "passwordHash", "systemRole", "updatedAt")
       VALUES ($1, 'researcher', 'Researcher Robin', 'researcher@evidence-network.local', $2, 'USER'::"SystemRole", CURRENT_TIMESTAMP)
       ON CONFLICT ("username")
       DO UPDATE SET "passwordHash" = EXCLUDED."passwordHash", "systemRole" = 'USER'::"SystemRole", "updatedAt" = CURRENT_TIMESTAMP;`,
      [randomUUID(), userHash],
    );
    console.log("Seeded normal user: researcher / password123");

    // Default branding (singleton), initialised from the active deployment profile.
    const profile = activeProfile();
    await client.query(
      `INSERT INTO "Setting" ("id","appName","tagline","landingIntro","logoHeight","accentColor","defaultLocale","enabledLocales","updatedAt")
       VALUES ('app',$1,$2,$3,$4,$5,$6,$7,CURRENT_TIMESTAMP)
       ON CONFLICT ("id") DO NOTHING;`,
      [
        profile.appName,
        profile.tagline,
        profile.landingIntro,
        profile.logoHeight ?? 48,
        profile.accentColor ?? "#A6CE39",
        profile.defaultLocale ?? "en",
        profile.enabledLocales ?? ["en", "pt-BR", "es"],
      ],
    );
    console.log(`Seeded branding from deployment profile: ${process.env.DEPLOYMENT || "default"}`);

    await seedExampleContent(client, user.id);
    console.log("Seeded example site, dataset (+version), and study.");
  } finally {
    await client.end();
  }
}

// Example content owned by the admin user. Idempotent via fixed ids
// (ON CONFLICT DO NOTHING). Study + dataset are AUTHENTICATED so they show up in
// the browse lists for any signed-in user.
async function seedExampleContent(client, ownerId) {
  // Site
  await client.query(
    `INSERT INTO "Site" ("id","slug","legalName","abbreviation","country","orgType","description","ownerId","updatedAt")
     VALUES ('seed-site','demo-data-partner','Demo Data Partner','DDP','NL','ACADEMIC'::"SiteOrgType",
             'Example data partner seeded for the demo.',$1,CURRENT_TIMESTAMP)
     ON CONFLICT ("id") DO NOTHING;`,
    [ownerId],
  );
  await client.query(
    `INSERT INTO "SiteMembership" ("id","siteId","userId","role")
     VALUES ('seed-site-mem','seed-site',$1,'OWNER'::"SiteRole")
     ON CONFLICT ("id") DO NOTHING;`,
    [ownerId],
  );

  // Dataset (+ one version)
  await client.query(
    `INSERT INTO "Dataset" ("id","slug","siteId","name","abbreviation","sourceType","careSetting",
                            "therapeuticAreas","sourceCodingSystems","description","visibility","approvalStatus","updatedAt")
     VALUES ('seed-dataset','demo-ipci','seed-site','Demo IPCI','IPCI','EHR'::"DatasetSourceType",
             ARRAY['PRIMARY_CARE']::"DatasetCareSetting"[],
             ARRAY['cardiology','endocrinology']::text[],
             ARRAY['ICD-10','SNOMED']::text[],
             'Example OMOP primary-care database.','AUTHENTICATED'::"Visibility",'APPROVED'::"ApprovalStatus",CURRENT_TIMESTAMP)
     ON CONFLICT ("id") DO NOTHING;`,
  );
  await client.query(
    `INSERT INTO "DatasetRelease" ("id","datasetId","label","cdmSourceName","cdmVersion",
                                   "vocabularyVersion","sourceReleaseDate","status","updatedAt")
     VALUES ('seed-release','seed-dataset','2024-Q1','Demo IPCI','V5_4'::"CdmVersion",
             'v5.0 31-AUG-23','2024-03-31'::timestamp,'PUBLISHED'::"DatasetReleaseStatus",CURRENT_TIMESTAMP)
     ON CONFLICT ("datasetId","label") DO NOTHING;`,
  );

  // Study (+ owner membership)
  await client.query(
    `INSERT INTO "Study" ("id","slug","title","acronym","description","objective","studyType","designType",
                          "scope","conditions","keywords","status","visibility","approvalStatus","ownerId","updatedAt")
     VALUES ('seed-study','demo-comparative-safety','Comparative safety of DPP-4 inhibitors','DEMO-DPP4',
             'Example population-level estimation study seeded for the demo.',
             'Estimate the comparative risk of a safety outcome.',
             'POPULATION_LEVEL_ESTIMATION'::"StudyType",'COHORT'::"StudyDesignType",
             ARRAY['SAFETY','EFFECTIVENESS']::"StudyScope"[],
             ARRAY['type 2 diabetes']::text[],
             ARRAY['safety','comparative effectiveness']::text[],
             'DESIGN_FINALIZED'::"StudyStatus",'AUTHENTICATED'::"Visibility",'APPROVED'::"ApprovalStatus",$1,CURRENT_TIMESTAMP)
     ON CONFLICT ("id") DO NOTHING;`,
    [ownerId],
  );
  await client.query(
    `INSERT INTO "StudyMembership" ("id","studyId","userId","role","isOwner")
     VALUES ('seed-study-mem','seed-study',$1,'LEAD'::"StudyRole",true)
     ON CONFLICT ("id") DO NOTHING;`,
    [ownerId],
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
