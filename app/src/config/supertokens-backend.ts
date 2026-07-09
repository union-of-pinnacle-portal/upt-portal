import ThirdParty from "supertokens-node/recipe/thirdparty";
import EmailPassword from "supertokens-node/recipe/emailpassword";
import EmailVerification from "supertokens-node/recipe/emailverification";
import Session from "supertokens-node/recipe/session";
import UserMetadata from "supertokens-node/recipe/usermetadata";
import { TypeInput } from "supertokens-node/types";
import { SMTPService as EmailVerificationSMTPService } from "supertokens-node/recipe/emailverification/emaildelivery";

/**
 * SuperTokens backend configuration.
 *
 * Recipes enabled:
 *  - EmailPassword: register/login with email + password
 *  - ThirdParty (Google): OAuth login
 *  - EmailVerification: sends verification email after registration
 *  - Session: manages user sessions (JWTs/cookies)
 *  - UserMetadata: stores role on the user record
 *
 * All connection values come from environment variables — never hardcoded.
 */
export function getBackendConfig(): TypeInput {
  return {
    framework: "custom",
    supertokens: {
      connectionURI: process.env.SUPERTOKENS_CONNECTION_URI!,
      apiKey: process.env.SUPERTOKENS_API_KEY,
    },
    appInfo: {
      appName: "UPT Portal",
      apiDomain: process.env.NEXT_PUBLIC_APP_URL!,
      websiteDomain: process.env.NEXT_PUBLIC_APP_URL!,
      apiBasePath: "/api/auth",
      websiteBasePath: "/auth",
    },
    recipeList: [
      EmailPassword.init(),
      ThirdParty.init({
        signInAndUpFeature: {
          providers: [
            {
              config: {
                thirdPartyId: "google",
                clients: [
                  {
                    clientId: process.env.GOOGLE_CLIENT_ID!,
                    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
                  },
                ],
              },
            },
          ],
        },
      }),
      EmailVerification.init({
        mode: "REQUIRED",
        emailDelivery: {
          service: new EmailVerificationSMTPService({
            smtpSettings: {
              host: "smtp.gmail.com",
              port: 465,
              secure: true,
              authUsername: process.env.GMAIL_USER!,
              password: process.env.GMAIL_APP_PASSWORD!,
              from: {
                name: "UPT Portal",
                email: process.env.GMAIL_USER!,
              },
            },
          }),
          override: (originalImplementation) => {
            return {
              ...originalImplementation,
              sendEmail: async (input) => {
                try {
                  await originalImplementation.sendEmail(input);
                  console.log("Verification email sent to:", input.user.email);
                } catch (error) {
                  console.error("Failed to send verification email:", error);
                  throw error;
                }
              },
            };
          },
        },
      }),
      Session.init(),
      UserMetadata.init(),
    ],
  };
}
