import { apiKey } from "@better-auth/api-key";
import {
  isEmailConfigured,
  OTP_EXPIRY_SECONDS,
  sendMagicLinkEmail,
  sendOtpEmail,
  sendPasswordResetEmail,
  sendWorkspaceInvitationEmail,
} from "@kaneo/email";
import {
  ac,
  DEFAULT_ROLE_NAMES,
  defaultRolePayloads,
  owner,
} from "@kaneo/permissions";
import bcrypt from "bcryptjs";
import { betterAuth } from "better-auth";
import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
} from "better-auth/api";
import {
  admin as adminPlugin,
  anonymous,
  bearer,
  deviceAuthorization,
  emailOTP,
  genericOAuth,
  lastLoginMethod,
  magicLink,
  openAPI,
  organization,
} from "better-auth/plugins";
import type { AccessControl } from "better-auth/plugins/access";
import type { UserWithAnonymous } from "better-auth/plugins/anonymous";
import { config } from "dotenv-mono";
import { and, eq } from "drizzle-orm";
import db, { schema } from "./database";
import { authDatabaseAdapter } from "./database/auth-adapter";
import { publishEvent } from "./events";
import clearEmailVerificationOnAdminChange from "./user/controllers/clear-email-verification-on-admin-change";
import deleteAccountData from "./user/controllers/delete-account-data";
import prepareAdminUserRemoval from "./user/controllers/prepare-admin-user-removal";
import {
  markWorkspaceMembershipScoped,
  materializeInvitationGrants,
} from "./utils/access-grants";
import {
  canSendSignInEmail,
  checkRegistrationAllowed,
  userExistsByEmail,
} from "./utils/check-registration-allowed";
import { checkWorkspaceName } from "./utils/check-workspace-name";
import { mapCustomOAuthProfileToUser } from "./utils/custom-oauth-profile";
import { generateDemoName } from "./utils/generate-demo-name";
import { getDefaultCookieAttributes } from "./utils/get-default-cookie-attributes";
import { getInvitationEmailSubject } from "./utils/get-invitation-email-subject";
import { getWorkspaceInvitationEmailCopy } from "./utils/get-workspace-invitation-email-copy";
import { getGithubSsoOAuthCredentials } from "./utils/github-sso-env";
import { isCloud } from "./utils/is-cloud";
import { isDisposableEmail } from "./utils/is-disposable-email";
import { isLocalSignInPath } from "./utils/is-local-sign-in-path";
import {
  hasRegisteredUsers,
  promoteInitialAdministrator,
} from "./utils/instance-bootstrap";
import {
  hasInstanceAdminRole,
  instanceAdminRoleSql,
} from "./utils/instance-admin-role";
import { revokeUserConnections, revokeWorkspaceConnections } from "./ws";
import { createDefaultWorkspaceInviteLink } from "./utils/seed-default-workspace-invite-links";
import { assertGuestRegistrationAllowed } from "./utils/registration-policy";
import { trackPasswordResetDelivery } from "./utils/password-reset-delivery";
import { queueSignInEmail } from "./utils/sign-in-email-tasks";
import { authCaptchaPaths, verifyTurnstile } from "./utils/verify-turnstile";

config();

const githubSso = getGithubSsoOAuthCredentials();

const isRegistrationDisabled = process.env.DISABLE_REGISTRATION === "true";
const isPasswordRegistrationDisabled =
  process.env.DISABLE_PASSWORD_REGISTRATION === "true";
const isLoginFormDisabled = process.env.DISABLE_LOGIN_FORM === "true";
const isEmailOtpSignInDisabled =
  process.env.DISABLE_EMAIL_OTP_SIGN_IN === "true";
const isWorkspaceCreationDisabled =
  process.env.DISABLE_WORKSPACE_CREATION === "true";

/**
 * Members of a workspace being deleted, keyed by the request context.
 *
 * Better Auth gives the `before` and `after` hooks of one deletion the same
 * context object, so the roster the `before` hook read survives the delete that
 * makes it unqueryable.
 */
const deletedWorkspaceMembers = new WeakMap<object, string[]>();

function normalizeInvitationId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (!/^[a-z0-9_-]{1,128}$/i.test(normalized)) return undefined;
  return normalized;
}

/** base32 token for workspace invite links: also an id-shaped allowlist. */
function normalizeInviteLinkToken(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(normalized)) return undefined;
  return normalized;
}

function isOAuthCallbackPath(path: unknown): boolean {
  if (typeof path !== "string") return false;
  return path.startsWith("/callback/") || path.startsWith("/oauth2/callback/");
}

const apiUrl = process.env.KANEO_API_URL || "http://localhost:1337";
const clientUrl = process.env.KANEO_CLIENT_URL || "http://localhost:5173";

const trustedOrigins = [clientUrl];
try {
  const apiOrigin = new URL(apiUrl);
  const apiOriginString = `${apiOrigin.protocol}//${apiOrigin.host}`;
  if (!trustedOrigins.includes(apiOriginString)) {
    trustedOrigins.push(apiOriginString);
  }
} catch {}

const baseURLWithoutPath = (() => {
  try {
    const url = new URL(apiUrl);
    return `${url.protocol}//${url.host}`;
  } catch {
    return apiUrl.split("/").slice(0, 3).join("/"); // Get protocol://host
  }
})();

if (process.env.AUTH_SECRET && process.env.AUTH_SECRET.length < 32) {
  console.error(
    "AUTH_SECRET is less than 32 characters, please generate a new one.",
  );
  process.exit(1);
}

async function getUserLocale(email: string) {
  const [user] = await db
    .select({ locale: schema.userTable.locale })
    .from(schema.userTable)
    .where(eq(schema.userTable.email, email))
    .limit(1);

  return user?.locale ?? null;
}

function getLocaleKey(locale?: string | null) {
  const normalized = locale?.toLowerCase();
  if (normalized?.startsWith("de")) return "de";
  if (normalized?.startsWith("vi")) return "vi";
  if (normalized?.startsWith("ja")) return "ja";
  return "en";
}

// Reads env at call time (not module scope) so tests can stub it.
async function shouldDeliverSignInEmail(email: string) {
  if (process.env.DISABLE_PASSWORD_REGISTRATION === "true") {
    return userExistsByEmail(email);
  }
  if (process.env.DISABLE_REGISTRATION === "true") {
    // Mirror `assertUserRegistrationAllowed`: the first non-guest user can
    // always complete initial instance setup.
    if (!(await hasRegisteredUsers())) return true;
    return canSendSignInEmail(email);
  }
  return true;
}

function getAuthEmailCopy(locale?: string | null) {
  const localeKey = getLocaleKey(locale);

  if (localeKey === "de") {
    return {
      magicLinkSubject: "Anmeldelink für Kaneo",
      otpSubject: "Bestätigungscode für Kaneo",
      passwordResetSubject: "Kaneo-Passwort zurücksetzen",
    };
  }

  if (localeKey === "vi") {
    return {
      magicLinkSubject: "Liên kết đăng nhập Kaneo",
      otpSubject: "Mã xác minh Kaneo",
      passwordResetSubject: "Đặt lại mật khẩu Kaneo",
    };
  }

  if (localeKey === "ja") {
    return {
      magicLinkSubject: "Kaneo ログインリンク",
      otpSubject: "Kaneo 認証コード",
      passwordResetSubject: "Kaneo のパスワードをリセット",
    };
  }

  return {
    magicLinkSubject: "Login for Kaneo",
    otpSubject: "Authentication code for Kaneo",
    passwordResetSubject: "Reset your Kaneo password",
  };
}

function getDeviceAuthClientIds(): Set<string> {
  const raw = process.env.DEVICE_AUTH_CLIENT_IDS?.trim();
  if (raw) {
    return new Set(
      raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    );
  }
  return new Set(["kaneo-cli", "kaneo-mcp"]);
}

function getDeviceAuthVerificationUri(): string {
  const base = clientUrl.replace(/\/$/, "");
  return `${base}/device`;
}

export const auth = betterAuth({
  baseURL: baseURLWithoutPath,
  trustedOrigins,
  secret: process.env.AUTH_SECRET || "",
  basePath: "/api/auth",
  // The adapter owns the "the instance must keep one administrator" rule: it
  // is the only layer that sees the count and the write in one transaction, so
  // two admins cannot demote each other concurrently.
  database: authDatabaseAdapter({
    provider: "pg",
    schema: {
      ...schema,
      user: schema.userTable,
      account: schema.accountTable,
      session: schema.sessionTable,
      verification: schema.verificationTable,
      workspace: schema.workspaceTable,
      workspace_member: schema.workspaceUserTable,
      invitation: schema.invitationTable,
      workspace_role: schema.workspaceRoleTable,
      team: schema.teamTable,
      teamMember: schema.teamMemberTable,
      apikey: schema.apikeyTable,
      deviceCode: schema.deviceCodeTable,
    },
  }),
  user: {
    additionalFields: {
      locale: {
        type: "string",
        input: true,
        required: false,
      },
    },
    deleteUser: {
      enabled: true,
      beforeDelete: async (user) => {
        await deleteAccountData(user.id);
      },
    },
  },
  account: {
    accountLinking: {
      // Link an OAuth/OIDC sign-in to an existing account that shares the same
      // email instead of failing with error=account_not_linked. The listed
      // providers verify the email on their side, so they are trusted to link.
      enabled: true,
      trustedProviders: ["github", "google", "discord", "custom"],
      // Only link to an existing local account after its email has been
      // verified. Without this check, an attacker could pre-register a victim's
      // email with a password account and retain access after the victim signs
      // in through a trusted OAuth/OIDC provider.
      requireLocalEmailVerified: true,
    },
  },
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 60 * 60,
    sendResetPassword: async ({ user, url }) => {
      // Keep mail latency out of the response so it cannot reveal accounts.
      trackPasswordResetDelivery(
        getUserLocale(user.email).then((locale) =>
          sendPasswordResetEmail(
            user.email,
            getAuthEmailCopy(locale).passwordResetSubject,
            { resetLink: url, userName: user.name, locale },
          ),
        ),
      );
    },
    password: {
      hash: async (password) => {
        return await bcrypt.hash(password, 10);
      },
      verify: async ({ hash, password }) => {
        return await bcrypt.compare(password, hash);
      },
    },
  },
  socialProviders: {
    github: {
      clientId: githubSso.clientId,
      clientSecret: githubSso.clientSecret,
      scope: ["user:email"],
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    },
    discord: {
      clientId: process.env.DISCORD_CLIENT_ID || "",
      clientSecret: process.env.DISCORD_CLIENT_SECRET || "",
    },
  },
  plugins: [
    ...(process.env.DISABLE_GUEST_ACCESS !== "true"
      ? [
          anonymous({
            generateName: async () => generateDemoName(),
            emailDomainName: "kaneo.app",
          }),
        ]
      : []),
    lastLoginMethod(),
    magicLink({
      disableSignUp: isPasswordRegistrationDisabled,
      sendMagicLink: async ({ email, url }) => {
        // Eligibility is checked off the request path: SMTP latency must not
        // tell a caller whether an address can complete the flow.
        queueSignInEmail(async () => {
          if (!(await shouldDeliverSignInEmail(email))) return;
          const locale = await getUserLocale(email);
          const copy = getAuthEmailCopy(locale);
          await sendMagicLinkEmail(email, copy.magicLinkSubject, {
            magicLink: url,
            locale,
          });
        });
      },
    }),
    ...(isEmailOtpSignInDisabled
      ? []
      : [
          emailOTP({
            expiresIn: OTP_EXPIRY_SECONDS,
            disableSignUp: isPasswordRegistrationDisabled,
            async sendVerificationOTP({ email, otp, type }) {
              if (type === "sign-in") {
                queueSignInEmail(async () => {
                  if (!(await shouldDeliverSignInEmail(email))) return;
                  const locale = await getUserLocale(email);
                  const copy = getAuthEmailCopy(locale);
                  await sendOtpEmail(email, copy.otpSubject, {
                    otp,
                    locale,
                  });
                });
              }
            },
          }),
        ]),
    organization({
      // `ac` is created with a narrow `statement` shape (project/task/label/
      // workspace + the default org statements), which makes its inferred
      // `newRole` generic incompatible with better-auth's looser
      // `AccessControl` type. Widen via an explicit cast so the plugin
      // accepts our custom statement.
      ac: ac as unknown as AccessControl,
      // Only `owner` stays static so its permissions can never be edited away
      // from the workspace creator. `viewer`, `member`, and `admin` are
      // seeded into `workspace_role` per workspace and resolved via
      // dynamic access control, so admins can fully override (replace) their
      // permissions per workspace. See `seedDefaultWorkspaceRoles` + the
      // afterCreateOrganization hook.
      roles: { owner },
      dynamicAccessControl: {
        enabled: true,
        maximumRolesPerOrganization: 25,
      },
      teams: {
        enabled: true,
        maximumTeams: 10,
        allowRemovingAllTeams: false,
      },
      schema: {
        organization: {
          modelName: "workspace",
          additionalFields: {
            // in metadata
            description: {
              type: "string",
              input: true,
              required: false,
            },
          },
        },
        member: {
          modelName: "workspace_member",
          fields: {
            organizationId: "workspaceId",
            createdAt: "joinedAt",
          },
        },
        invitation: {
          modelName: "invitation",
          fields: {
            organizationId: "workspaceId",
          },
        },
        organizationRole: {
          modelName: "workspace_role",
          fields: {
            organizationId: "workspaceId",
          },
        },
        team: {
          modelName: "team",
          fields: {
            organizationId: "workspaceId",
          },
        },
      },
      // When `DISABLE_WORKSPACE_CREATION` is set, only instance admins
      // (`user.role === "admin"`) may create workspaces — mirrors the
      // implicit-exemption shape of `DISABLE_REGISTRATION` above. This
      // check runs before any workspace membership exists, so only the
      // instance-wide role is meaningful here; per-workspace roles
      // (owner/admin/member/viewer) don't apply until after a workspace
      // is joined.
      //
      // `user` here comes from the session, which may be served out of
      // the cookie cache (see `session.cookieCache` below). The
      // first-user bootstrap promotes the user to admin in
      // `databaseHooks.user.create.after`, but that happens after
      // `signUpEmail` has already returned/cached the pre-promotion
      // role, so a cached session can still say `role: "user"` for up
      // to `cookieCache.maxAge`. Re-read the role from the database
      // instead of trusting the (possibly stale) cached role.
      allowUserToCreateOrganization: isWorkspaceCreationDisabled
        ? async (user) => {
            const [freshUser] = await db
              .select({ role: schema.userTable.role })
              .from(schema.userTable)
              .where(eq(schema.userTable.id, user.id));
            return freshUser?.role === "admin";
          }
        : true,
      // Better Auth defaults this to `true`, which blocks any user whose email
      // is not verified from accepting/rejecting an invitation. Kaneo does not
      // verify emails on signup (and guest/anonymous users are unverified by
      // design), so leaving the default on breaks invitation acceptance for
      // everyone. The invitation link id is the actual secret here, so gate on
      // that rather than on email verification.
      requireEmailVerificationOnInvitation: false,
      organizationHooks: {
        beforeCreateOrganization: async ({ organization }) => {
          const check = checkWorkspaceName(organization.name ?? "");
          if (!check.ok) {
            throw new APIError("BAD_REQUEST", { message: check.reason });
          }
        },
        afterCreateOrganization: async ({ organization, user }) => {
          // Seed the editable default roles for this workspace. Each
          // role's permissions are derived from the compiled-in defaults
          // in `@kaneo/permissions`; admins can later replace them in the
          // Roles UI. We skip names that somehow already exist (this hook
          // is best-effort idempotent; the boot-time backfill is the
          // belt-and-braces path).
          try {
            const existing = await db
              .select({ role: schema.workspaceRoleTable.role })
              .from(schema.workspaceRoleTable)
              .where(
                eq(schema.workspaceRoleTable.workspaceId, organization.id),
              );
            const taken = new Set(existing.map((r) => r.role));
            const now = new Date();
            const rows = DEFAULT_ROLE_NAMES.filter(
              (name) => !taken.has(name),
            ).map((name) => ({
              workspaceId: organization.id,
              role: name,
              permission: JSON.stringify(defaultRolePayloads[name]),
              createdAt: now,
              updatedAt: now,
            }));
            if (rows.length > 0) {
              await db.insert(schema.workspaceRoleTable).values(rows);
            }
          } catch (error) {
            console.error(
              "Failed to seed default workspace roles for workspace",
              organization.id,
              error,
            );
          }

          // Create the workspace's default shareable invite link: no expiry,
          // unlimited uses. Best-effort so a failure never blocks creation;
          // the boot-time backfill is the belt-and-braces path.
          try {
            await createDefaultWorkspaceInviteLink(organization.id, user.id);
          } catch (error) {
            console.error(
              "Failed to create default invite link for workspace",
              organization.id,
              error,
            );
          }

          publishEvent("workspace.created", {
            workspaceId: organization.id,
            workspaceName: organization.name,
            ownerEmail: user.name,
            ownerId: user.id,
          });
        },
        // Scope-bundle invitations carry their workspace/project/team intent in
        // first-party child tables; acceptance turns that intent into live
        // memberships and direct grants. Best-effort: a failure here must not
        // block the membership created by better-auth, and the admin can fix
        // the scope from the team/member views.
        afterAcceptInvitation: async ({ invitation, user }) => {
          try {
            await materializeInvitationGrants(user.id, invitation.id, {
              grantedBy: invitation.inviterId,
            });
            // The primary workspace's membership is created by better-auth with
            // the full-access default; narrow it unless the invitation granted
            // the whole workspace manually.
            const [fullGrant] = await db
              .select({ id: schema.invitationWorkspaceGrantTable.id })
              .from(schema.invitationWorkspaceGrantTable)
              .where(
                and(
                  eq(
                    schema.invitationWorkspaceGrantTable.invitationId,
                    invitation.id,
                  ),
                  eq(
                    schema.invitationWorkspaceGrantTable.workspaceId,
                    invitation.organizationId,
                  ),
                  eq(schema.invitationWorkspaceGrantTable.allProjects, true),
                ),
              )
              .limit(1);
            if (!fullGrant) {
              await markWorkspaceMembershipScoped(
                user.id,
                invitation.organizationId,
              );
            }
          } catch (error) {
            console.error(
              "Failed to materialise invitation grants for invitation",
              invitation.id,
              error,
            );
          }
        },
        beforeDeleteOrganization: async ({ organization }, ctx) => {
          // Deleting the workspace drops its memberships, so every member's
          // sockets have to go with it. Snapshot the roster here: by the
          // `after` hook the rows are gone. Instance admins are included
          // because their access is global, not a membership.
          if (ctx) {
            const members = await db
              .select({ userId: schema.workspaceUserTable.userId })
              .from(schema.workspaceUserTable)
              .where(
                eq(schema.workspaceUserTable.workspaceId, organization.id),
              );
            const admins = await db
              .select({ userId: schema.userTable.id })
              .from(schema.userTable)
              .where(instanceAdminRoleSql(schema.userTable.role));
            deletedWorkspaceMembers.set(ctx.context, [
              ...new Set(
                [...members, ...admins].map((member) => member.userId),
              ),
            ]);
          }
        },
        afterDeleteOrganization: async ({ organization }, ctx) => {
          const userIds = ctx
            ? (deletedWorkspaceMembers.get(ctx.context) ?? [])
            : [];
          if (ctx) deletedWorkspaceMembers.delete(ctx.context);
          await Promise.all(
            userIds.map((userId) =>
              revokeWorkspaceConnections(userId, organization.id, {
                force: true,
              }),
            ),
          );
        },
        afterRemoveMember: async ({ member, user }) => {
          if (member?.organizationId) {
            if (!hasInstanceAdminRole(user.role)) {
              await revokeWorkspaceConnections(
                member.userId,
                member.organizationId,
                { role: user.role ?? null },
              );
            }
          }
        },
      },
      async sendInvitationEmail(data) {
        const inviteLink = `${process.env.KANEO_CLIENT_URL}/invitation/accept/${data.id}`;
        const locale = await getUserLocale(data.email);
        const copy = getWorkspaceInvitationEmailCopy(locale);

        const result = await sendWorkspaceInvitationEmail(
          data.email,
          getInvitationEmailSubject(
            locale,
            data.inviter.user.name,
            data.organization.name,
          ),
          {
            inviterEmail: data.inviter.user.email,
            inviterName: data.inviter.user.name,
            workspaceName: data.organization.name,
            invitationLink: inviteLink,
            to: data.email,
            copy,
          },
        );

        if (
          result?.success === false &&
          result.reason === "EMAIL_NOT_CONFIGURED"
        ) {
          console.warn(
            "Invitation created but email not sent: no email transport (Resend or SMTP) is configured",
          );
          return;
        }
      },
    }),
    genericOAuth({
      config: [
        {
          providerId: "custom",
          clientId: process.env.CUSTOM_OAUTH_CLIENT_ID || "",
          clientSecret: process.env.CUSTOM_OAUTH_CLIENT_SECRET,
          authorizationUrl: process.env.CUSTOM_OAUTH_AUTHORIZATION_URL || "",
          tokenUrl: process.env.CUSTOM_OAUTH_TOKEN_URL || "",
          userInfoUrl: process.env.CUSTOM_OAUTH_USER_INFO_URL || "",
          scopes: process.env.CUSTOM_OAUTH_SCOPES?.split(",")
            .map((s) => s.trim())
            .filter(Boolean) || ["profile", "email"],
          responseType: process.env.CUSTOM_OAUTH_RESPONSE_TYPE || "code",
          discoveryUrl: process.env.CUSTOM_OAUTH_DISCOVERY_URL || "",
          pkce: process.env.CUSTOM_AUTH_PKCE !== "false",
          mapProfileToUser: mapCustomOAuthProfileToUser,
        },
      ],
    }),
    bearer(),
    apiKey({
      enableSessionForAPIKeys: true,
      apiKeyHeaders: "x-api-key",
      rateLimit: {
        enabled: true,
        maxRequests: 100,
        timeWindow: 60 * 1000,
      },
    }),
    deviceAuthorization({
      verificationUri: getDeviceAuthVerificationUri(),
      validateClient: async (clientId) =>
        getDeviceAuthClientIds().has(clientId),
    }),
    adminPlugin({
      defaultRole: "user",
      adminRoles: ["admin"],
    }),
    openAPI(),
  ],
  session: {
    cookieCache: {
      // Consult the session store on every request so password recovery
      // immediately rejects revoked cookies, including caches issued before upgrade.
      enabled: false,
    },
  },
  rateLimit: {
    // Enable in cloud; self-hosted instances opt in by setting KANEO_CLOUD.
    // Default better-auth rate-limit only kicks in for production; we keep the
    // global limits conservative and tighten signup/invite via customRules.
    enabled: isCloud(),
    window: 10,
    max: 100,
    customRules: {
      "/sign-up/email": { window: 60, max: 3 },
      "/sign-in/anonymous": { window: 60, max: 3 },
      "/organization/invite-member": { window: 60, max: 5 },
    },
  },
  databaseHooks: {
    user: {
      delete: {
        after: async (user, ctx) => {
          // Anonymous linking deletes the old identity after issuing a new
          // session. The replacement account must retain its authentication.
          if (
            (user as Partial<UserWithAnonymous>).isAnonymous &&
            ctx?.context.newSession &&
            ctx.context.newSession.user.id !== user.id
          )
            return;
          await revokeUserConnections(user.id);
        },
      },
      update: {
        before: async (user, ctx) => {
          if (
            (ctx?.path === "/admin/set-role" ||
              ctx?.path === "/admin/update-user") &&
            Object.hasOwn(user, "role") &&
            ctx.body?.userId === ctx.context.session?.user.id
          ) {
            throw new APIError("BAD_REQUEST", {
              code: "YOU_CANNOT_CHANGE_YOUR_OWN_ROLE",
              message: "You cannot change your own role.",
            });
          }
          return clearEmailVerificationOnAdminChange(user, ctx);
        },
      },
      create: {
        before: async (user, ctx) => {
          // The anonymous() plugin creates ephemeral users for guest
          // access; registration limits don't apply to them (guest
          // availability is governed by DISABLE_GUEST_ACCESS instead).
          // `isAnonymous` is `input: false` in the plugin schema, so a
          // regular signup request cannot spoof it.
          const userWithAnonymous = user as Partial<UserWithAnonymous>;
          if (userWithAnonymous.isAnonymous) {
            return;
          }

          // Allow the very first signup through even when registration
          // is disabled: that's the instance-admin bootstrap flow.
          // Otherwise a fresh instance with DISABLE_REGISTRATION=true
          // could never be set up because `checkRegistrationAllowed`
          // would reject the first user (qodo bot #3). Guest rows never
          // count: an instance that only ever served a guest still needs
          // its first real user.
          if (!(await hasRegisteredUsers())) {
            return;
          }

          const invitationId = normalizeInvitationId(
            ctx?.body?.invitationId ||
              ctx?.query?.invitationId ||
              ctx?.headers?.get("x-invitation-id"),
          );
          const inviteLinkToken = normalizeInviteLinkToken(
            ctx?.body?.inviteLinkToken ||
              ctx?.query?.inviteLinkToken ||
              ctx?.headers?.get("x-invite-link-token"),
          );
          const result = await checkRegistrationAllowed(
            user.email,
            invitationId,
            {
              allowInvitationByEmail: isOAuthCallbackPath(ctx?.path),
              inviteLinkToken,
              // Matching an invitation by email consumes it, so only an address
              // the provider has already proven may claim someone else's invite.
              emailVerified: user.emailVerified === true,
            },
          );
          if (!result.allowed) {
            throw new APIError("FORBIDDEN", {
              message: result.reason,
            });
          }
        },
        after: async (user) => {
          // The anonymous() plugin creates ephemeral users for guest
          // access; never promote one to instance admin even if no
          // real admin exists yet. `isAnonymous` is contributed by the
          // anonymous plugin's `additionalFields` and isn't part of the
          // base User type, so we narrow through `UserWithAnonymous`.
          const userWithAnonymous = user as Partial<UserWithAnonymous>;
          if (userWithAnonymous.isAnonymous) {
            return;
          }

          // Electing the earliest registered user inside one transaction keeps
          // concurrent first signups to a single admin: whichever after-hook
          // runs first promotes its user, and any later one finds an admin and
          // stops. Counting rows instead would promote nobody once two signups
          // were inserted before either hook ran.
          await promoteInitialAdministrator(user.id);
        },
      },
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      // Admin removal deletes the account's own rows first (workspaces it solely
      // owns, memberships, invitations), so authorization and the workspace
      // ownership rules have to run before Better Auth deletes the user.
      if (ctx.path === "/admin/remove-user") {
        await prepareAdminUserRemoval(ctx);
      }

      if (ctx.path === "/organization/invite-member") {
        // Better Auth swallows email failures in runInBackgroundOrAwait.
        // Invitation callers need the delivery result, including on resend.
        ctx.context.runInBackgroundOrAwait = async (promise) => {
          try {
            await promise;
          } catch {
            throw new APIError("BAD_GATEWAY", {
              code: "INVITATION_EMAIL_FAILED",
              message:
                "Invitation saved, but email delivery failed. Check email settings and resend the invitation.",
            });
          }
        };
      }

      if (isLoginFormDisabled && isLocalSignInPath(ctx.path)) {
        throw new APIError("FORBIDDEN", {
          message:
            "Local sign-in is disabled. Please use a configured social or OIDC sign-in method.",
        });
      }

      // Guests are only available on an initialised instance that still allows
      // them; otherwise a fresh instance would hand out an ephemeral account
      // before its first real user exists.
      // Recovery links are useless without delivery, and Better Auth answers
      // the same way for unknown accounts, so this leaks nothing about them.
      if (ctx.path === "/request-password-reset" && !isEmailConfigured()) {
        throw new APIError("FORBIDDEN", {
          message: "Password reset requires email delivery to be configured.",
        });
      }

      if (ctx.path === "/sign-in/anonymous") {
        await assertGuestRegistrationAllowed();
      }

      // Every account-creation and password-less entry point is gated by
      // CAPTCHA when one is configured, not just cloud sign-up. Self-hosted
      // instances leave TURNSTILE_SECRET_KEY unset, so verifyTurnstile passes.
      if (authCaptchaPaths.has(ctx.path)) {
        const verdict = await verifyTurnstile(
          ctx.headers?.get("x-turnstile-token") ?? ctx.body?.turnstileToken,
        );
        if (!verdict.ok)
          throw new APIError("FORBIDDEN", { message: verdict.reason });
      }

      // Block invite-member calls on cloud from anonymous users or to
      // disposable-email addresses. The 2026-05-28 incident saw ~14k phishing
      // invites sent from throwaway disposable-email signups; gating here
      // shuts that path off without affecting self-hosted instances.
      if (ctx.path === "/organization/invite-member" && isCloud()) {
        // `before` hooks don't auto-populate ctx.context.session; load it
        // explicitly. `disableRefresh` keeps this gate cheap: we only need
        // the user record, not a session refresh side-effect.
        const session = await getSessionFromCtx(ctx, {
          disableRefresh: true,
        }).catch(() => null);
        const sessionUser = session?.user as
          | { isAnonymous?: boolean | null }
          | undefined;
        if (sessionUser?.isAnonymous) {
          throw new APIError("FORBIDDEN", {
            message: "Guest accounts may not send workspace invitations.",
          });
        }
        const inviteeEmail = (ctx.body?.email as string | undefined) ?? "";
        if (inviteeEmail && isDisposableEmail(inviteeEmail)) {
          throw new APIError("BAD_REQUEST", {
            message:
              "Invitations to disposable-email addresses are not allowed.",
          });
        }
      }

      const isSignUpPath =
        ctx.path === "/sign-up/email" ||
        ctx.path.startsWith("/callback/") ||
        ctx.path.startsWith("/sign-in/social");

      if (!isSignUpPath) {
        return;
      }

      // Guest rows never count as an initialised instance, otherwise the first
      // guest sign-up would consume the instance-admin bootstrap slot.
      const isInstanceAdminSetup = !(await hasRegisteredUsers());

      if (ctx.path === "/sign-up/email") {
        if (isPasswordRegistrationDisabled && !isInstanceAdminSetup) {
          throw new APIError("FORBIDDEN", {
            message:
              "Password registration is currently disabled. Please use a configured social or OIDC sign-in method.",
          });
        }

        // Cloud-only disposable-email gate. CAPTCHA is enforced above on every
        // account-creation initiation when configured.
        if (isCloud() && !isInstanceAdminSetup) {
          const signupEmail = (ctx.body?.email as string | undefined) ?? "";
          if (signupEmail && isDisposableEmail(signupEmail)) {
            throw new APIError("BAD_REQUEST", {
              message:
                "Sign-up with disposable email addresses is not allowed.",
            });
          }
        }
      }

      if (!isRegistrationDisabled || isInstanceAdminSetup) {
        return;
      }

      const email =
        ctx.body?.email ||
        ctx.query?.email ||
        ctx.headers?.get("x-invitation-email");
      const invitationId = normalizeInvitationId(
        ctx.body?.invitationId ||
          ctx.query?.invitationId ||
          ctx.headers?.get("x-invitation-id"),
      );

      if (ctx.path === "/sign-up/email") {
        const inviteLinkToken = normalizeInviteLinkToken(
          ctx.body?.inviteLinkToken ||
            ctx.query?.inviteLinkToken ||
            ctx.headers?.get("x-invite-link-token"),
        );
        const result = await checkRegistrationAllowed(email, invitationId, {
          inviteLinkToken,
        });
        if (!result.allowed) {
          throw new APIError("FORBIDDEN", {
            message: result.reason,
          });
        }
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/organization/leave") {
        // The endpoint returns the removed member. No post-delete query may
        // prevent revocation after the membership has already committed.
        const removed = ctx.context.returned as
          | { userId?: string; organizationId?: string }
          | undefined;
        if (
          typeof removed?.userId === "string" &&
          typeof removed.organizationId === "string" &&
          removed.organizationId === ctx.body?.organizationId
        ) {
          await revokeWorkspaceConnections(
            removed.userId,
            removed.organizationId,
            { role: ctx.context.session?.user.role ?? null },
          );
        }
      }

      if (ctx.path.startsWith("/sign-up") || ctx.path.startsWith("/sign-in")) {
        const newSession = ctx.context.newSession;
        if (newSession) {
          const workspaceMember = await db
            .select({ workspaceId: schema.workspaceUserTable.workspaceId })
            .from(schema.workspaceUserTable)
            .where(eq(schema.workspaceUserTable.userId, newSession.user.id))
            .limit(1);

          const activeWorkspaceId = workspaceMember[0]?.workspaceId || null;

          if (activeWorkspaceId) {
            await db
              .update(schema.sessionTable)
              .set({ activeOrganizationId: activeWorkspaceId })
              .where(eq(schema.sessionTable.id, newSession.session.id));
          }
        }
      }
    }),
  },
  advanced: {
    ipAddress: {
      // Set only by the Node transport middleware, never accepted from clients.
      ipAddressHeaders: ["x-kaneo-client-ip"],
      trustedProxies: [],
    },
    defaultCookieAttributes: getDefaultCookieAttributes({
      apiUrl,
      clientUrl,
      cookieDomain: process.env.COOKIE_DOMAIN,
    }),
  },
});
