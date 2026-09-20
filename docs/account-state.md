# מצב החשבון

מה קיים בפועל ב-Meta, ומה חסר. נבדק ב-20.9.2026.

## נכסים

| | |
|---|---|
| WABA | `מאיר אמזל NEXT FRAME` · `2743514402509748` |
| מספר | `+972 52-434-3190` · מחובר · דירוג איכות גבוה |
| `phone_number_id` | `715040758363218` |
| שותפים / BSP | **0** |
| תנועה | 39 שיחות ב-30 יום |

## אפליקציות

| אפליקציה | ID | מוצר WhatsApp | |
|---|---|---|---|
| `Ads Reporting` | `1058035190207372` | ❌ | In development, Facebook Login for Business |
| `Manychat` | `532160876956612` | ❌ | אינסטגרם בלבד — `next_frame_video_ai` |

**אין אפליקציה עם מוצר WhatsApp.** לכן Meta לא שולחת webhooks לשום מקום.

## מי משרת את 39 השיחות

אין צרכן API: 0 שותפים, אף אפליקציה עם מוצר WhatsApp, ו-Manychat מחזיקה נכסי
אינסטגרם בלבד. הניכוי: **אדם באפליקציית WhatsApp Business על הטלפון.**

המשמעות המעשית — אין אינטגרציה קיימת שהרשמה לשדה `messages` תדרוך עליה.

## חסמים

| | רלוונטי לקבלת לידים? |
|---|---|
| אין קישור אפליקציה ↔ WABA | ✅ **החסם היחיד** |
| אימות עסק בבדיקה (תקרת 250 שיחות ביוזמת העסק) | ❌ |
| אין אמצעי תשלום | ❌ נכנסות לא נחסמות |

## למה אפליקציה נפרדת — הנימוק המחייב

**Meta לא מאפשרת את השילוב בכלל.** ברגע שמסמנים use case של WhatsApp,
`Facebook Login` ו-`Instant Game` הופכים אפורים עם ההודעה:

> Some use cases can't be combined on the same app.

כלומר להוסיף WhatsApp ל-`Ads Reporting` — אפליקציית Facebook Login for
Business — לא היה אפשרי מלכתחילה. הדיון היה מיותר.

נימוק משני שנשאר נכון אבל לא הכריע: ה-rate limit של 200 בקשות/שעה הוא
**per app per WABA**, כך שדוחות מודעות וקבלת לידים היו מתחלקים באותה מכסה.

*(נרשם כדי שההחלטה לא תיבחן מחדש בעוד חודשיים.)*

## האפליקציה החדשה

| | |
|---|---|
| שם | `NEXT FRAME Leads Receiver` |
| Use case | Connect with customers through WhatsApp |
| עסק | NEXT FRAME |
| דוא"ל | nextframe2024@gmail.com |

**Meta חוסמת את המילה "whatsapp" בשמות אפליקציות.** לכן השם לא מזכיר אותה.

`APP_SECRET` נמצא ב-`App settings > Basic` אחרי היצירה.

## Coexistence — לא אושר

קיום `phone_number_id` מתיישב עם Coexistence אבל לא מוכיח אותו. פאנל המספר
מציג טאב פרופיל בלבד, בלי הגדרות API.

### הבדיקה המכריעה, בלי לגעת בכלום

למטא-דאטה של מספר עסקי יש שדה **`platform_type`** — בתיעוד מופיע
`"platform_type": "CLOUD_API"`. זה מבדיל בין מספר על Cloud API לבין מספר על
אפליקציית WhatsApp Business.

שתי דרכים לקרוא אותו:

- **ה-MCP** — `whatsapp_biz_phone_numbers` מחזיר מספרים "with status and
  onboarding state". קריאה בלבד, ולא דורש אפליקציה עם מוצר WhatsApp
- **Graph API** — `GET /715040758363218?fields=platform_type`, דורש access token

הדרך הידנית: האם אפליקציית WhatsApp Business על הטלפון עדיין עובדת על המספר.
אם כן, והמספר רשום ל-Cloud API — זה Coexistence.

**אם Coexistence פעיל:** אפשר לחבר webhook לתנועה האמיתית, לא רק למספר בדיקה,
והחסם שדורש BSP או מעמד Tech Provider עקוף.
