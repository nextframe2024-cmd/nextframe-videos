# WhatsApp Business Tools MCP — הגדרה

שרת MCP רשמי של Meta שמאפשר לסוכן AI / עוזר ב-IDE לנהל ולדבג אינטגרציה של
WhatsApp Business Platform (Cloud API) ממקום אחד.

**תיעוד:** <https://developers.facebook.com/documentation/mcp/whatsapp-business-tools-mcp>

## פרטי השרת

| | |
|---|---|
| שם | `WhatsApp Business Tools` |
| Endpoint | `https://mcp.facebook.com/whatsapp_business_tools` |
| Transport | Streamable HTTP |
| אימות | OAuth — התחברות עם חשבון מפתח של Meta |
| סטטוס | **בטא**, בהשקה הדרגתית |

## התקנה

השרת כבר מוגדר ברפו הזה ב-[`.mcp.json`](../.mcp.json), כך שסשן חדש בתיקייה
הזו יזהה אותו. נשאר רק לאמת:

```
/mcp
```

ובחר `whatsapp_business_tools` כדי להשלים את ה-OAuth.

להתקנה ידנית במקום אחר:

```bash
claude mcp add --transport http whatsapp_business_tools \
  https://mcp.facebook.com/whatsapp_business_tools
```

> ה-JSON ב-`.mcp.json` נגזר מפקודת ה-CLI הזו. דף התיעוד עצמו לא מציג קובץ
> קונפיגורציה, רק את הפקודה.

### לקוחות אחרים

- **Claude Desktop** — `Settings > Connectors > Add custom connector`, עם השם
  וה-URL שלמעלה.
- **Codex App** — `Settings > MCP Servers > Add server`, בחר Streamable HTTP
  ואימות OAuth.
- **ChatGPT** — `Settings > Plugins > Browse plugins`, כפתור ה-`+`, אימות OAuth.
- **לקוחות stdio בלבד** — דרך הגשר
  [`mcp-remote`](https://www.npmjs.com/package/mcp-remote), שמעביר שרת מרוחק
  מעל stdio.

## תהליך ההתחברות

1. התחל את החיבור. לקוחות רבים מתחילים את ה-OAuth אוטומטית כשהשרת מתווסף;
   אחרים דורשים לחיצה על Connect או Authenticate.
2. התחבר עם חשבון ה-Meta שלך בדפדפן. אם הוא לא נפתח לבד, העתק את הקישור
   שהלקוח מדפיס ופתח ידנית.
3. במסך ההסכמה — **בחר אילו עסקים ואפליקציות** השרת יקבל גישה אליהם.
4. חזור ללקוח ואמת שהחיבור עלה.

שים לב: **יש לחזור על ההתחברות בכל הפעלה מחדש של הלקוח.**

לביטול גישה: `facebook.com > Settings > Business Integrations`.

## הרשאות שהשרת מבקש

| Scope | מה זה נותן |
|---|---|
| `business_management` | גילוי ופעולה על העסקים שאתה מנהל ושבחרת בהסכמה |
| `whatsapp_business_management` | ניהול WABAs, מספרי טלפון, תבניות הודעות ו-webhooks |
| `whatsapp_business_messaging` | שליחת הודעות מהמספרים הרשומים שלך |

## דרישות מקדימות

- **גישת אדמין לעסק** שאתה רוצה לנהל (תפקיד `MANAGE`).
- **אפליקציה עם WhatsApp** שאתה אדמין בה, מחוברת לאותו עסק — אפליקציה עם
  use case של WhatsApp Business Messaging, או עם מוצר WhatsApp באפליקציה
  ותיקה. נדרשת גישת אדמין **על האפליקציה**, לא רק על העסק.
- **קבלת תנאי השימוש** של WhatsApp Business Cloud API עבור אותו עסק. שליחת
  הודעות ורישום מספרים חסומים עד שאדמין מאשר אותם.

אם חסרה דרישה, הכלי מחזיר שגיאה עם הסבר מה לתקן וקישור לדף המתאים.

## הכלים

**18 כלים** בסך הכל: 6 קריאה, 11 כתיבה, ואחד ששייך לשניהם.

### קריאה וגילוי (6)

| כלי | תפקיד |
|---|---|
| `whatsapp_biz_businesses` | רשימת העסקים שאתה מנהל ושאושרו בהסכמה. **התחל מכאן** כדי לבחור עסק. |
| `whatsapp_biz_accounts` | חשבונות ה-WhatsApp (ו-messaging accounts) תחת עסק |
| `whatsapp_biz_phone_numbers` | מספרי הטלפון של עסק או חשבון, עם סטטוס ומצב onboarding |
| `whatsapp_biz_list_templates` | רשימת תבניות ההודעות בחשבון |
| `whatsapp_biz_get_template` | פרטי תבנית בודדת |
| `whatsapp_biz_system_user_token` | מחזיר **קישור** ליצירת system user access token, לבנייה של פתרון שקורא ל-Cloud API ישירות. לא מייצר טוקן בעצמו. |

### כתיבה — מספרי טלפון (4)

| כלי | תפקיד |
|---|---|
| `whatsapp_biz_add_phone_number` | הוספת מספר לחשבון WhatsApp |
| `whatsapp_biz_send_verification_code` | שליחת קוד אימות למספר |
| `whatsapp_biz_verify_phone_number` | אימות המספר עם הקוד שהתקבל |
| `whatsapp_biz_register_phone_number` | רישום מספר מאומת כדי שיוכל לשלוח ולקבל |

### כתיבה — תבניות (3)

| כלי | תפקיד |
|---|---|
| `whatsapp_biz_create_template` | יצירת תבנית |
| `whatsapp_biz_update_template` | עדכון תבנית |
| `whatsapp_biz_delete_template` | **מחיקת** תבנית |

### כתיבה — הודעות ו-webhooks (4)

| כלי | תפקיד |
|---|---|
| `whatsapp_biz_send_message` | שליחת טקסט חופשי (נמסר רק בתוך חלון ה-24 שעות של שירות לקוחות) או תבנית מאושרת, ממספר רשום. מאשר איתך את היעד לפני השליחה. |
| `whatsapp_biz_configure_webhooks` | הגדרת callback URL ו-verify token ל-topic של WhatsApp, והרשמה לשדות המותרים |
| `whatsapp_biz_subscribe_webhook` | רישום חשבון WhatsApp ל-webhooks של האפליקציה שלך |
| `whatsapp_biz_configure_payments` | הגדרת אמצעי תשלום כדי שהחשבון יוכל לשלוח הודעות בתשלום |

### קריאה וכתיבה (1)

| כלי | תפקיד |
|---|---|
| `whatsapp_biz_verify_business` | בודק את סטטוס אימות העסק **וגם** מתחיל אימות — כלומר לא כלי קריאה בלבד |

## אזהרת הרשאות ומגבלות

זה **לא** כלי לקריאה בלבד. השרת פועל בשמך על כל עסק ואפליקציה שאישרת בהסכמה,
והוא שולח הודעות, רושם מספרים, מוחק תבניות ומגדיר אמצעי תשלום. המלצות:

- **הגבל בהסכמה.** מסך ההסכמה קובע לאילו עסקים ואפליקציות יש גישה. בחר רק
  את מה שנדרש.
- **הגבל גם בצד הלקוח.** ההסכמה קובעת *היקף*, אבל לא *אילו כלים* מותרים —
  לזה יש `.claude/settings.json`. ראה למטה.
- **התחל מול משאבי הבדיקה.** כשמתחילים עם Cloud API נוצרים אוטומטית WABA
  ומספר טלפון של בדיקה, עם messaging limits מרוככים וללא צורך ב-payment
  method לשליחת תבניות.
- `whatsapp_biz_send_message` מאשר את היעד לפני שליחה, אבל
  `whatsapp_biz_delete_template` ו-`whatsapp_biz_configure_payments` — לא
  מתועד שכן. לכן הם חסומים בקונפיגורציה, ראה למטה.
- אין צורך לשמור טוקן עבור ה-MCP — האימות הוא OAuth. `.env.example` ברפו הוא
  לעבודה ישירה מול Cloud API, לא לשרת.

### חסימת כלים ב-Claude Code

מסך ההסכמה של Meta לא מבחין בין כלים, ולכן ההגבלה לפי כלי נעשית אצלנו.
[`.claude/settings.json`](../.claude/settings.json) ברפו הזה מגדיר:

```json
{
  "permissions": {
    "deny": [
      "mcp__whatsapp_business_tools__whatsapp_biz_delete_template",
      "mcp__whatsapp_business_tools__whatsapp_biz_configure_payments"
    ],
    "ask": [
      "mcp__whatsapp_business_tools__whatsapp_biz_send_message",
      "mcp__whatsapp_business_tools__whatsapp_biz_register_phone_number"
    ]
  }
}
```

- `deny` — שני הכלים שלא מתועד שהם מבקשים אישור עצמאי, ושהתוצאה שלהם הרסנית
  או כספית.
- `ask` — דורש אישור מפורש לפני פעולה שנראית כלפי חוץ.

**מה עדיין רץ בלי אישור:** שאר 7 כלי הכתיבה —
`add_phone_number`, `send_verification_code`, `verify_phone_number`,
`create_template`, `update_template`, `configure_webhooks`,
`subscribe_webhook` — וגם `whatsapp_biz_verify_business`, שמתחיל אימות ולא
רק בודק. אם תרצה הידוק נוסף, הוסף אותם ל-`ask`.

### Rate limits

השרת עצמו מגביל **per user per tool**; חריגה מחזירה שגיאת rate-limit, ואז
יש להמתין ולנסות שוב.

מעבר לזה חלות מגבלות הפלטפורמה — ברירת מחדל של 200 בקשות בשעה per app per
WABA, על אותם endpoints שהכלים האלה נוגעים בהם (`/phone_numbers`,
`/message_templates`, `/subscribed_apps`). פרטים:
[סיכום הפלטפורמה](whatsapp-business-platform-overview.md).

### מדיניות

Meta אוסרת שימוש בכלי צד-שלישי לא מאושרים. זה שיקול לטובת השרת הרשמי הזה מול
מימושי קהילה שמעטפים את Cloud API.

## מה לא מתועד

- **Bearer access token** — הדף לא מתעד מצב אימות מבוסס טוקן לשרת עצמו, רק
  OAuth. גם סוג הטוקן לא מצוין.
- **עסק מאומת** (verified business) לא מופיע כדרישה מקדימה, למרות שהוא משפיע
  על throughput ועל סטטוס Official Business Account.
- ערכת הכלים **מתפתחת במהלך הבטא** וצפויה להשתנות.
