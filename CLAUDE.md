# CLAUDE.md — ABC-Clients

הנחיות שכל סשן ABC-Clients חדש קורא בתחילת העבודה.

## תמלול שיחות לידים

**טריגר:** לקוח/ליד שולח **הקלטה** (קובץ אודיו או וידאו — `.mp4`, `.m4a`, `.wav`, `.ogg` וכו', כולל וידאו שהוא בעצם אודיו-בלבד) = **צריך תמלול**.

**איך:** תמלול **מקומי** עם `faster-whisper` (לא שירות חיצוני — הקלטות לידים לא יוצאות מהמכונה). הרצה **ברקע** כי שיחה טיפוסית ארוכה:

```python
from faster_whisper import WhisperModel
model = WhisperModel("medium", device="cpu", compute_type="int8")
segments, info = model.transcribe(
    audio_path,
    language="he",     # שיחות בעברית
    beam_size=5,
    vad_filter=True,   # מסנן שקט/רעש
)
```

- מודל **medium** · `device=cpu` · `compute_type=int8` · שפה **he** · `beam_size=5` · **VAD** מופעל.
- **הרץ ברקע** (`run_in_background`) וכתוב את התמלול לקובץ — אל תחכה בפורגראונד.
- אם צריך להמיר/לקרוא אודיו: `PyAV` (`av`) מותקן; אין `ffmpeg`.

**פרוטוקול מלא** (דרישות מקדימות, מיקום שמירת התמלולים, טיפול בשיחה רב-דוברים, מה עושים עם התוצר): ראה **`M_Memory/Transcription_Protocol.md`**.
