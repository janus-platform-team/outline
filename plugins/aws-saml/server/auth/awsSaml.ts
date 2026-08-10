import passport from "@outlinewiki/koa-passport";
import type { Strategy as PassportStrategy } from "@outlinewiki/koa-passport";
import type { Context, Request } from "koa";
import Router from "koa-router";
import {
  Strategy as SamlStrategy,
  type Profile,
  type VerifyWithRequest,
} from "@node-saml/passport-saml";
import { toError } from "@shared/utils/error";
import { slugifyDomain } from "@shared/utils/domains";
import { parseEmail } from "@shared/utils/email";
import accountProvisioner from "@server/commands/accountProvisioner";
import { AuthenticationError } from "@server/errors";
import passportMiddleware from "@server/middlewares/passport";
import { AuthenticationProvider, type User } from "@server/models";
import type { AuthenticationResult } from "@server/types";
import {
  getTeamFromContext,
  getClientFromOAuthState,
  getUserFromOAuthState,
} from "@server/utils/passport";
import { createContext } from "@server/context";
import config from "../../plugin.json";
import env from "../env";
import { formatCert, getEmail, getName } from "./attributes";

const router = new Router();

if (env.AWS_SAML_SSO_ENDPOINT && env.AWS_SAML_CERT) {
  const ssoEndpoint = env.AWS_SAML_SSO_ENDPOINT;
  const issuer = env.AWS_SAML_ENTITY_ID || env.URL;

  const signOnVerify = async function (
    req: Request,
    profile: Profile | null,
    done: (
      err: Error | null,
      user: User | null,
      result?: AuthenticationResult
    ) => void
  ) {
    const context = req.ctx;
    try {
      if (!profile) {
        throw AuthenticationError(
          "SAML assertion was invalid or missing fields, please check your configuration"
        );
      }

      const email = getEmail(profile);

      if (!email) {
        throw AuthenticationError(
          "An email address was not returned in the SAML assertion, but is required."
        );
      }

      const { domain } = parseEmail(email);
      if (!domain) {
        throw AuthenticationError(
          "SAML assertion was invalid or missing fields, please check your configuration"
        );
      }

      const displayName = getName(profile) || email.split("@")[0];

      const nameID =
        typeof profile.nameID === "string" && profile.nameID
          ? profile.nameID
          : email;

      const team = await getTeamFromContext(context);
      const client = getClientFromOAuthState(context);
      const user =
        context.state?.auth?.user ?? (await getUserFromOAuthState(context));

      const subdomain = slugifyDomain(domain);

      // The identity provider's issuer (entityID) uniquely identifies the
      // configured IdP; fall back to the SSO endpoint host when absent.
      const idpIssuer =
        typeof profile.issuer === "string" && profile.issuer
          ? profile.issuer
          : new URL(ssoEndpoint).hostname;

      // A single AWS Identity Center provider is supported per team.
      const authenticationProvider = team
        ? ((await AuthenticationProvider.findOne({
            where: {
              name: config.id,
              teamId: team.id,
              providerId: idpIssuer,
            },
          })) ??
          (await AuthenticationProvider.findOne({
            where: {
              name: config.id,
              teamId: team.id,
            },
          })))
        : undefined;

      const providerId = authenticationProvider?.providerId ?? idpIssuer;

      const ctx = createContext({
        ip: context.ip,
        user,
        authType: context.state?.auth?.type,
      });
      const result = await accountProvisioner(ctx, {
        team: {
          teamId: team?.id,
          name: env.APP_NAME,
          domain,
          subdomain,
        },
        user: {
          name: displayName,
          email,
          // AWS Identity Center only asserts verified directory addresses.
          emailVerified: true,
        },
        authenticationProvider: {
          name: config.id,
          providerId,
        },
        authentication: {
          providerId: nameID,
          scopes: [],
        },
      });

      return done(null, result.user, { ...result, client });
    } catch (err) {
      return done(toError(err), null);
    }
  };

  // Single Logout is not implemented; the logout verify is required by the
  // strategy signature but is never exercised without a logout endpoint.
  const logoutVerify = function (
    _req: Request,
    _profile: Profile | null,
    done: (err: Error | null, user?: Record<string, unknown>) => void
  ) {
    return done(null, {});
  };

  const strategy = new SamlStrategy(
    {
      entryPoint: ssoEndpoint,
      idpCert: formatCert(env.AWS_SAML_CERT),
      issuer,
      audience: issuer,
      callbackUrl: `${env.URL}/auth/${config.id}.callback`,
      passReqToCallback: true,
      // The AuthnRequest itself is unsigned; assertions returned by AWS IAM
      // Identity Center are signed and validated against `idpCert`.
      wantAssertionsSigned: true,
    },
    // The koa-passport request mock exposes `ctx`, which the strict
    // passport-saml verify signature (typed against Express) does not model.
    signOnVerify as unknown as VerifyWithRequest,
    logoutVerify as unknown as VerifyWithRequest
  );

  // passport-saml's Strategy targets a different passport type universe than
  // Outline's koa-passport wrapper, so bridge the structurally-compatible types.
  passport.use(config.id, strategy as unknown as PassportStrategy);

  router.get(config.id, passport.authenticate(config.id));
  router.get(`${config.id}.callback`, passportMiddleware(config.id));
  router.post(`${config.id}.callback`, passportMiddleware(config.id));

  // Exposes the service provider metadata XML so it can be imported directly
  // into the AWS IAM Identity Center application configuration.
  router.get(`${config.id}.metadata`, (ctx: Context) => {
    ctx.type = "application/xml";
    ctx.body = strategy.generateServiceProviderMetadata(null, null);
  });
}

export default router;
