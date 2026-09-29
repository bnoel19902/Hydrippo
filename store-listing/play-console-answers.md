# Play Console forms: suggested answers

Check every answer against the live form. Google changes wording, and these assume the app ships exactly as built: no analytics or ads SDKs, RevenueCat for billing, optional Health Connect sync (write-only hydration) and an optional hot-day boost that asks the US National Weather Service for a forecast.

## Health apps declaration (Policy > App content > Health apps)

- Hydrippo is a **health and fitness** app (not medical). Under Health and fitness, check **Nutrition and weight management** (hydration tracking). Leave every Medical box unchecked.
- Health Connect data types: **Nutrition > Hydration, write only**. Hydrippo does not request any read permission.
- Suggested explanation (paste into the Hydration box):
  > Hydrippo is a water tracker. When the user turns on "Health Connect sync" in Settings (it is off by default), Hydrippo writes each drink the user logs, with its time and volume, as a Hydration record so other health apps the user allows can see their water intake. Hydrippo only writes hydration data and never reads any data from Health Connect. When the user edits or deletes a drink in Hydrippo, the matching record is updated or removed. The data is not sent to us or anyone else.
- Privacy policy: the Play listing's privacy URL must show the same policy Health Connect opens from the app (both are built from store-listing/privacy-policy.md, so they match).
- The store description includes the "not a medical device" disclaimer near the top (already in listing.md).

## Data safety (Policy > App content > Data safety)

- Does your app collect or share any of the required user data types? **Yes**: purchases, and an approximate location when the optional hot-day boost is on.
- Collected: **Financial info > Purchase history** (via Google Play Billing and RevenueCat).
  - Shared with third parties? **No** (RevenueCat acts as a service provider on our behalf).
  - Processed ephemerally? **No**.
  - Required or optional? **Optional** (only if the user buys Plus).
  - Purpose: **App functionality**.
- Collected: **Location > Approximate location** (only when the user turns on the hot-day boost; the app sends the rounded center of their ZIP code's area to api.weather.gov for the forecast).
  - Shared with third parties? **No**. The transfer happens because the user turned the feature on and entered a ZIP code, and the screen says what it does. If a Google reviewer says otherwise, change this to Shared: Yes (National Weather Service, for app functionality).
  - Processed ephemerally? **Yes** (we never receive or store it).
  - Required or optional? **Optional**.
  - Purpose: **App functionality**.
- Hydration logs, goal, weight: **not collected** (they never leave the device). Writing to Health Connect is on-device, so it isn't collection either.
- Is data encrypted in transit? **Yes** (RevenueCat and Google Play use HTTPS).
- Can users request deletion? **Yes**: Settings > Your data > Erase all data removes on-device data; purchase records are kept by Google Play.
- Before submitting, compare with RevenueCat's own Google Play data safety guide in their docs in case their SDK version needs extra lines (for example an app user ID).

## Content rating questionnaire

- Category: Utility, productivity, communication or other.
- No violence, sexual content, gambling, user-to-user chat or sharing of a user's location with other users. Expect **Everyone** (IARC 3+).

## Target audience and content

- Target age: **18 and over** (simplest; avoids the Families policy). The app is fine for teens to use, but don't target them.
- Does the app appeal to children? **No** (Drip is cute, but the app is a health tool for adults; answer honestly if Google's reviewer asks).

## Ads

- Contains ads? **No**.

## App access

- All features available without login? **Yes**. Plus features can be tested with a license tester account (see the launch runbook).

## Government / financial / news declarations

- Not applicable. Answer **No** to each.
