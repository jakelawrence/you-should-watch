# AWS Amplify Phase 1: What we did

**Date:** 2026-11-15

> **Note:** This is a snapshot of Phase 1 as of 15 November. Since then, sign-in has moved from NextAuth to Amazon Cognito (PR #14), so the `AUTH_URL`, login-secret and Google callback steps below no longer apply. Production now runs from `main` at `https://youshouldwatch.app`.
**Branch:** `amplify-phase-1` ([PR #13](https://github.com/jakelawrence/you-should-watch/pull/13))

**Where things stand:** The test site is live and working at `https://amplify-phase-1.d327p6sk4vykqb.amplifyapp.com`. Pages, the database, sign-up and sign-in all work. Next up are Google sign-in, a custom domain, and the real (production) site.

(The AWS account number is shown as `<account-id>`. This file has no passwords or keys in it.)

---

## 1. What we did

### Code changes

All of these are saved to the `amplify-phase-1` branch on GitHub.

- **Build instructions for Amplify** (`amplify.yml`): tell Amplify how to install and build the site.
- **Settings helper** (`scripts/amplify/write-runtime-env.mjs`): Amplify doesn't hand its settings to the running site on its own. This script copies them into a file the site can read while it builds.
  - It stops the build if the database address or the login secrets are missing.
  - It never prints secret values, only their names.
- **Secret-saving script** (`scripts/amplify/put-ssm-parameters.mjs`): saves passwords and keys to AWS's secure storage without showing them on screen.
- **Logging fix:** the site used to crash on Amplify because it tried to write log files to a folder it isn't allowed to write to. It now only writes log files on your own computer.
- **Security fix:** if the login secret was missing, the code used to fall back to a well-known default (`"your-secret-key"`). Anyone who knew it could have faked an admin login. That fallback is gone in all five places it appeared. The site now refuses to sign anyone in without a real secret.
- **Removed a leak:** one admin page was printing login cookies to the logs. It doesn't any more.
- **Removed two unused packages** (`canvas`, `colorthief`). `canvas` in particular often breaks installs.
- **Written guides:** the overall plan, the Phase 0 notes, and the Phase 1 step-by-step guide.

### Setup on your computer

- Installed the AWS command-line tool.
- Turned on AWS's sign-in system (IAM Identity Center) and made you a user with admin access.
- Connected the command-line tool to your account under the name `ysw`.
- Deleted the temporary files that held the GitHub token and database address.

### What we created in AWS (all in the `us-east-1` region)

- **A permissions role** (`ysw-amplify-service-role`): Amplify uses it during builds. Right now it can only read the test secrets.
- **The Amplify app** (`d327p6sk4vykqb`): connected to your GitHub repository.
- **A test branch** (`amplify-phase-1`): with its regular settings filled in. Automatic builds are turned off for now.
- **Five secrets in secure storage** (under `/ysw/nonprod/`): the database address, two login secrets, the OpenAI key, and the Google sign-in secret.
  - The database address points at a **separate copy** of your Neon database, so testing can't affect real data.
  - The two login secrets are brand new, so test logins can't be used on the real site.

Once a build works, the test site will be at:
`https://amplify-phase-1.d327p6sk4vykqb.amplifyapp.com`

### Choices we made

- Use the `us-east-1` region, where your database already is, so the site stays fast.
- Sign in to AWS through your browser instead of saving long-lasting keys on your computer.
- Set up AWS sign-in in one region only (simpler and free).
- Give GitHub access to this one repository only.
- Use a separate database copy for testing.
- Keep test secrets and real secrets in separate folders (`/ysw/nonprod` now, `/ysw/prod` later).

---

## 2. What went wrong

1. **Secrets could have been scrambled.** The first version of the settings helper would have changed secrets that contain certain symbols (quotes or `$`). *Fixed and tested.*
2. **The security problem was bigger than first found.** The weak default secret was in five places, not three. *All five fixed.*
3. **The AWS invite email never arrived.** *Got around it by creating a one-time password in AWS instead.*
4. **Claude wasn't allowed to save secrets to AWS.** A built-in safety check blocks this. *You ran that step yourself.*
5. **The first command failed.** The script it needed was never saved, because of the same block, and the command was split across lines when pasted. *Script moved into the project; you got a one-line command.*
6. **The AWS sign-in expired.** *Signed in again with `aws sso login --profile ysw`.*
7. **The first five builds failed** with *"Unable to assume specified IAM Role."* The message was misleading: the role was fine. *Fixed (see below).*
8. **Sign-in thought the site lived at `localhost:3000`.** Amplify doesn't tell the app its real web address. *Fixed by setting `AUTH_URL` to the test site's address.*

### How #7 was solved

- **What we tried that didn't help:** changing who the role trusts, waiting for changes to take effect, and giving the role broad Amplify permissions (`AdministratorAccess-Amplify`). Those broad permissions have since been removed again.
- **The clue:** a build with **no role at all** failed with the same error, so the role couldn't be the cause.
- **The real cause:** Amplify couldn't download the code from GitHub. When you create an Amplify app from the command line, AWS requires the **Amplify GitHub App** to be installed on the repository first. We had skipped that step.
- **The fix:** you installed the GitHub App (`https://github.com/apps/aws-amplify-us-east-1/installations/new`, for `you-should-watch` only). Build 6 then worked.
- **Lesson for the real site:** install the GitHub App *before* creating any Amplify app from the command line.

### Test results (build 7)

- All main pages load: `/`, `/discover`, `/search`, `/spin`, `/scenarios`, `/login`.
- The public API reads the test database (for example, the language list).
- `/profile` sends signed-out visitors to the login page.
- Signing up and signing in with email and password both work, and the profile page and saved-movies API work once signed in. This used a throwaway test account in the **test** database.
- Not tested yet: Google sign-in (needs step 6 below), saving and removing a movie in the browser, and the admin pages.

---

## 3. What's left to do

### Finish Phase 1

1. ~~Fix the build~~: done.
2. ~~Set the site's real address for sign-in (`AUTH_URL`)~~: done.
3. ~~Test pages, the API, and email sign-up and sign-in~~: done.
4. To rebuild by hand at any time:
   ```bash
   aws amplify start-job --app-id d327p6sk4vykqb --branch-name amplify-phase-1 --job-type RELEASE --profile ysw --region us-east-1
   ```
5. **Finish testing in a browser:** save and remove a movie, and check the admin pages.
6. **Google sign-in:** add this address to your Google sign-in settings:
   `https://amplify-phase-1.d327p6sk4vykqb.amplifyapp.com/api/auth/callback/google`
7. **Turn on automatic builds** so every push to the branch updates the test site.
8. **Custom domain:** add your own web address, and update the share link in `src/app/layout.js` (it still points at the old Vercel site).
9. **Real site:** save the real secrets under `/ysw/prod`, let the role read them, connect the `main` branch with `SSM_PARAMETER_PATH=/ysw/prod` and its own `AUTH_URL`, then deploy and test again.
10. Merge PR #13 once the test site works.
11. Update the Phase 1 guide to match how we actually did it (command line, not the website).
12. Tick off the finished items in the plan.

### Other things to keep in mind

- People signed in on the old site may need to sign in again after this change.
- Think about creating a `develop` branch to be the long-term test site.
- `.env.local` has old AWS keys from earlier migration scripts. If you don't need them, turn them off in AWS.
- You can delete the GitHub token once automatic builds work, or let it expire.
- To let Claude save secrets for you next time, allow the `aws ssm put-parameter` command in your Claude Code settings.
- Your other unsaved work on `main` (design and search changes) wasn't touched.

---

## Handy commands

```bash
# Sign in to AWS again when it expires
aws sso login --profile ysw

# See recent builds and whether they worked
aws amplify list-jobs --app-id d327p6sk4vykqb --branch-name amplify-phase-1 --profile ysw --region us-east-1 \
  --query 'jobSummaries[].[jobId,status,startTime]' --output table

# Save or change a test secret (run from the project folder)
AWS_PROFILE=ysw AWS_REGION=us-east-1 node scripts/amplify/put-ssm-parameters.mjs /ysw/nonprod NAME=source

# List saved secret names (doesn't show the values)
aws ssm get-parameters-by-path --path /ysw/nonprod --profile ysw --region us-east-1 --query 'Parameters[].Name'
```
