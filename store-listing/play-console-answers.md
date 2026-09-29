# Play Console forms: suggested answers

Check every answer against the live form. Google changes wording, and these assume the app ships exactly as built (no Health Connect, no analytics SDK, RevenueCat for billing).

## Health apps declaration (Policy > App content > Health apps)

- Hydrippo is a **health and fitness** app (not medical). Pick the feature that covers nutrition/hydration tracking in the list shown.
- It does **not** use Health Connect or any health permissions in v1.
- The store description includes the "not a medical device" disclaimer near the top (already in listing.md).

## Data safety (Policy > App content > Data safety)

- Does your app collect or share any of the required user data types? **Yes**, only because of purchases.
- Collected: **Financial info > Purchase history** (via Google Play Billing and RevenueCat).
  - Shared with third parties? **No** (RevenueCat acts as a service provider on our behalf).
  - Processed ephemerally? **No**.
  - Required or optional? **Optional** (only if the user buys Plus).
  - Purpose: **App functionality**.
- Hydration logs, goal, weight: **not collected** (they never leave the device).
- Is data encrypted in transit? **Yes** (RevenueCat and Google Play use HTTPS).
- Can users request deletion? **Yes**: Settings > Your data > Erase all data removes on-device data; purchase records are kept by Google Play.
- Before submitting, compare with RevenueCat's own Google Play data safety guide in their docs in case their SDK version needs extra lines (for example an app user ID).

## Content rating questionnaire

- Category: Utility, productivity, communication or other.
- No violence, sexual content, gambling, user-to-user chat or location sharing. Expect **Everyone** (IARC 3+).

## Target audience and content

- Target age: **18 and over** (simplest; avoids the Families policy). The app is fine for teens to use, but don't target them.
- Does the app appeal to children? **No** (Drip is cute, but the app is a health tool for adults; answer honestly if Google's reviewer asks).

## Ads

- Contains ads? **No**.

## App access

- All features available without login? **Yes**. Plus features can be tested with a license tester account (see GUS_HANDOFF.md, Billing).

## Government / financial / news declarations

- Not applicable. Answer **No** to each.
