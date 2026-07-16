/**
 * Integration provider registry.
 * Add a provider here + a validation case in /api/connect/[provider]
 * and it becomes connectable across the platform.
 */

export type ProviderField = {
  key: string;
  label: string;
  placeholder: string;
};

export type Provider = {
  id: string;
  name: string;
  icon: string;
  desc: string;
  tokenUrl: string;
  tokenHelp: string;
  fields: ProviderField[];
  /** false = we store it but can't verify against an API (e.g. AWS without SDK) */
  apiVerified: boolean;
};

export const PROVIDERS: Provider[] = [
  {
    id: "vercel",
    name: "Vercel",
    icon: "▲",
    desc: "Serverless functions, edge network, preview URLs",
    tokenUrl: "https://vercel.com/account/settings/tokens",
    tokenHelp: "Create a token, any scope, no expiry needed",
    fields: [{ key: "token", label: "Vercel Access Token", placeholder: "vercel_…" }],
    apiVerified: true,
  },
  {
    id: "netlify",
    name: "Netlify",
    icon: "◆",
    desc: "Static hosting, forms, split testing",
    tokenUrl: "https://app.netlify.com/user/applications#personal-access-tokens",
    tokenHelp: "New access token → copy it",
    fields: [{ key: "token", label: "Personal Access Token", placeholder: "nfp_…" }],
    apiVerified: true,
  },
  {
    id: "cloudflare",
    name: "Cloudflare",
    icon: "☁️",
    desc: "Pages, Workers, global edge network",
    tokenUrl: "https://dash.cloudflare.com/profile/api-tokens",
    tokenHelp: "Create Token → use the 'Edit Cloudflare Workers' template",
    fields: [{ key: "token", label: "API Token", placeholder: "Your Cloudflare API token" }],
    apiVerified: true,
  },
  {
    id: "railway",
    name: "Railway",
    icon: "🚂",
    desc: "Databases, Redis, containers",
    tokenUrl: "https://railway.app/account/tokens",
    tokenHelp: "Create an account token",
    fields: [{ key: "token", label: "Account Token", placeholder: "Your Railway token" }],
    apiVerified: true,
  },
  {
    id: "supabase",
    name: "Supabase",
    icon: "⚡",
    desc: "Postgres, auth, storage for your apps",
    tokenUrl: "https://supabase.com/dashboard/account/tokens",
    tokenHelp: "Generate new token",
    fields: [{ key: "token", label: "Access Token", placeholder: "sbp_…" }],
    apiVerified: true,
  },
  {
    id: "razorpay",
    name: "Razorpay",
    icon: "💳",
    desc: "Accept payments in your generated apps",
    tokenUrl: "https://dashboard.razorpay.com/app/website-app-settings/api-keys",
    tokenHelp: "Generate Key → copy Key ID and Key Secret",
    fields: [
      { key: "keyId", label: "Key ID", placeholder: "rzp_live_… or rzp_test_…" },
      { key: "keySecret", label: "Key Secret", placeholder: "Your key secret" },
    ],
    apiVerified: true,
  },
  {
    id: "whatsapp",
    name: "WhatsApp API",
    icon: "💬",
    desc: "Order buttons and notifications",
    tokenUrl: "https://developers.facebook.com/apps/",
    tokenHelp: "Meta for Developers → your app → WhatsApp → API token",
    fields: [{ key: "token", label: "Access Token", placeholder: "EAAG…" }],
    apiVerified: true,
  },
  {
    id: "aws",
    name: "AWS",
    icon: "🟧",
    desc: "S3, Lambda, CloudFront, full cloud",
    tokenUrl: "https://console.aws.amazon.com/iam/home#/security_credentials",
    tokenHelp: "IAM → Security credentials → Create access key",
    fields: [
      { key: "keyId", label: "Access Key ID", placeholder: "AKIA…" },
      { key: "keySecret", label: "Secret Access Key", placeholder: "Your secret access key" },
    ],
    apiVerified: false,
  },
];

export function getProvider(id: string): Provider | undefined {
  return PROVIDERS.find((p) => p.id === id);
}
