export default function handler(req, res) {
  const available = [];
  if (process.env.GOOGLE_CLIENT_ID)      available.push("google");
  if (process.env.GITHUB_ID)             available.push("github");
  if (process.env.AZURE_AD_CLIENT_ID)    available.push("azure-ad");
  if (process.env.APPLE_ID)              available.push("apple");
  if (process.env.FACEBOOK_CLIENT_ID)    available.push("facebook");
  if (process.env.DISCORD_CLIENT_ID)     available.push("discord");
  if (process.env.TWITTER_CLIENT_ID)     available.push("twitter");
  if (process.env.LINKEDIN_CLIENT_ID)    available.push("linkedin");
  res.status(200).json(available);
}
