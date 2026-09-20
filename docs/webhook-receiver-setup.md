# מקבל ה-webhooks — הקמה

הצינור: הודעה נכנסת בווצאפ → Cloud API → Cloudflare Worker → Apps Script →
גיליון. הסוכן קורא מהגיליון.

```
לקוח → Cloud API → Worker (אימות + סינון + dedupe) → Apps Script → Sheet
```

הגיליון לבדיקות:
[WhatsApp Leads — Inbox (test)](https://docs.google.com/spreadsheets/d/1G3GFq0xzWbyKB2yA1MPD4bAl8WDhQjI3BDUCysBfdZE/edit)

העמודות `status` ו-`notes` נשארות ריקות בכתיבה — הן בשביל הסוכן.

## למה Worker ולא ישר ל-Apps Script

שלוש סיבות, וכולן נצרכות:

1. **חתימה.** Meta חותמת כל אירוע ב-`X-Hub-Signature-256`. Apps Script לא יכול
   לאמת HMAC על הבייטים הגולמיים בנוחות; ה-Worker כן, והוא דוחה מה שלא חתום.
2. **סינון.** Cloud API שולח גם הודעות אמיתיות וגם עדכוני סטטוס מסירה לאותו
   endpoint. בלי סינון הגיליון יתמלא ברעש.
3. **Dedupe.** Meta חוזרת ושולחת אירוע שלא קיבל 200. בלי מזהה ייחודי תקבל
   שורות כפולות.

## שלב 1 — Apps Script

1. פתח את הגיליון → `Extensions > Apps Script`
2. הדבק את התוכן של [`apps-script/Code.gs`](../apps-script/Code.gs)
3. החלף את `TOKEN` במחרוזת אקראית ארוכה. שמור אותה — היא נדרשת בשלב 2
4. `Deploy > New deployment > Web app`
   - **Execute as:** Me
   - **Who has access:** Anyone
5. העתק את כתובת ה-`/exec`

הגישה היא "Anyone" כי Meta שולחת מהשרתים שלה, ולא ניתן לאמת מול חשבון גוגל.
**ה-`TOKEN` הוא מה שמגן על הגיליון** — בלעדיו כל מי שיודע את הכתובת יכול
לכתוב. אל תשאיר אותו בברירת המחדל.

## שלב 2 — הפריסה של ה-Worker

הדרך הקצרה — `./deploy.sh` מבקש את ארבעת הסודות אחד-אחד ופורס. או ידנית:

```bash
cd worker
npm install -g wrangler   # אם אין
wrangler login

# dedupe. בלי זה חזרה של Meta יכולה לכתוב ליד פעמיים
wrangler kv namespace create SEEN
# הדבק את ה-id ב-wrangler.toml ובטל את ההערה על הבלוק

wrangler secret put VERIFY_TOKEN       # מחרוזת שתבחר; תידרש גם אצל Meta
wrangler secret put APP_SECRET         # App Dashboard > Settings > Basic
wrangler secret put SHEETS_WEBAPP_URL  # כתובת ה-/exec משלב 1
wrangler secret put SHEETS_TOKEN       # ה-TOKEN משלב 1

wrangler deploy
```

בלי `SHEETS_WEBAPP_URL` המקבל עובד אבל רק מדפיס ללוג — שימושי לבדיקה ראשונה
עם `wrangler tail`.

## שלב 3 — לחבר את Meta

`App Dashboard > WhatsApp > Configuration`:

- **Callback URL:** כתובת ה-Worker
- **Verify token:** אותו `VERIFY_TOKEN`
- להירשם לשדה **`messages`**

Meta תשלח `GET` עם `hub.challenge`; ה-Worker מחזיר אותו וזה מה שמאמת.

אפשר לעשות את זה גם דרך ה-MCP — `whatsapp_biz_configure_webhooks` ואחריו
`whatsapp_biz_subscribe_webhook`.

## שלב 4 — בדיקה

מספר הבדיקה מקבל עד 5 מקבלים מאושרים. הוסף את הטלפון האישי שלך ב-API Setup,
שלח ממנו הודעה, ובדוק שנוספה שורה בגיליון.

זה מאמת את הצינור המלא בלי לגעת במספר העסקי.

## מה ה-Worker עושה

| | |
|---|---|
| `GET` | מאמת מול `VERIFY_TOKEN` ומחזיר את ה-challenge. אחרת 403 |
| `POST` | מאמת `X-Hub-Signature-256` על הבייטים הגולמיים. אחרת 401 |
| סינון | `value.messages` בלבד. `value.statuses` נופל בשקט |
| dedupe | לפי `wa_message_id` ב-KV, **אחרי** כתיבה מוצלחת בלבד |
| כשל sink | מחזיר 500 כדי ש-Meta תנסה שוב; ה-dedupe מונע כפילות |
| JSON פגום | מחזיר 200 ומדלג — ניסיון חוזר לא יתקן אותו |

הערה על ה-sink: Apps Script מחזיר 200 גם כשהוא דוחה בקשה, ולכן ה-Worker בודק
את גוף התשובה (`ok: true`) ולא רק את קוד ה-HTTP. בלי זה טוקן שגוי היה נראה
כהצלחה והליד היה נמחק מהתור.

## טסטים

```bash
cd worker && npm test
```

19 טסטים על הפירסור, על אימות החתימה ועל ה-sink. רצים מקומית בלי רשת ובלי
Cloudflare — ה-`fetch` מוחלף בבדיקות.

## החוזה בין ה-Worker ל-Apps Script

ה-Worker שולח **אצווה**, לא הודעה בודדת — משלוח אחד של Meta יכול להכיל כמה
הודעות:

```json
{ "token": "<SHEETS_TOKEN>", "leads": [ { "wa_message_id": "...", "text": "..." } ] }
```

`Code.gs` מקבל גם `messages` במקום `leads`, וגם `message` בודד, כדי שמימוש
אחר של ה-Worker יתחבר בלי שינוי.

**אם המפתח חסר לגמרי** — כלומר אין `leads`, אין `messages` ואין `message` —
הסקריפט מחזיר `ok:false`. זה מכוון: `ok:true, appended:0` במצב כזה היה גורם
ל-Worker לסמן את הליד כנכתב ב-KV ולזרוק אותו, ואצווה ריקה אמיתית לא נראית
כמו חוזה שבור.

התשובה כוללת `received`, `appended` ו-`skipped`, ואם עמודת `wa_message_id`
חסרה גם `warning`. שלושת המספרים יחד מסבירים כל תגובה בלוג בלי לנחש.

## שתי שכבות dedupe, ולמה צריך את שתיהן

| שכבה | מונעת |
|---|---|
| KV ב-Worker, לפי `wa_message_id` | משלוח חוזר שהגיע לפני שעיבדנו את הראשון |
| קריאת עמודת `wa_message_id` בגיליון | משלוח חוזר **אחרי** שהשורות כבר נכתבו |

השכבה השנייה נדרשת בגלל חלון שה-KV לא מכסה: ה-Worker מסמן ב-KV רק **אחרי**
שהסקריפט ענה `ok`. אם הכתיבה לגיליון הצליחה אבל התשובה לא חזרה — timeout,
נפילת חיבור — ה-Worker רואה כשל, מחזיר 500, Meta שולחת שוב, ואותן שורות
ייכתבו פעמיים. ה-KV נקי, כי מבחינתו שום דבר לא נכתב.

הכתיבה עצמה היא `setValues` אחד לכל האצווה, ולכן אצווה לא נוחתת חצי-כתובה.
מה שנשאר פתוח הוא רק אובדן התשובה — וזה מה שה-dedupe בגיליון סוגר.

בהיקף של פחות מ-10 לידים ביום קריאת העמודה היא זניחה. בגיליון עם עשרות אלפי
שורות כדאי יהיה להחליף את זה במפתח ב-`PropertiesService` או במעבר ל-sink
אמיתי.

## להחליף את ה-sink בסוף

`worker/src/sinks.js` מחזיק את המחלקות. כשתרצה את הטבלאות האמיתיות שלך במקום
גיליון הבדיקה — צריך לגעת רק שם, ורק ב-`SheetsSink.write`. שאר הצינור לא
מושפע.


## על פריסות מחדש

Apps Script מגיש **snapshot** של הקוד, לא את הקוד החי. שינוי ב-`TOKEN`,
ב-`SPREADSHEET_ID` או בכל קוד אחר דורש **New deployment**, לא רק שמירה.

לעומת זאת **שינוי בכותרות הגיליון לא דורש פריסה** — הכותרות נקראות בכל בקשה,
וגם עמודת ה-`wa_message_id` מאותרת לפי שם בזמן ריצה.


## הסדר המחייב

יש ביצה ותרנגולת: `Verify and save` אצל Meta שולח `GET` ל-Callback URL ומצפה
ל-`hub.challenge` בחזרה. אין URL לפני שה-Worker נפרס, ולכן אי אפשר למלא את
השדה קודם.

```
1. Apps Script  →  /exec URL
2. deploy.sh    →  Worker URL
3. Meta: Callback URL + verify token  →  הרשמה ל-messages
4. test webhook מלוח הבקרה  →  שורה בגיליון
5. פרסום האפליקציה (אחרי אימות עסק)  →  תנועה אמיתית
```

## על ה-VERIFY_TOKEN

הוא סוד משותף בין Meta ל-Worker, ו**לא צריך לעבור דרך שום סוכן או צ'אט**.
מייצרים אותו, מכניסים ב-`wrangler secret put` ומקלידים את אותו ערך בטופס של
Meta. אין סיבה להדביק אותו בשיחה.
