# לחבר לידים מווצאפ לסוכן — מחקר

שאלת המחקר: איך מכניסים לידים נכנסים מווצאפ לטבלאות, כך שסוכן יוכל לקרוא
אותם, בעסק שכל התפעול שלו רץ על מספר WhatsApp Business קיים.

היקף: פחות מ-10 לידים ביום. קריאה בלבד בשלב ראשון. העדפה מוצהרת: בלי ספקים
חיצוניים.

## 1. מה ה-MCP באמת מביא

Meta עצמה מציבה את השרת ל**פיתוח ובדיקות**, לא להודעות בייצור בקנה מידה.
הבשורה שלו היא הסרת חיכוך בהקמה: במקום לדלג בין ה-Developer Console,
Business Manager, התיעוד ועורך הקוד — מתארים לסוכן מה צריך והוא מבצע.

מה הוא כן מקצר:
- בדיקת סטטוס תנאי השימוש
- יצירת WABA, הוספת מספר, אימות ב-OTP, רישום ל-Cloud API
- ניהול תבניות, כולל סטטוס אישור
- הגדרת webhooks

מה נשאר אנושי: אימות המספר. Meta שולחת קוד ב-SMS או בשיחה, ומי שמזין אותו
הוא אדם. הסוכן מתזמר סביב זה אבל לא מחליף את ההוכחה שהמספר שלך.

מי מרוויח הכי הרבה: עסקים קטנים ומפתחים בלי צוות שמתמחה בפלטפורמה של Meta.

**המסקנה לגבי המטרה שלנו:** ה-MCP לא נוגע בה. הוא כלי הקמה, לא צינור נתונים.

## 2. Cloud API לא מאפשר לקרוא הודעות — מאושר

זה לא חוסר בכלי ב-MCP, זו תכונה של הפלטפורמה:

- ל-Cloud API יש **endpoint אחד** להודעות: `POST /{Phone-Number-ID}/messages`.
  אין `GET`. אין שום קריאה שמחזירה שיחה שהתקיימה.
- הודעות נכנסות מגיעות ב-**push** דרך webhook. אין מה לתשאל.
- קיים ייבוא היסטוריה, אבל הוא חד-פעמי, מוגבל ל-180 יום, לא כולל קבוצות,
  ומדיה רק מ-14 הימים הראשונים. זה כלי מיגרציה, לא API קריאה.

**לכן שכבת האחסון היא חובה, לא בחירה.** מי שרוצה היסטוריה או אנליטיקס בונה
אותה אצלו מתוך ה-webhooks.

## 3. Coexistence — מבטל את ההנחה שמיגרציה הורגת את האפליקציה

ב-6 במאי 2025 Meta השיקה **WhatsApp Coexistence**: לקשר מספר של WhatsApp
Business App ל-Cloud API **בלי לנתק אותו מהאפליקציה ובלי לאבד היסטוריה**.

- מנגנון **Messaging Echoes**: הודעה שנשלחה מהאפליקציה מופיעה גם בצד ה-API,
  ולהפך. שני הצדדים עובדים במקביל ונשארים מסונכרנים.
- נשמרת היסטוריה של כ-6 חודשים, כדי שלא יאבד הקשר במעבר.
- בצד האפליקציה ממשיכים לענות חופשי, בלי חלון 24 שעות ובלי תבניות. בצד ה-API
  מקבלים אוטומציה ואינטגרציות.

### מה מפסיקים לקבל ב-Coexistence

- **קבוצות, רשימות תפוצה, הודעות נעלמות, שיתוף מיקום חי** — מפסיקים לעבוד או
  להסתנכרן
- **תבניות** נשלחות רק מצד ה-API, לא מהאפליקציה
- **Official Business Account** (התג הכחול) לא נתמך; אפשר Meta Verified במקום
- העברה בין WABAs לא נתמכת
- **חייבים לפתוח את האפליקציה לפחות פעם ב-13 יום** כדי שהחשבון יישאר פעיל
- היסטוריה: 180 יום להודעות, 14 יום למדיה

### התנאי שמקשה

לפי התיעוד, Coexistence מופעל דרך **Embedded Signup**, ונדרש להיות
**Solution Partner או Tech Provider** ולהעביר
`featureType: "whatsapp_business_app_onboarding"`. בלי זה המשתמש לא רואה את
המסך שמציע לחבר את חשבון האפליקציה הקיים.

מקורות של ספקים טוענים שבלי BSP לא ניתן להפעיל Coexistence בכלל. יש להם
אינטרס בטענה הזו, ולכן **צריך לאמת את זה מול התיעוד של Meta** לפני שמסתמכים
עליה. מה שכן ברור: זה לא מסלול שנפתח בכמה קליקים לעסק בודד.

## 4. איך אנשים עושים את זה בפועל

שני מסלולים חוזרים, שניהם בלי BSP:

### n8n (ניתן להרצה עצמית)

יש node ל-WhatsApp Business Cloud ותבניות מוכנות, בין היתר אחת שעושה בדיוק
את מה שאנחנו רוצים: מסווגת ליד נכנס, רושמת אותו וממסלטת אותו לגוגל שיטס,
עם התאמה לפי מספר טלפון.

### Cloudflare Worker + Google Apps Script

Worker שמאזין ל-webhook, ו-Apps Script שכותב לשיטס. יש תבניות Worker מוכנות
ל-Cloud API.

### מלכודת מעשית ששווה לדעת מראש

Cloud API שולח **גם הודעות אמיתיות וגם עדכוני סטטוס מסירה לאותו endpoint**.
בפלטפורמות שמחייבות לפי הרצה, כל עדכון סטטוס נספר כהרצה מלאה ושורף את המכסה.
הפתרון המקובל: Worker קטן שמסנן מלפנים, לפני שהאירוע מגיע לאוטומציה.

בהיקף של פחות מ-10 לידים ביום זה נכנס בשכבות החינמיות בשופי.

## 5. מספר הבדיקה — מה הוא מאפשר ומה לא

נוצר חינם עם כל אפליקציית Cloud API, בפורמט של מספר אמריקאי. שליחת תבניות
ממנו לא דורשת אמצעי תשלום.

**מה מותר:** עד **5 מספרים מאושרים**, שמתווספים ומאומתים במסך API Setup. יש
להתייחס לרשימה כאל allowlist של מספרים פנימיים ומסכימים — לא מספרי לקוחות.

**מה אסור:** לקוחות מזדמנים **לא יכולים** לשלוח הודעה למספר הבדיקה.

**מה שחשוב לנו:** חמשת המקבלים **כן יכולים להשיב**, והתשובה מפעילה webhook
נכנס. תשובה של מי מהם פותחת גם את חלון 24 השעות, כך שאפשר לבדוק טקסט חופשי
ולא רק תבניות. אפשר גם לשלוח payload בדיקה ידנית מ-
`App Dashboard > WhatsApp > Configuration`.

כלומר הצינור המלא — הודעה נכנסת, webhook, כתיבה לטבלה — ניתן לאימות מקצה
לקצה על מספר הבדיקה, עם הטלפון האישי כאחד מחמשת המקבלים. בלי לגעת במספר
העסקי ובלי להוציא מספר חדש.

לכשיעלה לייצור: 1,000 השיחות הראשונות בכל חודש חינם.

## 6. מספרים וירטואליים מהאינטרנט — לא מסלול

WhatsApp חוסמת רישום של מספרי **VoIP, קווי נייח, toll-free, פרימיום, UAN
ומספרי shared cost**. מ-2024 נחסמה הפעלה של מספרי VoIP מאוחסנים בארה"ב,
ומספרים וירטואליים מסוננים בשלב האימות.

הסיבה: מספרים כאלה ניתנים לייצור בכמויות, בלי SIM פיזי ובלי זיהוי, והיו כלי
נפוץ ליצירת חשבונות מזויפים ולספאם.

מעבר לחסימה — מספר מאתר SMS ציבורי הוא **משותף**, וכל מי שנכנס לאותו אתר יכול
להשתלט על החשבון. לא להשתמש בזה לשום דבר אמיתי.

## 7. המסקנה לתיק שלנו

| רכיב | מצב |
|---|---|
| קריאת לידים לטבלאות | ✅ פתיר עצמאית, בלי ספק — Worker או n8n |
| הסוכן קורא מהטבלאות | ✅ כבר עובד |
| ה-MCP | 🔸 עוזר בהקמה בלבד, לא בצינור |
| לשמור את האפליקציה על אותו מספר | ⚠️ דורש Coexistence, שדורש BSP או מעמד Tech Provider |

הסתירה היחידה שנשארה היא השורה האחרונה: הדבר שפותר את החסם הגדול הוא בדיוק
הדבר שהוגדר כלא רצוי. שאר התמונה פתירה עצמאית.

בהיקף הנוכחי, ההמלצה היא להקים את הצינור על **מספר הבדיקה** ולהוכיח את הערך
לפני שנוגעים במספר שהעסק רץ עליו.

## מקורות

- [TechCrunch — Meta now lets AI agents handle the boring parts of WhatsApp Business setup](https://techcrunch.com/2026/09/15/meta-now-lets-ai-agents-handle-the-boring-parts-of-whatsapp-business-setup/)
- [OpenTools — setup, test messages and production limits](https://opentools.ai/news/whatsapp-business-tools-mcp-setup-testing-production-limits)
- [Remio — Setup moves into AI agents, but approval still matters](https://www.remio.ai/post/meta-whatsapp-business-mcp-moves-setup-into-ai-agents-but-approval-still-matters)
- [Meta — Onboard WhatsApp Business app users (Embedded Signup)](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users)
- [360dialog — Coexistence](https://docs.360dialog.com/docs/resources/phone-numbers/coexistence)
- [YCloud — What is WhatsApp Business App Coexistence](https://www.ycloud.com/blog/whatsapp-business-app-coexistence-meta-update)
- [Blueticks — WhatsApp API to read messages and chat history](https://blueticks.co/blog/whatsapp-api-read-messages-and-chats)
- [n8n — Qualify, log and route inbound WhatsApp leads with Google Sheets](https://n8n.io/workflows/16923-qualify-log-and-route-inbound-whatsapp-leads-with-openai-and-google-sheets)
- [WANotifier — Test phone number limitations in direct setup](https://help.wanotifier.com/en/article/test-phone-number-limitations-in-direct-setup-kt0ly2/)
- [Wati — Test WhatsApp sends without messaging real customers](https://www.wati.io/en/blog/test-whatsapp-message-sends-safely/)
- [Cape — Can I use a VoIP number for WhatsApp in 2026](https://www.cape.co/blog/can-i-use-a-voip-number-for-whatsapp)
- [WhatsApp Help Center — Can't complete registration](https://faq.whatsapp.com/1120385166078156)
- [Cloudflare Worker template for WhatsApp Cloud API](https://github.com/depombo/whatsapp-api-cf-worker)
- [n8n community — filtering Cloud API status webhooks with a Worker](https://community.n8n.io/t/how-to-stop-whatsapp-cloud-api-status-webhooks-from-eating-your-n8n-executions-using-a-cloudflare-worker-for-generic-webhook-node-users/294956)
