import EmailPassword from "supertokens-web-js/recipe/emailpassword";
import ThirdParty from "supertokens-web-js/recipe/thirdparty";
import EmailVerification from "supertokens-web-js/recipe/emailverification";
import Session from "supertokens-web-js/recipe/session";

const appUrl = typeof window !== "undefined" 
  ? window.location.origin 
  : process.env.NEXT_PUBLIC_APP_URL ?? "https://upt-portal.vercel.app";

export const frontendConfig = {
  appInfo: {
    appName: "UPT Portal",
    apiDomain: appUrl,
    websiteDomain: appUrl,
    apiBasePath: "/api/auth",
    websiteBasePath: "/auth",
  },
  recipeList: [
    EmailPassword.init(),
    ThirdParty.init(),
    EmailVerification.init(),
    Session.init(),
  ],
};