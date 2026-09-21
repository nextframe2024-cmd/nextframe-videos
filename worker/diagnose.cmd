@echo off
rem Captures the Worker's own log for one request, in a single window.
rem
rem Juggling `wrangler tail` in one window and a request in another loses the
rem output as soon as either closes. This starts the tail minimised, writes it
rem to a file, sends one deliberately unsigned request, then prints what the
rem Worker logged.
rem
rem The request is expected to be refused. The point is to see the refusal
rem reach the log, which proves the log is worth trusting before it is used to
rem diagnose anything else.
setlocal

cd /d "%~dp0"

set URL=https://whatsapp-webhook-receiver.nextframe.workers.dev
set LOG=%TEMP%\wa-tail.txt

if exist "%LOG%" del "%LOG%"

echo Starting the log capture...
start "wa-tail" /min cmd /c "wrangler tail --format pretty > ""%LOG%"" 2>&1"

rem The tail needs a moment to connect, or the request lands before it listens.
timeout /t 10 /nobreak >nul

echo Sending one unsigned request (expected: 401)...
curl -s -o nul -w "  HTTP status: %%{http_code}\n" -X POST ^
  -H "Content-Type: application/json" ^
  -d "{\"field\":\"messages\"}" ^
  %URL%

rem Logs arrive a beat after the response.
timeout /t 8 /nobreak >nul

taskkill /fi "WINDOWTITLE eq wa-tail*" /t /f >nul 2>&1

echo.
echo ---------------- what the Worker logged ----------------
if exist "%LOG%" (type "%LOG%") else (echo [no log file was produced])
echo --------------------------------------------------------
echo.
echo Expected to see: 401 signature rejected: header absent, ...
echo.
echo If that line is there, the log is reliable: a silent Send from Meta then
echo means Meta is not reaching this Worker, and the callback URL is next.
echo If it is missing, the log is not showing anything and every diagnosis
echo made with it so far was blind.

endlocal
