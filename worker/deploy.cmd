@echo off
rem Sets the receiver's secrets and deploys it, for Windows cmd.
rem The bash equivalent is deploy.sh; run one or the other, not both.
setlocal

cd /d "%~dp0"

where wrangler >nul 2>&1
if errorlevel 1 (
  echo wrangler not found: npm install -g wrangler
  exit /b 1
)

rem A broken receiver that answers Meta's handshake is worse than one that
rem never deployed, so the tests gate the deploy.
echo Running tests...
call npm test
if errorlevel 1 (
  echo.
  echo Tests failed - not deploying.
  exit /b 1
)
echo Tests pass.
echo.

findstr /b /c:"[[kv_namespaces]]" wrangler.toml >nul 2>&1
if errorlevel 1 (
  echo KV dedupe is NOT configured. Without it a Meta retry can write a lead
  echo twice before the sheet's own dedupe catches it. To add it:
  echo.
  echo     wrangler kv namespace create SEEN
  echo.
  echo then paste the returned id into wrangler.toml and uncomment the block.
  echo Continuing without it.
  echo.
)

rem Each prompt reads the value without echoing it, so no secret is passed as
rem an argument or kept in command history.
echo VERIFY_TOKEN - any string; paste the same one into Meta's form.
call wrangler secret put VERIFY_TOKEN
echo.
echo APP_SECRET - App Dashboard ^> App settings ^> Basic ^> App Secret.
call wrangler secret put APP_SECRET
echo.
echo SHEETS_WEBAPP_URL - the Apps Script web app /exec URL.
call wrangler secret put SHEETS_WEBAPP_URL
echo.
echo SHEETS_TOKEN - the TOKEN constant inside Code.gs.
call wrangler secret put SHEETS_TOKEN
echo.

call wrangler deploy

echo.
echo Give the printed URL to Meta as the Callback URL, with the same
echo VERIFY_TOKEN, then subscribe to the 'messages' field.
endlocal
