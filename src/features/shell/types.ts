/** Shell-facing user summary (from the profile/session), for the user menu. */
export interface ShellUser {
  displayName: string;
  username: string | null;
  email: string | null;
  avatarUrl: string | null;
}
