# WhatsApp Business Platform — סיכום עובדות

סיכום מדף ה-overview הרשמי של Meta. רלוונטי כרקע לעבודה עם
[WhatsApp Business Tools MCP](whatsapp-business-tools-mcp.md), כי ה-MCP
עובד מול אותם endpoints ותחת אותן מגבלות.

## ה-APIs

| API | תפקיד |
|---|---|
| **Cloud API** | שליחת הודעות (טקסט, מדיה, אינטראקטיביות), שיחות, וקבוצות |
| **Business Management API** | ניהול WABA ונכסיו: מספרי טלפון, תבניות, אנליטיקס |
| **Marketing Messages API** | הודעות שיווק ממוטבות — עד 9% יותר deliveries מ-Cloud API לתוכן בעל engagement גבוה |
| **Webhooks** | קבלת הודעות נכנסות ועדכוני סטטוס מסירה |
| **Meta Business Agent** | סוכני AI שמנהלים שיחות באופן אוטונומי על WhatsApp |

## בסיס טכני

הפלטפורמה בנויה על **Graph API** מעל HTTP. בקשות ל-`graph.facebook.com`,
תשובות ב-JSON.

```bash
curl 'https://graph.facebook.com/<VERSION>/<PHONE_NUMBER_ID>/messages' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <TOKEN>' \
  -d '{
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": "+16505555555",
    "type": "text",
    "text": { "preview_url": true, "body": "..." }
  }'
```

**אימות:** OAuth access tokens (לא OAuth 2.0), עם permissions שמגבילים גישה
למשאבים ספציפיים.

## משאבי מפתח

- **Business portfolio** — מכיל את ה-WABAs. חובה כדי להשתמש בפלטפורמה.
  אימות ה-portfolio משפיע על throughput ועל סטטוס Official Business Account.
- **WABA** (WhatsApp Business Account) — מייצג את העסק, מכיל מספרי טלפון,
  שמות משתמש ואנליטיקס.
- **מספרי טלפון עסקיים** — אמיתיים או וירטואליים.
- **תבניות הודעות** — נדרשות בדרך כלל לאישור לפני שליחה, והן הסוג היחיד של
  הודעה שאפשר לשלוח מחוץ ל-customer service window. יש להן quality score.

## משאבי בדיקה

כשמתחילים עם Cloud API, **נוצרים אוטומטית WABA של בדיקה ומספר טלפון של בדיקה**.
היתרונות:

- messaging limits מרוככים
- **לא נדרש payment method** כדי לשלוח הודעות תבנית

זו הסיבה שכדאי לפתח מול משאבי הבדיקה ולא מול production.

## מגבלות קצב

### Rate limits ברמת האפליקציה

ברירת מחדל: **200 בקשות בשעה**, per app, per WABA.
ל-WABA פעיל עם מספר טלפון רשום אחד לפחות: **5,000 בקשות בשעה**.

חל, בין היתר, על:

```
GET                  /<WABA_ID>
GET, POST, DELETE    /<WABA_ID>/assigned_users
GET                  /<WABA_ID>/phone_numbers
GET, POST, DELETE    /<WABA_ID>/message_templates
GET, POST, DELETE    /<WABA_ID>/subscribed_apps
```

שים לב: אלה בדיוק ה-endpoints שסוכן AI ייגע בהם כשהוא מגלה חשבונות, מנהל
תבניות ומגדיר webhooks. סוכן שנכנס ללופ יכול לשרוף 200 בקשות במהירות.

בנוסף, ל-Credit Line API יש מגבלה של 5,000 בקשות בשעה.

### מגבלות הודעות

| מגבלה | מה מגביל | נקבע ברמת |
|---|---|---|
| **Messaging limits** | מספר משתמשי WhatsApp ייחודיים שאפשר למסור להם הודעות מחוץ ל-customer service window, בחלון נע של 24 שעות | business portfolio |
| **Throughput** | עד **80 הודעות בשנייה** כברירת מחדל, עם אפשרות לשדרוג קיבולת | מספר טלפון עסקי |
| **Quality rating** | משמש לקביעת שדרוגי throughput אוטומטיים | מספר טלפון עסקי, ולכל תבנית בנפרד |

### Pair rate limit (לאותו משתמש)

- **הודעה אחת כל 6 שניות** לאותו משתמש WhatsApp (~0.17/שנייה, ~10 בדקה, 600 בשעה)
- חריגה מחזירה **error 131056**
- מותר burst של עד 45 הודעות ב-6 שניות, אבל זה "לווה" מהמכסה העתידית —
  burst של 20 דורש המתנה של ~2 דקות
- retry מומלץ: `4^X` שניות, כאשר X מתחיל ב-0 ועולה ב-1 אחרי כל כישלון

## אבטחה

הודעות מוגנות בהצפנת **Signal protocol** לפני שהן עוזבות את המכשיר.
Cloud API עצמו עובד מעל HTTPS/TLS, והצפנה של data at rest.

## מדיניות

- חובה לקבל **opt-in** מהמשתמש לפני שליחת תבניות. ה-opt-in חייב להבהיר את שם
  העסק ואת הכוונה.
- **שימוש בכלי צד-שלישי לא מאושרים אסור** — שיקול רלוונטי בבחירה בין ה-MCP
  הרשמי של Meta לבין מימושי קהילה.

## כלים

- **WhatsApp Manager** — ניהול WABAs, מספרים, תבניות ואנליטיקס דרך הדפדפן
- **API Playground** — כפתור "Try it" בכל דף reference בתיעוד
- **Postman collection** רשמי
- SDKs של צד שלישי (למשל PyWa) קיימים אך אינם נתמכים או מאושרים ע"י Meta

---

מקור:
<https://developers.facebook.com/documentation/business-messaging/whatsapp/about-the-platform>
תאריך עדכון הדף: 4 באוגוסט 2026.
