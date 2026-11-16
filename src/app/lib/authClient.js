"use client";

import {
  autoSignIn,
  confirmResetPassword,
  confirmSignUp,
  resendSignUpCode,
  resetPassword,
  signIn,
  signInWithRedirect,
  signOut,
  signUp,
} from "aws-amplify/auth";

// USER_PASSWORD_AUTH lets the migration trigger check existing users' passwords against the old
// database on their first Cognito sign-in. The password goes to Cognito over TLS only.
const PASSWORD_FLOW = "USER_PASSWORD_AUTH";

/** Only allow same-site paths as post-sign-in destinations (prevents open redirects). */
export function safeReturnTo(value) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

/** Returns "done" when signed in, or "confirm" when the email still needs verifying. */
export async function emailSignIn(email, password) {
  try {
    const { isSignedIn, nextStep } = await signIn({ username: email, password, options: { authFlowType: PASSWORD_FLOW } });
    if (isSignedIn) return "done";
    if (nextStep.signInStep === "CONFIRM_SIGN_UP") {
      await resendSignUpCode({ username: email });
      return "confirm";
    }
    if (nextStep.signInStep === "RESET_PASSWORD") return "reset";
    throw new Error(`Unsupported sign-in step: ${nextStep.signInStep}`);
  } catch (error) {
    // A session from an earlier sign-in is still active; treat it as signed in.
    if (error?.name === "UserAlreadyAuthenticatedException") return "done";
    throw error;
  }
}

/** Creates the account and sends a verification code. Returns "confirm" or "done". */
export async function emailSignUp({ name, email, password }) {
  const { nextStep } = await signUp({
    username: email,
    password,
    options: {
      userAttributes: { email, ...(name ? { name } : {}) },
      autoSignIn: { authFlowType: PASSWORD_FLOW },
    },
  });
  if (nextStep.signUpStep === "CONFIRM_SIGN_UP") return "confirm";
  if (nextStep.signUpStep === "COMPLETE_AUTO_SIGN_IN") {
    await autoSignIn();
    return "done";
  }
  return "done";
}

/** Confirms the emailed code. Returns "done" if signed in automatically, otherwise "signin". */
export async function confirmEmail(email, code) {
  const { nextStep } = await confirmSignUp({ username: email, confirmationCode: code.trim() });
  if (nextStep.signUpStep === "COMPLETE_AUTO_SIGN_IN") {
    try {
      await autoSignIn();
      return "done";
    } catch {
      return "signin";
    }
  }
  return "signin";
}

export const resendCode = (email) => resendSignUpCode({ username: email });

export const startPasswordReset = (email) => resetPassword({ username: email });

export const finishPasswordReset = (email, code, newPassword) =>
  confirmResetPassword({ username: email, confirmationCode: code.trim(), newPassword });

export const googleSignIn = (returnTo) => signInWithRedirect({ provider: "Google", customState: safeReturnTo(returnTo) });

export const signOutUser = () => signOut();

/** Turns Cognito errors into short, user-facing messages. */
export function authErrorMessage(error) {
  switch (error?.name) {
    case "NotAuthorizedException":
    case "UserNotFoundException":
      return "Incorrect email or password.";
    case "UsernameExistsException":
      return "An account with this email already exists. Try logging in.";
    case "CodeMismatchException":
      return "That code isn't right. Check the email and try again.";
    case "ExpiredCodeException":
      return "That code has expired. Request a new one.";
    case "InvalidPasswordException":
      return "Password must be at least 8 characters.";
    case "LimitExceededException":
    case "TooManyRequestsException":
      return "Too many attempts. Wait a moment and try again.";
    case "InvalidParameterException":
      return "Check the details and try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}
