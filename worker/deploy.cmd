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

rem Deploy before the secrets. The upload is the first and only check against
rem the Workers runtime - neither the test suite nor --dry-run catches what it
rem rejects - and a deployed Worker with no secrets is harmless: without
rem APP_SECRET every delivery is refused, and Meta is not pointed at it yet.
echo Deploying (validates the script against the Workers runtime)...
call wrangler deploy
if errorlevel 1 (
  echo.
  echo Deploy failed - fix the error above before setting secrets.
  exit /b 1
)
echo.

rem Skip secrets that already exist, so a redeploy is not four prompts again.
call wrangler secret list > "%TEMP%\wa-secrets.txt" 2>nul

rem Each prompt reads the value without echoing it, so no secret is passed as
rem an argument or kept in command history.
findstr /c:"VERIFY_TOKEN" "%TEMP%\wa-secrets.txt" >nul 2>&1
if errorlevel 1 (
  echo VERIFY_TOKEN - any string; paste the same one into Meta's form.
  call wrangler secret put VERIFY_TOKEN
) else (
  echo VERIFY_TOKEN: already set, skipping.
)
echo.
findstr /c:"APP_SECRET" "%TEMP%\wa-secrets.txt" >nul 2>&1
if errorlevel 1 (
  echo APP_SECRET - App Dashboard ^> App settings ^> Basic ^> App Secret.
  call wrangler secret put APP_SECRET
) else (
  echo APP_SECRET: already set, skipping.
)
echo.
findstr /c:"SHEETS_WEBAPP_URL" "%TEMP%\wa-secrets.txt" >nul 2>&1
if errorlevel 1 (
  echo SHEETS_WEBAPP_URL - the Apps Script web app /exec URL.
  call wrangler secret put SHEETS_WEBAPP_URL
) else (
  echo SHEETS_WEBAPP_URL: already set, skipping.
)
echo.
findstr /c:"SHEETS_TOKEN" "%TEMP%\wa-secrets.txt" >nul 2>&1
if errorlevel 1 (
  echo SHEETS_TOKEN - the TOKEN constant inside Code.gs.
  call wrangler secret put SHEETS_TOKEN
) else (
  echo SHEETS_TOKEN: already set, skipping.
)
echo.

echo.
echo Give the printed URL to Meta as the Callback URL, with the same
echo VERIFY_TOKEN, then subscribe to the 'messages' field.
del "%TEMP%\wa-secrets.txt" >nul 2>&1
endlocal
