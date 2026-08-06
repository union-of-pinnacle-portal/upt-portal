/**
 * Dev-only helper: set a user's portal role by email.
 *
 *   npm run set-role -- <email> <general|contributor|committee_chair|committee_head>
 *
 * Role strings are the stored ids, not display names — `contributor` is shown
 * as "Committee Member" and `committee_head` as "Super User" (see lib/roles.ts).
 *
 * Looks the user up in SuperTokens and writes `role` into their UserMetadata,
 * which is the source of truth the app derives rank from. This exists so you
 * can create test users at every rank during development; in production, role
 * assignment happens through the (upcoming) admin UI.
 *
 * Run via the npm script so SuperTokens connection env is loaded from
 * .env.local (node --env-file). Not part of the app build.
 */

const stMod = require("supertokens-node");
const supertokens = stMod.default || stMod;
const EmailPassword = require("supertokens-node/recipe/emailpassword").default;
const ThirdParty = require("supertokens-node/recipe/thirdparty").default;
const Session = require("supertokens-node/recipe/session").default;
const UserMetadata = require("supertokens-node/recipe/usermetadata").default;

const VALID_ROLES = [
  "general",
  "contributor",
  "committee_chair",
  "committee_head",
];

async function main() {
  const [email, role] = process.argv.slice(2);

  if (!email || !VALID_ROLES.includes(role)) {
    console.error(
      "Usage: npm run set-role -- <email> <" + VALID_ROLES.join("|") + ">",
    );
    process.exit(1);
  }
  if (!process.env.SUPERTOKENS_CONNECTION_URI) {
    console.error(
      "SUPERTOKENS_CONNECTION_URI is not set — run through `npm run set-role` " +
        "so .env.local is loaded.",
    );
    process.exit(1);
  }

  supertokens.init({
    framework: "custom",
    supertokens: {
      connectionURI: process.env.SUPERTOKENS_CONNECTION_URI,
      apiKey: process.env.SUPERTOKENS_API_KEY,
    },
    appInfo: {
      appName: "UPT Portal",
      apiDomain: "http://localhost:3000",
      websiteDomain: "http://localhost:3000",
      apiBasePath: "/api/auth",
      websiteBasePath: "/auth",
    },
    recipeList: [
      EmailPassword.init(),
      ThirdParty.init(),
      Session.init(),
      UserMetadata.init(),
    ],
  });

  const users = await supertokens.listUsersByAccountInfo("public", { email });
  if (!users || users.length === 0) {
    console.error(`No user found with email: ${email}`);
    process.exit(1);
  }

  const user = users[0];
  await UserMetadata.updateUserMetadata(user.id, { role });

  console.log(`✓ Set ${email} → role "${role}" (userId ${user.id}).`);
  console.log("  Log out and back in so the new role lands in your session.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
