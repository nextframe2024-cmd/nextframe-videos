# Transcription Protocol — תמלול שיחות לידים

הפרוטוקול המלא לתמלול הקלטות של לידים/לקוחות. מופעל מהטריגר ב-`CLAUDE.md`.

## מתי
כל קובץ **אודיו או וידאו** שליד/לקוח שולח (שיחת מכירה, שיחת תיאום, הודעה קולית).
שים לב: קובץ `.mp4` יכול להיות **אודיו בלבד** (בלי ערוץ וידאו) — עדיין מתמללים.

## דרישות מקדימות
- `faster-whisper` מותקן (`pip install faster-whisper`), וכן `av` (PyAV) לפענוח אודיו.
- **מודל medium חייב להיות זמין מקומית.** הורדת מודלים מ-HuggingFace / CDN של OpenAI **עלולה להיות חסומה** במדיניות הרשת (403). לכן ודא שהמודל כבר במטמון (`~/.cache/huggingface/`) או ספק אותו מראש; אל תסתמך על הורדה חיה, ואל תנסה לעקוף חסימת מדיניות.
- אין `ffmpeg` בסביבה — פענוח אודיו דרך PyAV.

## הפקודה
```python
from faster_whisper import WhisperModel

model = WhisperModel("medium", device="cpu", compute_type="int8")
segments, info = model.transcribe(
    audio_path,
    language="he",     # שיחות בעברית
    beam_size=5,
    vad_filter=True,
)

lines = []
for seg in segments:
    ts = f"[{int(seg.start//60):02d}:{int(seg.start%60):02d}]"
    lines.append(f"{ts} {seg.text.strip()}")
transcript = "\n".join(lines)
```

הגדרות: **medium / cpu / int8 / language=he / beam_size=5 / vad_filter=True**.
(medium = איזון דיוק-מהירות לעברית; int8 = מהיר יותר על CPU; VAD = מדלג על שקט.)

## הרצה
- **תמיד ברקע** (`run_in_background`) — שיחה של 30+ דקות לוקחת כמה דקות תמלול על CPU. אל תחסום את הפורגראונד.
- כתוב את התוצר לקובץ; אל תנסה להחזיק תמלול ארוך בזיכרון השיחה.

## תוצר ושמירה
- שמור את התמלול לצד ההקלטה: `<שם-ההקלטה>.transcript.txt`.
- כלול חותמות זמן `[mm:ss]` לכל מקטע.
- אם השיחה רב-דוברים, סמן דוברים ידנית לפי ההקשר (faster-whisper לא מפריד דוברים אוטומטית) — או ציין שההפרדה משוערת.

## אחרי התמלול
- הצע ללקוח **תקציר קצר** של השיחה (נקודות עיקריות, התנגדויות, next steps) מעל התמלול המלא.
- אל תשלח את ההקלטה או התמלול לשום שירות חיצוני — הכל נשאר מקומי.
