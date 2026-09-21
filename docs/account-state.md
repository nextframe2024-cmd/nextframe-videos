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
| App ID | `39087607710830380` |
| Use case | Connect with customers through WhatsApp |
| עסק | NEXT FRAME |
| מצב | **Unpublished** — ראה החסם שנשאר |
| דוא"ל | nextframe2024@gmail.com |

**Meta חוסמת את המילה "whatsapp" בשמות אפליקציות.** לכן השם לא מזכיר אותה.

`APP_SECRET` נמצא ב-`App settings > Basic` אחרי היצירה.

## Coexistence — מאומת ✅

`is_on_biz_app: true`. המספר נמצא גם באפליקציית WhatsApp Business וגם מחובר
ל-Cloud API.

**המשמעות:** החסם שדרש BSP או מעמד Tech Provider **עקוף** — הוא כבר פעיל.
אפשר לחבר webhook לתנועה האמיתית, לא רק למספר בדיקה, והצוות ממשיך לענות
באפליקציה כרגיל.

## החסם שנשאר — פרסום האפליקציה

מתוך מסך ה-Webhooks:

> Apps will only be able to receive test webhooks sent from the app dashboard
> while the app is unpublished. No production data, including from app admins,
> developers or testers, will be delivered unless the app has been published.

כלומר Coexistence פעיל והתנועה קיימת, אבל היא **לא תגיע ל-webhook עד שהאפליקציה
תפורסם**. פרסום דורש אימות עסק — אותו אימות שנמצא בבדיקה.

| מה עובד לפני פרסום | מה לא |
|---|---|
| הגדרת Callback URL | תנועה אמיתית מלקוחות |
| אימות ה-challenge מול Meta | הודעות מאדמינים, מפתחים או testers |
| test webhooks מלוח הבקרה | |

test webhooks מספיקים לאימות **כל** הצינור — Worker, חתימה, סינון, dedupe,
Apps Script, שורה בגיליון. מה שלא נבדק הוא רק המייל האחרון: שההודעה יוצאת
מלקוח אמיתי.

זה **המתנה, לא באג**. אין מה לתקן בקוד.

## נתוני האפליקציה השנייה — היסטוריה

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


## הצינור — מאומת (21.9.2026)

`Send to server` מלוח הבקרה של Meta עבר את כל השרשרת וכתב שורה:

```
wa_message_id     ABGGFlA5Fpa
from              16315551181
text              this is a text message
phone_number_id   123456123
received_at       2017-09-08T20:36:28.000Z
```

שלושת הערכים האחרונים הם **הדוגמה של Meta**, לא נתונים אמיתיים: חותמת הזמן
בדוגמה היא `1504902988` (2017), וה-`phone_number_id` הוא `123456123` ולא
המספר האמיתי. זה מצופה ולא מעיד על תקלה.

מה שזה מוכיח: הכתובת נכונה, `APP_SECRET` תואם, אימות החתימה עובר, הפרסר מטפל
במעטפת של לוח הבקרה, והסינק כותב.

נשאר רק **פרסום האפליקציה** אחרי אימות העסק, כדי שתנועה אמיתית תזרום לאותו
צינור. אין צורך בשינוי קוד.


## פרסום — בוצע, ולא חיכה לאימות העסק

מסך `/go_live/` דרש **כתובת מדיניות פרטיות וקטגוריה בלבד**. אימות עסק לא היה
תנאי לפרסום. ההנחה ההפוכה נרשמה כאן קודם והייתה שגויה.

מה שאומת בצד Meta, והכל תקין:

```
Published
מנויה ל-WABA 2743514402509748          POST /subscribed_apps → success
רשומה לשדה messages
webhook_configuration של 715040758363218 → הכתובת של ה-Worker
המספר: LIVE · CONNECTED · CLOUD_API
```

**אין שום דבר חסר בצד Meta.** ובכל זאת הודעה אמיתית מטלפון לא הגיעה לגיליון.

## החוליה שעדיין לא מאומתת, והחשוד

הבדיקה מלוח הבקרה **עוקפת** גם את הפרסום וגם את המינוי, ולכן היא לא מאמתת את
המסירה האמיתית. זו החוליה הפתוחה.

החשוד המרכזי הוא **כיוון ההודעה**, ולא תקלה בצינור:

| מי שלח | שדה ה-webhook | מגיע אלינו? |
|---|---|---|
| לקוח → המספר העסקי | `messages` | ✅ אנחנו רשומים |
| העסק, מתוך אפליקציית WhatsApp Business | **`smb_message_echoes`** | ❌ לא רשומים |

לפי התיעוד, `smb_message_echoes` מתאר הודעות שהעסק שולח **מאפליקציית
WhatsApp Business או ממכשיר מקושר** לאחר ה-onboarding ל-Cloud API. Meta מוסרת
הודעות נכנסות רגילות, אבל **לא מוסרת echoes אם האפליקציה לא רשומה לשדה הזה**.

כלומר: אם הודעת הבדיקה נשלחה **מהטלפון של המספר העסקי**, היא הודעה יוצאת —
echo — ולא הודעה נכנסת. השקט מוסבר לגמרי, ואין מה לתקן בצינור.

### הבדיקה שמפרידה בין השניים

לשלוח הודעה **מטלפון אחר** למספר העסקי `052-434-3190`. זו הודעה נכנסת
אמיתית, בשדה `messages`, ואם היא לא מגיעה — הבעיה אמיתית.

אם מתברר שצריך גם echoes: להירשם ל-`smb_message_echoes`, ו-`parse.js` יצטרך
לטפל בשדה הנוסף. לא נבנה לפני שנדע שזה נדרש.

מקורות:
[smb_message_echoes reference](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/smb_message_echoes) ·
[360dialog — Coexistence webhooks](https://docs.360dialog.com/partner/onboarding/whatsapp-coexistence/coexistence-webhooks)
