import type { Profile } from "@node-saml/passport-saml";

// SAML attribute names vary between identity providers. AWS IAM Identity Center
// lets administrators map application attributes to any name, so we probe the
// common conventions (friendly names and the standard claim URIs / OIDs).
export const EMAIL_KEYS = [
  "email",
  "mail",
  "Email",
  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
  "urn:oid:0.9.2342.19200300.100.1.3",
];
export const FIRST_NAME_KEYS = [
  "firstName",
  "givenName",
  "given_name",
  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname",
  "urn:oid:2.5.4.42",
];
export const LAST_NAME_KEYS = [
  "lastName",
  "surname",
  "family_name",
  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname",
  "urn:oid:2.5.4.4",
];
export const NAME_KEYS = [
  "name",
  "displayName",
  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name",
  "urn:oid:2.16.840.1.113730.3.1.241",
];

/**
 * Reads the first non-empty string value for any of the provided keys from a
 * SAML profile, flattening single-element arrays that some identity providers
 * emit.
 *
 * @param profile The SAML profile returned by the identity provider.
 * @param keys The candidate attribute names to look up, in priority order.
 * @returns The resolved string value, or undefined when none is present.
 */
export function readAttribute(
  profile: Profile,
  keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = profile[key];
    const resolved = Array.isArray(value) ? value[0] : value;
    if (typeof resolved === "string" && resolved.trim()) {
      return resolved.trim();
    }
  }
  return undefined;
}

/**
 * Resolves the user's email address from a SAML profile, falling back to the
 * NameID when it is an email address.
 *
 * @param profile The SAML profile returned by the identity provider.
 * @returns The email address, or undefined when none can be determined.
 */
export function getEmail(profile: Profile): string | undefined {
  return (
    readAttribute(profile, EMAIL_KEYS) ??
    (typeof profile.nameID === "string" && profile.nameID.includes("@")
      ? profile.nameID
      : undefined)
  );
}

/**
 * Resolves the user's display name from a SAML profile, composing it from the
 * first and last name attributes when a full name is not provided.
 *
 * @param profile The SAML profile returned by the identity provider.
 * @returns The display name, or undefined when no name attributes are present.
 */
export function getName(profile: Profile): string | undefined {
  const fullName = readAttribute(profile, NAME_KEYS);
  if (fullName) {
    return fullName;
  }

  const composed = [
    readAttribute(profile, FIRST_NAME_KEYS),
    readAttribute(profile, LAST_NAME_KEYS),
  ]
    .filter(Boolean)
    .join(" ");

  return composed || undefined;
}

/**
 * Normalizes an X.509 certificate into PEM format. Accepts either a full PEM
 * block or a single-line base64 body without header/footer, matching the
 * convention documented for Outline's SAML configuration.
 *
 * @param cert The certificate value from configuration.
 * @returns a PEM-formatted certificate string.
 */
export function formatCert(cert: string): string {
  const body = cert
    .replace(/-----BEGIN CERTIFICATE-----/g, "")
    .replace(/-----END CERTIFICATE-----/g, "")
    .replace(/\s+/g, "");
  const lines = body.match(/.{1,64}/g)?.join("\n") ?? body;
  return `-----BEGIN CERTIFICATE-----\n${lines}\n-----END CERTIFICATE-----`;
}
